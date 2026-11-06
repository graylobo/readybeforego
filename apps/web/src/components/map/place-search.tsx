"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/use-translation";
import { Country, Region, scamsApi } from "@/lib/api/scams";
import { useScamMapStore } from "@/lib/stores/scam-map.store";
import { getCountryName } from "@/lib/utils/country";

interface PlaceRow {
  key: string;
  label: string;
  sublabel: string;
  count: number;
  onSelect: () => void;
}

const normalize = (value?: string | null) => (value || "").toLowerCase().replace(/\s+/g, "");

const centerOf = (regions: Region[]): [number, number] => [
  regions.reduce((sum, r) => sum + r.latitude, 0) / regions.length,
  regions.reduce((sum, r) => sum + r.longitude, 0) / regions.length,
];

const totalCount = (regions: Region[]) => regions.reduce((sum, r) => sum + (r.scamCount || 0), 0);

function groupBy(regions: Region[], keyOf: (region: Region) => string | null | undefined) {
  const groups = new Map<string, Region[]>();
  for (const region of regions) {
    const key = keyOf(region);
    if (key) groups.set(key, [...(groups.get(key) || []), region]);
  }
  return groups;
}

export function PlaceSearch({ regions }: { regions: Region[] }) {
  const { lang } = useTranslation();
  const {
    selectedCountryCode,
    selectedCityId,
    selectedRegionId,
    nearby,
    setSelectedCountryCode,
    setSelectedCityId,
    setSelectedRegionId,
    setSelectedRegion,
    setMapCenter,
    setMapZoom,
    setNearby,
    setIsFilterModalOpen,
  } = useScamMapStore();

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const [placeResults, setPlaceResults] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: countries = [] } = useQuery<Country[]>({
    queryKey: ["countries"],
    queryFn: () => scamsApi.getCountries(),
  });

  const activeRegions = useMemo(() => regions.filter((r) => (r.scamCount || 0) > 0), [regions]);

  const selectRegion = (region: Region) => {
    setSelectedCountryCode(region.countryCode || null);
    setSelectedCityId(region.cityId);
    setSelectedRegionId(region.id);
    setSelectedRegion(region);
    setMapCenter([region.latitude, region.longitude]);
    setMapZoom(15);
  };

  const selectCity = (cityId: string, group: Region[]) => {
    setSelectedCountryCode(group[0].countryCode || null);
    setSelectedCityId(cityId);
    setSelectedRegionId(null);
    setSelectedRegion(null);
    setMapCenter(centerOf(group));
    setMapZoom(12);
  };

  const selectCountry = (code: string, group: Region[]) => {
    setSelectedCountryCode(code);
    setSelectedCityId(null);
    setSelectedRegionId(null);
    setSelectedRegion(null);
    setMapCenter(centerOf(group));
    setMapZoom(6);
  };

  const rows = useMemo<PlaceRow[]>(() => {
    const q = normalize(query);
    const cityGroups = groupBy(activeRegions, (r) => r.cityId);
    const cityRow = (cityId: string, group: Region[]): PlaceRow => ({
      key: `city-${cityId}`,
      label: `${group[0].cityName || "도시"} 전체`,
      sublabel: getCountryName(group[0].countryCode, lang) || "",
      count: totalCount(group),
      onSelect: () => selectCity(cityId, group),
    });

    // 검색어가 없으면 제보가 많은 도시를 먼저 보여 준다
    if (!q) {
      return [...cityGroups.entries()]
        .map(([cityId, group]) => cityRow(cityId, group))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    }

    const regionRows = activeRegions
      .filter((r) => normalize(r.name).includes(q) || normalize(r.nameEn).includes(q))
      .map((region): PlaceRow => ({
        key: `region-${region.id}`,
        label: region.name,
        sublabel: region.cityName || "",
        count: region.scamCount || 0,
        onSelect: () => selectRegion(region),
      }));

    const cityRows = [...cityGroups.entries()]
      .filter(([, group]) => normalize(group[0].cityName).includes(q))
      .map(([cityId, group]) => cityRow(cityId, group));

    const countryRows = [...groupBy(activeRegions, (r) => r.countryCode).entries()]
      .filter(([code]) => {
        const country = countries.find((c) => c.code === code);
        return (
          normalize(getCountryName(code, lang)).includes(q) ||
          normalize(country?.name).includes(q) ||
          normalize(country?.nameEn).includes(q)
        );
      })
      .map(([code, group]): PlaceRow => ({
        key: `country-${code}`,
        label: `${getCountryName(code, lang) || code} 전체`,
        sublabel: "",
        count: totalCount(group),
        onSelect: () => selectCountry(code, group),
      }));

    return [...regionRows, ...cityRows, ...countryRows].slice(0, 8);
    // 선택 함수는 스토어 setter만 사용하므로 의존성에서 제외한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeRegions, countries, lang]);

  // 선택이 모두 해제되면 입력창도 비운다
  useEffect(() => {
    if (nearby?.kind === "gps" || (!selectedCountryCode && !selectedCityId && !selectedRegionId && !nearby)) {
      setQuery("");
      setPlaceResults([]);
    }
  }, [selectedCountryCode, selectedCityId, selectedRegionId, nearby]);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  const finish = (label: string, select: () => void) => {
    select();
    setQuery(label);
    setPlaceResults([]);
    setIsOpen(false);
  };

  // 외부 지오코딩 서비스는 자동완성 용도로 호출하지 않고, 사용자가 찾기를 눌렀을 때만 호출한다
  const searchPlaces = async () => {
    const keyword = query.trim();
    if (!keyword) return;
    setIsSearchingPlace(true);
    try {
      const results = await scamsApi.searchAddress(keyword);
      setPlaceResults(results || []);
      if (!results || results.length === 0) {
        toast.info("검색 결과가 없습니다. 지명을 조금 더 구체적으로 적어 보세요.");
      }
    } catch (err) {
      console.error("Place search error:", err);
      toast.error("장소 검색 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsSearchingPlace(false);
    }
  };

  const selectPlace = (item: any) => {
    const center: [number, number] = [Number(item.lat), Number(item.lon)];
    if (!Number.isFinite(center[0]) || !Number.isFinite(center[1])) {
      toast.error("선택한 장소의 위치 정보가 올바르지 않습니다.");
      return;
    }
    const label = item.name || String(item.display_name || query).split(",")[0];
    finish(label, () => {
      setNearby({ center, label, kind: "place" });
      setMapCenter(center);
    });
  };

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0 max-w-md">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (rows.length > 0 && query.trim()) {
            finish(rows[0].label, rows[0].onSelect);
          } else {
            searchPlaces();
          }
        }}
        className="flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 shadow-lg dark:border-slate-800 dark:bg-slate-900"
      >
        <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPlaceResults([]);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setIsOpen(false);
          }}
          placeholder="여행지 검색 (예: 카오산로드)"
          aria-label="여행지 검색"
          className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 md:text-sm dark:text-slate-100 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={() => {
              setQuery("");
              setPlaceResults([]);
              setIsOpen(true);
            }}
            className="shrink-0 cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {isOpen && (
        <div className="absolute inset-x-0 top-12 max-h-[60vh] overflow-y-auto rounded-2xl border border-border bg-card py-1.5 text-card-foreground shadow-2xl">
          {!query.trim() && rows.length > 0 && (
            <p className="px-4 py-1.5 text-xs font-semibold text-muted-foreground">제보가 많은 도시</p>
          )}

          {rows.map((row) => (
            <button
              key={row.key}
              type="button"
              onClick={() => finish(row.label, row.onSelect)}
              className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left hover:bg-muted"
            >
              <MapPin className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {row.label}
                {row.sublabel && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">{row.sublabel}</span>
                )}
              </span>
              <span className="shrink-0 text-xs font-semibold text-muted-foreground">{row.count}건</span>
            </button>
          ))}

          {placeResults.map((item, index) => (
            <button
              key={`${item.lat}-${item.lon}-${index}`}
              type="button"
              onClick={() => selectPlace(item)}
              className="flex w-full cursor-pointer items-start gap-2.5 px-4 py-2.5 text-left hover:bg-muted"
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate font-semibold">
                  {item.name || String(item.display_name || "").split(",")[0]}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{item.display_name}</span>
              </span>
            </button>
          ))}

          {query.trim() && (
            <button
              type="button"
              onClick={searchPlaces}
              disabled={isSearchingPlace}
              className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-blue-700 hover:bg-muted disabled:cursor-wait dark:text-blue-400"
            >
              {isSearchingPlace ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span className="min-w-0 truncate">&quot;{query.trim()}&quot; 주변 장소 찾기</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setIsFilterModalOpen(true);
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 border-t border-border px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
            국가·도시 목록에서 고르기
          </button>
        </div>
      )}
    </div>
  );
}
