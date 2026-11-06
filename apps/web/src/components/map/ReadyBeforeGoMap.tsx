"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/use-translation";
import { Region, ScamSighting, scamsApi } from "@/lib/api/scams";
import { useScamMapStore } from "@/lib/stores/scam-map.store";
import { getCountryName } from "@/lib/utils/country";
import { NEARBY_LOCATION_THRESHOLD } from "@/lib/constants/map";
import { distanceMeters, findNearbyRegions, REGION_AREA_RADIUS_M, topCategoryIcons } from "@/lib/nearby";
import { earlierMonthOptions, formatLocalDate, resolveSightingDate, SIGHTING_WHEN_OPTIONS, SightingWhen } from "@/lib/sighting-date";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CheckCircle2, Loader2, Locate, MapPin, Navigation, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { toast } from "sonner";

// Webpack marker-icon path fixes for Next.js bundle
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { cwd } from "process";

// 주요 국가별 표준 중심 좌표 정의 (도시/마커 분포 쏠림 방지)
const COUNTRY_COORDS: Record<string, [number, number]> = {
  KR: [36.3, 127.8], // 대한민국 중심
  TH: [13.7563, 100.5018], // 태국 방콕
  VN: [16.0544, 108.2022], // 베트남 다낭
  KH: [11.5564, 104.9282], // 캄보디아 프놈펜
  JP: [35.6762, 139.6503], // 일본 도쿄
  PH: [12.8797, 121.7740], // 필리핀 중심
};

// 주요 도시별 표준 중심 좌표 정의
const CITY_COORDS: Record<string, [number, number]> = {
  "부산광역시": [35.1796, 129.0756],
  "Busan": [35.1796, 129.0756],
  "서울특별시": [37.5665, 126.9780],
  "Seoul": [37.5665, 126.9780],
  "방콕": [13.7563, 100.5018],
  "Bangkok": [13.7563, 100.5018],
  "다낭": [16.0544, 108.2022],
  "Da Nang": [16.0544, 108.2022],
  "프놈펜": [11.5564, 104.9282],
  "Phnom Penh": [11.5564, 104.9282],
};

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon.src,
  iconRetinaUrl: markerIcon2x.src,
  shadowUrl: markerShadow.src,
});

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);

// "직방" 스타일의 수량 비례형 원형 뱃지 마커 및 위치 이름 라벨 오버레이 생성
const createClusterIcon = (
  name: string,
  cautionCount: number = 0,
  tipCount: number = 0,
  isSelected: boolean = false,
  filterReportType: "ALL" | "CAUTION" | "TIP" = "ALL",
  cautionIcons: string = ""
) => {
  const isSelectedStyle = isSelected 
    ? "ring-4 ring-red-500 shadow-[0_0_18px_rgba(239,68,68,0.9)] scale-110 z-50" 
    : "shadow-md group-hover:scale-110 group-hover:shadow-lg";

  const labelStyle = "bg-slate-900/90 dark:bg-slate-950/90 border-white/10 text-white font-bold";

  // 필터 상태 고려하여 노출할 수량 계산
  const showCaution = (filterReportType === "ALL" || filterReportType === "CAUTION") && cautionCount > 0;
  const showTip = (filterReportType === "ALL" || filterReportType === "TIP") && tipCount > 0;

  let badgeHtml = "";

  if (showCaution && showTip) {
    // 1. 혼합 클러스터 (Dual Badge Pill): [ ⚠️ N | 💡 M ]
    badgeHtml = `
      <div class="flex items-center rounded-full border-2 border-white overflow-hidden transition-all duration-200 ${isSelectedStyle} z-10 bg-slate-900">
        <div class="bg-gradient-to-r from-red-500 to-rose-600 px-2 py-1 text-white font-black text-xs flex items-center gap-0.5 border-r border-white/30">
          <span class="text-[10px]">${cautionIcons || "⚠️"}</span><span>${cautionCount}</span>
        </div>
        <div class="bg-gradient-to-r from-emerald-500 to-teal-600 px-2 py-1 text-white font-black text-xs flex items-center gap-0.5">
          <span class="text-[10px]">💡</span><span>${tipCount}</span>
        </div>
      </div>
    `;
  } else if (showTip) {
    // 2. TIP 전용 마커 (Green Circle)
    const count = filterReportType === "ALL" ? tipCount : tipCount;
    let sizeClass = count >= 6 ? "w-12 h-12 text-sm" : count >= 3 ? "w-10 h-10 text-xs" : "w-9 h-9 text-xs";
    badgeHtml = `
      <div class="flex items-center justify-center rounded-full text-white font-black bg-gradient-to-br from-emerald-500 to-teal-700 transition-all duration-200 ${sizeClass} border-2 border-white ${isSelectedStyle} z-10">
        <span class="mr-0.5 text-[10px]">💡</span>${count}
      </div>
    `;
  } else {
    // 3. CAUTION 전용 마커 (Red Circle)
    const count = filterReportType === "ALL" ? cautionCount : cautionCount;
    let sizeClass = count >= 6 ? "w-12 h-12 text-sm" : count >= 3 ? "w-10 h-10 text-xs" : "w-9 h-9 text-xs";
    // 유형 아이콘이 있으면 내용 길이에 맞는 알약 모양으로 그린다
    if (cautionIcons) sizeClass = "h-9 px-2.5 text-xs whitespace-nowrap";
    badgeHtml = `
      <div class="flex items-center justify-center rounded-full text-white font-black bg-gradient-to-br from-red-500 to-rose-700 transition-all duration-200 ${sizeClass} border-2 border-white ${isSelectedStyle} z-10">
        <span class="mr-1 text-[13px]">${cautionIcons || "⚠️"}</span>${count}
      </div>
    `;
  }

  return new L.DivIcon({
    html: `
      <div class="relative flex items-center justify-center w-[74px] h-[60px] select-none group cursor-pointer">
        ${badgeHtml}
        <div class="absolute bottom-[-10px] left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap max-w-[120px] truncate text-center group-hover:bg-slate-900 transition-colors ${labelStyle} z-20">
          ${escapeHtml(name)}
        </div>
      </div>
    `,
    className: "custom-cluster-icon",
    iconSize: [74, 60],
    iconAnchor: [37, 30],
  });
};

// 임시 제보 핀 아이콘 (파란색 테두리 및 핀)
const createTempReportIcon = () => {
  return new L.DivIcon({
    html: `
      <div class="relative flex items-center justify-center">
        <div class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-sky-400 opacity-75"></div>
        <div class="relative inline-flex rounded-full h-5 w-5 bg-sky-600 border border-white items-center justify-center shadow-lg">
          <span class="text-white text-[10px] font-bold">📍</span>
        </div>
      </div>
    `,
    className: "custom-pin-icon-temp",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// 사용자 현재 위치 마커 아이콘 (세련된 파란색 도트)
const createUserLocationIcon = () => {
  return new L.DivIcon({
    html: `
      <div class="relative flex items-center justify-center w-6 h-6 pointer-events-none">
        <div class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-blue-500 opacity-60 pointer-events-none"></div>
        <div class="relative w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow-md z-10 pointer-events-none"></div>
      </div>
    `,
    className: "user-location-marker pointer-events-none",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// 지도 제어 및 카메라 뷰 핸들러
function MapViewHandler({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, {
      animate: true,
      duration: 0.8,
    });
  }, [center, zoom, map]);
  return null;
}

// 옆 패널이 열리고 닫혀 지도 크기가 바뀌면 지도를 다시 맞춘다
function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

// 지도에 보이지 않는 겪은 위치가 있으면 모두 보이도록 지도를 옮긴다
function SightingsFitHandler({ sightings, onFit }: { sightings: ScamSighting[]; onFit: (center: [number, number], zoom: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (sightings.length === 0) return;
    const bounds = L.latLngBounds(sightings.map((s) => [s.latitude, s.longitude] as [number, number]));
    if (map.getBounds().contains(bounds)) return;
    const center = bounds.getCenter();
    onFit([center.lat, center.lng], Math.min(map.getBoundsZoom(bounds.pad(0.3)), 16));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sightings, map]);
  return null;
}

// 제보 모드 커서 제어 핸들러 (확대 전: 돋보기+, 확대 완료: 핀 아이콘)
function MapCursorHandler({ active }: { active: boolean }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();

    const updateCursor = () => {
      const zoom = map.getZoom();
      container.classList.remove("cursor-report-mode");
      container.classList.remove("cursor-zoom-in-mode");

      if (active) {
        if (zoom < 18) {
          container.classList.add("cursor-zoom-in-mode");
        } else {
          container.classList.add("cursor-report-mode");
        }
      }
    };

    // 최초 실행 및 이벤트 리스너 등록
    updateCursor();
    map.on("zoomend", updateCursor);

    return () => {
      map.off("zoomend", updateCursor);
      container.classList.remove("cursor-report-mode");
      container.classList.remove("cursor-zoom-in-mode");
    };
  }, [active, map]);

  return null;
}

// 지도 줌 리스너 및 클릭 감지 핸들러 통합
interface MapEventsHandlerProps {
  onZoomChange: (zoom: number) => void;
  onMapClick: (lat: number, lng: number, zoom: number) => void;
}

function MapEventsHandler({ onZoomChange, onMapClick }: MapEventsHandlerProps) {
  const { setMapZoom, setMapCenter, resetFeedSelections, setIsMobileFeedOpen } = useScamMapStore();
  const prevZoomRef = useRef<number | null>(null);

  const map = useMapEvents({
    zoomend() {
      const z = map.getZoom();
      // 사용자가 마커를 고른 뒤 지도를 축소하면 피드를 닫음. 검색·내 주변 이동으로 줌이 바뀐 경우와 내 주변 목록은 유지한다
      const state = useScamMapStore.getState();
      const isUserZoom = z !== state.mapZoom;
      if (isUserZoom && prevZoomRef.current !== null && z < prevZoomRef.current && state.selectedRegionId && !state.nearby && !state.sightingPick) {
        resetFeedSelections();
        setIsMobileFeedOpen(false);
      }
      prevZoomRef.current = z;
      onZoomChange(z);
      setMapZoom(z);
    },
    moveend() {
      const center = map.getCenter();
      setMapCenter([center.lat, center.lng]);
    },
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng, map.getZoom());
    },
  });
  return null;
}

export default function ReadyBeforeGoMap() {
  const { t, lang } = useTranslation();
  const {
    mapCenter,
    mapZoom,
    selectedCountryCode,
    selectedCityId,
    selectedRegionId,
    selectedRegion,
    nearby,
    setNearby,
    highlightedRegionId,
    focusedScamId,
    sightingPick,
    setSightingPick,
    setSelectedRegionId,
    setSelectedRegion,
    setSelectedCityId,
    setSelectedCountryCode,
    setMapCenter,
    setMapZoom,
    reportCoords,
    isReportMode,
    setIsReportMode,
    setReportCoords,
    isReportModalOpen,
    setReportModalOpen,
    isMobileFeedOpen,
    setIsMobileFeedOpen,
    resetFeedSelections,
    setReportType,
    geoData,
    setGeoData,
    isGeocodeConfirmModalOpen,
    setGeocodeConfirmModalOpen,
    isReportConfirmModalOpen,
    setReportConfirmModalOpen,
    filterReportType,
    setFilterReportType,
    isItemReportTypeModalOpen,
    setItemReportTypeModalOpen,
    setItemReportType,
  } = useScamMapStore();

  const [currentZoom, setCurrentZoom] = useState(mapZoom);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isMapGeocoding, setIsMapGeocoding] = useState(false);
  const [isEscConfirmOpen, setIsEscConfirmOpen] = useState(false);
  const [sightingCoords, setSightingCoords] = useState<[number, number] | null>(null);
  const [sightingWhen, setSightingWhen] = useState<SightingWhen | null>(null);
  const [sightingEarlierMonth, setSightingEarlierMonth] = useState("");
  const [sightingExactDate, setSightingExactDate] = useState("");
  const [sightingFarNotice, setSightingFarNotice] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: sightings = [] } = useQuery<ScamSighting[]>({
    queryKey: ["scam-sightings", focusedScamId],
    queryFn: () => scamsApi.getSightings(focusedScamId!),
    enabled: !!focusedScamId,
  });

  const saveSightingMutation = useMutation({
    mutationFn: (data: { scamId: string; sighting: ScamSighting }) => scamsApi.saveSighting(data.scamId, data.sighting),
    onSuccess: (_result, { scamId }) => {
      toast.success("겪은 위치를 기록했습니다. 다른 여행자에게 도움이 됩니다.");
      queryClient.invalidateQueries({ queryKey: ["scams"] });
      queryClient.invalidateQueries({ queryKey: ["scam-sightings", scamId] });
      setSightingPick(null);
    },
    onError: (error: any) => {
      console.error("Save sighting error:", error);
    },
  });

  // 새로 기록을 시작하면 이전에 고른 위치와 날짜를 비운다. 날짜에 기본값을 두지 않아 뒤늦은 기록이 오늘로 저장되지 않게 한다
  useEffect(() => {
    setSightingCoords(null);
    setSightingWhen(null);
    setSightingEarlierMonth("");
    setSightingExactDate("");
    setSightingFarNotice(null);
  }, [sightingPick]);

  const resolvedSightingDate = resolveSightingDate(sightingWhen, {
    earlierMonth: sightingEarlierMonth,
    exactDate: sightingExactDate,
  });

  const isTooFarForSighting = (point: [number, number]) =>
    !!sightingPick?.anchor && distanceMeters(sightingPick.anchor.center, point) > sightingPick.anchor.maxDistanceM;

  const chooseSightingPoint = (point: [number, number]) => {
    if (isTooFarForSighting(point)) {
      setSightingCoords(null);
      setSightingFarNotice("이 장소에서 너무 먼 위치예요. 실제로 겪은 곳 근처를 눌러 주세요.");
      return;
    }
    setSightingFarNotice(null);
    setSightingCoords(point);
  };

  useEffect(() => {
    if (!sightingPick) return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSightingPick(null);
    };
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [sightingPick, setSightingPick]);

  const pickCurrentLocationForSighting = () => {
    if (!navigator.geolocation) {
      toast.error("이 브라우저에서는 현재 위치 기능을 지원하지 않습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point: [number, number] = [coords.latitude, coords.longitude];
        // 여행에서 돌아와 기록하는 경우 지금 위치는 겪은 곳이 아니므로 지도를 옮기지 않고 안내만 한다
        if (isTooFarForSighting(point)) {
          setSightingCoords(null);
          setSightingFarNotice("지금 계신 곳은 이 장소에서 멀어요. 지도에서 겪은 위치를 눌러 주세요.");
          return;
        }
        setSightingFarNotice(null);
        setSightingCoords(point);
        setMapCenter(point);
        setMapZoom(16);
      },
      () => toast.error("현재 위치를 찾지 못했습니다. 지도에서 직접 눌러 주세요."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };
  const [isLegendOpen, setIsLegendOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 640;
    }
    return false;
  });
  
  // 임시 제보 마커 참조 레퍼런스
  const markerRef = useRef<L.Marker>(null);

  // 지도 위 제보 데이터 로딩 상태 피드백 관리 📍
  const [showStatusNotice, setShowStatusNotice] = useState(false);
  const [statusNoticeType, setStatusNoticeType] = useState<"loading" | "loaded" | null>(null);
  const prevLoadingRef = useRef(false);

  // ESC 키 감지 리스너 (위치 지정 및 확인 단계 대응)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isReportConfirmModalOpen) {
          // '제보 위치 확인' 팝업창이 뜬 상태에서 ESC 누르면 취소(아니오) 처리하여 상태 동기화
          e.preventDefault();
          setGeocodeConfirmModalOpen(false);
          setReportConfirmModalOpen(false);
          setReportCoords(null);
        } else if (
          isReportMode &&
          !isReportModalOpen &&
          !isGeocodeConfirmModalOpen &&
          !isEscConfirmOpen
        ) {
          e.preventDefault();
          setIsEscConfirmOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isReportMode,
    isReportConfirmModalOpen,
    isReportModalOpen,
    isGeocodeConfirmModalOpen,
    isEscConfirmOpen,
    setGeocodeConfirmModalOpen,
    setReportConfirmModalOpen,
    setReportCoords,
  ]);

  // Sync state when store mapZoom updates
  useEffect(() => {
    setCurrentZoom(mapZoom);
  }, [mapZoom]);

  // 주소 매칭 컨펌 모달이 켜지거나 임시 핀 좌표가 잡혔을 때 바로 팝업창을 즉각 강제 오픈 🛡️
  useEffect(() => {
    if (isReportConfirmModalOpen && reportCoords && markerRef.current) {
      const timer = setTimeout(() => {
        markerRef.current?.openPopup();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isReportConfirmModalOpen, reportCoords]);

  const { data: regions = [], isLoading: isRegionsLoading, isFetching: isRegionsFetching } = useQuery<Region[]>({
    queryKey: ["scam-regions"],
    queryFn: () => scamsApi.getAllRegions(),
    staleTime: 5 * 60 * 1000, // 5분간 fresh 캐시 유지
    gcTime: 30 * 60 * 1000,
  });

  const nearbyRadiusM = nearby ? findNearbyRegions(nearby.center, regions).radiusM : null;

  // 지도 마커 데이터 로딩 피드백 감지 및 자동 전환 🛡️
  useEffect(() => {
    const isFetching = isRegionsLoading || (isRegionsFetching && regions.length === 0);
    if (isFetching) {
      setStatusNoticeType("loading");
      setShowStatusNotice(true);
      prevLoadingRef.current = true;
    } else if (prevLoadingRef.current && !isRegionsFetching) {
      prevLoadingRef.current = false;
      setStatusNoticeType("loaded");
      setShowStatusNotice(true);
      const timer = setTimeout(() => {
        setShowStatusNotice(false);
      }, 2400);
      return () => clearTimeout(timer);
    }
  }, [isRegionsLoading, isRegionsFetching, regions.length]);

  // 줌 레벨별 병합 기준 반경 설정 (위경도 단위 차이)
  const getThresholdForZoom = (zoom: number) => {
    if (zoom <= 3) return 15.0;     // 대륙 스케일
    if (zoom === 4) return 6.0;      // 넓은 국가 스케일
    if (zoom === 5) return 2.5;      // 국가 스케일 (서울-부산 320km 분리)
    if (zoom === 6) return 1.2;      // 남한 전체 스케일
    if (zoom === 7) return 0.5;      // 광역 스케일
    if (zoom === 8) return 0.25;     // 시/도 스케일
    if (zoom === 9) return 0.12;     // 세부 시내 스케일
    if (zoom === 10) return 0.05;    // 구 스케일 (마커 라벨 겹침 방지 🛡️)
    if (zoom === 11) return 0.025;   // 동 스케일
    if (zoom === 12) return 0.012;   // 세부 구/동 스케일
    if (zoom === 13) return 0.006;
    if (zoom === 14) return 0.003;
    if (zoom === 15) return 0.0015;
    if (zoom === 16) return 0.0006;
    if (zoom === 17) return NEARBY_LOCATION_THRESHOLD;
    return NEARBY_LOCATION_THRESHOLD; // 줌 18 이상에서도 동일한 근접 장소 임계값(0.00025) 적용 🎯
  };

  // 모든 줌 레벨 통합 동적 클러스터러
  const getDynamicClusters = () => {
    const activeRegions = regions.filter((r) => (r.scamCount || 0) > 0);

    // A. 대형 스케일 (zoom <= 5): 국가 단위 강제 그룹화
    if (currentZoom <= 5) {
      const countryGroups: Record<string, Region[]> = {};
      activeRegions.forEach((r) => {
        const code = r.countryCode || "ETC";
        if (!countryGroups[code]) countryGroups[code] = [];
        countryGroups[code].push(r);
      });

      return Object.entries(countryGroups).map(([code, group]) => {
        const totalScamCount = group.reduce((sum, r) => sum + (r.scamCount || 0), 0);
        const totalCautionCount = group.reduce((sum, r) => sum + (r.cautionCount || 0), 0);
        const totalTipCount = group.reduce((sum, r) => sum + (r.tipCount || 0), 0);
        const name = getCountryName(code, lang) || code;
        
        let lat = group.reduce((sum, r) => sum + r.latitude, 0) / group.length;
        let lng = group.reduce((sum, r) => sum + r.longitude, 0) / group.length;
        if (COUNTRY_COORDS[code]) {
          [lat, lng] = COUNTRY_COORDS[code];
        }

        return {
          id: `country-${code}`,
          name,
          latitude: lat,
          longitude: lng,
          scamCount: totalScamCount,
          cautionCount: totalCautionCount,
          tipCount: totalTipCount,
          isCluster: true,
          scope: "country" as const,
          countryCode: code,
          regions: group,
        };
      });
    }

    // B. 중형 스케일 (5 < zoom <= 9): 도시 단위 강제 그룹화 (동일 도시명/ID 통합 🎯)
    if (currentZoom <= 9) {
      const cityGroups: Record<string, Region[]> = {};
      activeRegions.forEach((r) => {
        const cityNameKey = (r.cityName || "").toLowerCase().trim();
        const cid = (r.cityId && r.cityId !== "ETC") ? r.cityId : (cityNameKey || r.countryCode || "ETC");
        if (!cityGroups[cid]) cityGroups[cid] = [];
        cityGroups[cid].push(r);
      });

      return Object.entries(cityGroups).map(([cid, group]) => {
        const totalScamCount = group.reduce((sum, r) => sum + (r.scamCount || 0), 0);
        const totalCautionCount = group.reduce((sum, r) => sum + (r.cautionCount || 0), 0);
        const totalTipCount = group.reduce((sum, r) => sum + (r.tipCount || 0), 0);
        const representative = group[0];
        const cityName = representative.cityName || "기타 도시";

        let lat = group.reduce((sum, r) => sum + r.latitude, 0) / group.length;
        let lng = group.reduce((sum, r) => sum + r.longitude, 0) / group.length;
        
        if (cityName && CITY_COORDS[cityName]) {
          [lat, lng] = CITY_COORDS[cityName];
        }

        return {
          id: `city-${cid}`,
          name: cityName,
          latitude: lat,
          longitude: lng,
          scamCount: totalScamCount,
          cautionCount: totalCautionCount,
          tipCount: totalTipCount,
          isCluster: true,
          scope: "city" as const,
          cityId: cid,
          regions: group,
        };
      });
    }

    // C. 상세 스케일 (zoom > 9): 임계값 기반 거리 클러스터링
    const threshold = getThresholdForZoom(currentZoom);
    const clusters: any[] = [];
    const visited = new Set<string>();

    for (let i = 0; i < activeRegions.length; i++) {
      const r1 = activeRegions[i];
      if (visited.has(r1.id)) continue;

      const group = [r1];
      visited.add(r1.id);

      for (let j = i + 1; j < activeRegions.length; j++) {
        const r2 = activeRegions[j];
        if (visited.has(r2.id)) continue;

        const latDiff = Math.abs(r1.latitude - r2.latitude);
        const lngDiff = Math.abs(r1.longitude - r2.longitude);
        const isSameCountry = r1.countryCode === r2.countryCode;

        const shouldMerge = isSameCountry && (
          (latDiff === 0 && lngDiff === 0) || 
          (latDiff < threshold && lngDiff < threshold)
        );

        if (shouldMerge) {
          group.push(r2);
          visited.add(r2.id);
        }
      }

      if (group.length === 1) {
        clusters.push({
          id: r1.id,
          name: r1.name,
          latitude: r1.latitude,
          longitude: r1.longitude,
          scamCount: r1.scamCount || 0,
          cautionCount: r1.cautionCount || 0,
          tipCount: r1.tipCount || 0,
          isCluster: false,
          scope: r1.hasRegionScope ? "region" : "spot",
          regions: group,
        });
      } else {
        const sumLat = group.reduce((sum, r) => sum + r.latitude, 0);
        const sumLng = group.reduce((sum, r) => sum + r.longitude, 0);
        const totalScamCount = group.reduce((sum, r) => sum + (r.scamCount || 0), 0);
        const totalCautionCount = group.reduce((sum, r) => sum + (r.cautionCount || 0), 0);
        const totalTipCount = group.reduce((sum, r) => sum + (r.tipCount || 0), 0);
        
        const sortedGroup = [...group].sort((a, b) => (b.scamCount || 0) - (a.scamCount || 0));
        const representative = sortedGroup[0];
        
        let displayName = representative.name;
        if (group.length > 1) {
          displayName = `${displayName} 외 ${group.length - 1}`;
        }

        const hasMultipleLocations = group.some(
          (r) => r.latitude !== r1.latitude || r.longitude !== r1.longitude
        );

        const hasRegionWarning = group.some((r) => r.hasRegionScope);

        clusters.push({
          id: `cluster-${r1.id}`,
          name: displayName,
          latitude: sumLat / group.length,
          longitude: sumLng / group.length,
          scamCount: totalScamCount,
          cautionCount: totalCautionCount,
          tipCount: totalTipCount,
          isCluster: true,
          scope: hasRegionWarning ? "region" : "spot",
          hasMultipleLocations,
          regions: group,
        });
      }
    }

    return clusters;
  };

  // 개별 지역 마커 클릭 시
  const handleRegionClick = (region: Region) => {
    setSelectedRegionId(region.id);
    setSelectedRegion(region);
    if (region.cityId) setSelectedCityId(region.cityId);
    if (region.countryCode) setSelectedCountryCode(region.countryCode);
    setMapCenter([region.latitude, region.longitude]);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsMobileFeedOpen(true);
    }
  };

  // 동적 클러스터 마커 클릭 핸들러
  const handleDynamicClusterClick = (cluster: any) => {
    if (sightingPick) {
      chooseSightingPoint([cluster.latitude, cluster.longitude]);
      return;
    }
    if (isReportMode) {
      if (cluster.isCluster) {
        if (currentZoom < 18 && cluster.hasMultipleLocations) {
          setMapCenter([cluster.latitude, cluster.longitude]);
          setMapZoom(Math.min(currentZoom + 2, 18));
          toast.info("마커가 세분화될 때까지 지도를 확대했습니다! 📍 상세 마커를 선택해 주세요.");
        } else {
          const region = cluster.regions[0];
          const confirmReport = window.confirm(`해당 ${region.name}에 추가로 제보를 등록하시겠습니까?`);
          if (confirmReport) {
            setReportType("existing");
            setReportCoords([region.latitude, region.longitude]);
            setSelectedRegionId(region.id);
            setSelectedRegion(region);
            setItemReportTypeModalOpen(true);
          }
        }
      } else {
        const region = cluster.regions[0];
        const confirmReport = window.confirm(`해당 ${region.name}에 추가로 제보를 등록하시겠습니까?`);
        if (confirmReport) {
          setReportType("existing");
          setReportCoords([region.latitude, region.longitude]);
          setSelectedRegionId(region.id);
          setSelectedRegion(region);
          setItemReportTypeModalOpen(true);
        }
      }
    } else {
      if (cluster.scope === "country") {
        setSelectedCountryCode(cluster.countryCode);
        setSelectedCityId(null);
        setSelectedRegionId(null);
        setSelectedRegion(null);
        setMapCenter([cluster.latitude, cluster.longitude]);
        setMapZoom(6);
      } else if (cluster.scope === "city") {
        setSelectedCityId(cluster.cityId);
        setSelectedRegionId(null);
        setSelectedRegion(null);
        const representative = cluster.regions[0];
        if (representative && representative.countryCode) {
          setSelectedCountryCode(representative.countryCode);
        }
        setMapCenter([cluster.latitude, cluster.longitude]);
        setMapZoom(11);
      } else {
        if (cluster.isCluster) {
          if (currentZoom < 18 && cluster.hasMultipleLocations) {
            setMapCenter([cluster.latitude, cluster.longitude]);
            setMapZoom(Math.min(currentZoom + 2, 18));
          } else {
            handleRegionClick(cluster.regions[0]);
          }
        } else {
          handleRegionClick(cluster.regions[0]);
        }
      }
    }
  };

  // 제보 모드 상태에서의 지도 클릭 핸들러
  const handleMapClick = (lat: number, lng: number, zoomVal: number) => {
    if (sightingPick) {
      chooseSightingPoint([lat, lng]);
      return;
    }
    if (isReportMode) {
      if (zoomVal < 18) {
        setMapCenter([lat, lng]);
        setMapZoom(Math.min(zoomVal + 2, 18));
        return;
      }

      // 클릭한 핀 지정 위치가 화면 정가운데로 오도록 지도 중심 이동 📍
      setMapCenter([lat, lng]);

      // 임시 핀 위치를 클릭한 위치로 즉시 옮겨 반응성 향상 📍
      setReportCoords([lat, lng]);

      // 새로운 위치 선택 시 기존 제보 확인 팝업/모달들을 먼저 즉시 강제로 닫음 🚪
      setReportConfirmModalOpen(false);
      setGeocodeConfirmModalOpen(false);

      // [백그라운드 지오코딩 & 우아한 로딩바 🛡️]
      setIsMapGeocoding(true);

      scamsApi.reverseGeocode(lat, lng)
        .then((data: any) => {
          const actualData = data?.data || data;
          if (actualData && actualData.address && Object.keys(actualData.address).length > 0) {
            // 성공 시 스토어 데이터 바인딩 후 지도 컨펌 팝업 기동
            setReportType("new");
            setReportCoords([lat, lng]);
            setGeoData(actualData);
            setReportConfirmModalOpen(true);
          } else {
            // 위치 정보 획득 실패 시, 임시 좌표 얹고 주소 수동 검색 확인 모달 기동
            setReportType("new");
            setReportCoords([lat, lng]);
            setGeocodeConfirmModalOpen(true);
          }
        })
        .catch((err: any) => {
          console.error("Map Geocoding Error:", err);
          // 통신 장애 시에도 주소 수동 검색 확인 모달 기동
          setReportType("new");
          setReportCoords([lat, lng]);
          setGeocodeConfirmModalOpen(true);
        })
        .finally(() => {
          setIsMapGeocoding(false);
        });
    } else {
      // 일반 조회 모드인 경우 ➔ 마커 영역 밖 빈 지도 클릭 시 선택 사항 리셋! (지도 중심과 줌은 유지!)
      resetFeedSelections();
    }
  };

  // 사용자 현재 위치 GPS 탐색 함수 (고정밀 실패 시 저정밀 Fallback 적용 🛡️)
  const handleLocateUser = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error("이 브라우저에서는 현재 위치 기능을 지원하지 않습니다.");
      return;
    }

    toast.loading("현재 위치를 확인하고 있습니다...", { id: "geolocation" });

    const getPosition = (highAccuracy: boolean) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          setMapCenter([latitude, longitude]);
          if (isReportMode) {
            setMapZoom(16);
            toast.success("현재 위치로 이동했습니다! 📍", { id: "geolocation" });
          } else {
            // 줌은 찾은 범위에 맞춰 홈 화면에서 정한다
            setNearby({ center: [latitude, longitude], label: "내 주변", kind: "gps" });
            toast.dismiss("geolocation");
          }
        },
        (error) => {
          console.error(`Geolocation Error (highAccuracy=${highAccuracy}):`, error);
          console.log("에러랑",error.code)
          if (highAccuracy) {
            // 고정밀도 실패 시 저정밀도로 재시도하여 성공률 극대화
            getPosition(false);
          } else {
            if (error.code === error.PERMISSION_DENIED) {
              toast.error("브라우저 위치 접근 권한이 거부되었습니다.", { id: "geolocation" });
            } else if (error.code === error.POSITION_UNAVAILABLE) {
              toast.error("기기 위치 신호가 측정되지 않았습니다. 시간이 조금 지난 뒤 재시도 혹은 지도에서 직접 핀을 찍어주세요.", { id: "geolocation" });
            } else if (error.code === error.TIMEOUT) {
              toast.error("위치 응답 시간이 초과되었습니다. 다시 시도해 주세요.", { id: "geolocation" });
            } else {
              toast.error("현재 위치를 찾을 수 없습니다.", { id: "geolocation" });
            }
          }
        },
        { enableHighAccuracy: highAccuracy, timeout: 15000, maximumAge: 60000 }
      );
    };

    getPosition(true);
  };

  return (
    <div className="h-full w-full relative rounded-2xl overflow-hidden shadow-inner border border-border bg-muted">
      <style>{`
        .cursor-report-mode,
        .cursor-report-mode .leaflet-pane,
        .cursor-report-mode .leaflet-grab,
        .cursor-report-mode .leaflet-interactive,
        .cursor-report-mode .leaflet-marker-icon,
        .cursor-report-mode * {
          cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='%23DC2626' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z'/%3E%3Ccircle cx='12' cy='10' r='3' fill='%23DC2626'/%3E%3C/svg%3E") 16 31, pointer !important;
        }

        .cursor-zoom-in-mode,
        .cursor-zoom-in-mode .leaflet-pane,
        .cursor-zoom-in-mode .leaflet-grab,
        .cursor-zoom-in-mode .leaflet-interactive,
        .cursor-zoom-in-mode .leaflet-marker-icon,
        .cursor-zoom-in-mode * {
          cursor: zoom-in !important;
        }

        /* 팝업 툴팁 안에서는 핀 아이콘이 아닌 일반 마우스 커서 및 포인터로 복원 */
        .cursor-report-mode .leaflet-popup,
        .cursor-report-mode .leaflet-popup *,
        .cursor-zoom-in-mode .leaflet-popup,
        .cursor-zoom-in-mode .leaflet-popup * {
          cursor: auto !important;
        }

        .cursor-report-mode .leaflet-popup button,
        .cursor-report-mode .leaflet-popup a,
        .cursor-report-mode .leaflet-popup [role="button"],
        .cursor-report-mode .leaflet-popup .cursor-pointer,
        .cursor-zoom-in-mode .leaflet-popup button,
        .cursor-zoom-in-mode .leaflet-popup a,
        .cursor-zoom-in-mode .leaflet-popup [role="button"],
        .cursor-zoom-in-mode .leaflet-popup .cursor-pointer {
          cursor: pointer !important;
        }

        @keyframes loaderProgress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 95%; }
        }
        .animate-loader-progress {
          animation: loaderProgress 1.8s ease-in-out infinite alternate;
        }

        /* Leaflet Popup 어두운 테마 오버라이드 🛡️ */
        .leaflet-popup-content-wrapper {
          background: #0f172a !important; /* slate-900 */
          color: #f8fafc !important; /* slate-50 */
          border-radius: 14px !important;
          border: 1px solid #334155 !important; /* slate-700 */
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4) !important;
          padding: 2px !important;
        }
        .leaflet-popup-tip {
          background: #0f172a !important;
          border: 1px solid #334155 !important;
          box-shadow: none !important;
        }
        .leaflet-popup-content {
          margin: 12px 14px !important;
          line-height: inherit !important;
        }

        /* 검색창과 필터 아래에 줌 제어 박스 배치 🛡️ */
        .leaflet-top.leaflet-left {
          top: 116px !important;
        }
      `}</style>

      {/* 우아한 백그라운드 지오코딩 로딩 바 오버레이 🛡️ */}
      {isMapGeocoding && (
        <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[3px] z-[9999] flex flex-col items-center justify-center select-none">
          <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 flex flex-col items-center gap-4 text-center transform scale-100 transition-all duration-300">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <span className="absolute w-10 h-10 rounded-full border border-blue-500/20 animate-ping"></span>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">위치 분석 중</h4>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                선택하신 좌표의 상세 주소 정보를<br />안전하게 분석하고 있습니다.
              </p>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full animate-loader-progress"></div>
            </div>
          </div>
        </div>
      )}

      {/* 모바일/PC 공통 지도 상단 제보 위치 안내 가이드 플로팅 배너 📍 */}
      {isReportMode && !isReportConfirmModalOpen && !isReportModalOpen && !isGeocodeConfirmModalOpen && !isItemReportTypeModalOpen && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-[420px] bg-slate-900/95 dark:bg-slate-950/95 border border-slate-800 text-slate-100 px-4 py-3 rounded-2xl shadow-xl backdrop-blur-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 shrink-0">
              {currentZoom < 18 ? (
                <Search className="w-4 h-4 animate-pulse" />
              ) : (
                <MapPin className="w-4 h-4 animate-bounce" />
              )}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                {currentZoom < 18 ? "지도가 너무 축소됨" : "위치 선택 대기"}
              </span>
              <p className="text-xs font-semibold text-slate-200">
                {currentZoom < 18 
                  ? "정확한 위치를 선택하기 위해 지도를 더 확대하세요"
                  : "제보할 정확한 지점을 지도에서 선택하세요."}
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => {
              setIsReportMode(false);
              setReportCoords(null);
            }}
            className="text-[11px] bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold px-2.5 py-1.5 rounded-lg border border-slate-700 transition-colors shrink-0 active:scale-95 cursor-pointer"
          >
            취소
          </button>
        </div>
      )}

      {/* 지도 위 제보 위치 데이터 로딩 상태 플로팅 뱃지 📍 */}
      {!isReportMode && showStatusNotice && (
        <div className="absolute top-[100px] left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 dark:bg-slate-950/90 text-slate-100 px-4 py-2 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 border border-slate-700/70 select-none pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-top-3 max-w-[calc(100%-8rem)]">
          {statusNoticeType === "loading" ? (
            <>
              <div className="relative flex items-center justify-center shrink-0">
                <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />
              </div>
              <span className="text-xs font-semibold tracking-tight text-slate-200 truncate">
                {lang === "ko" ? "지도 위 제보 위치를 탐색하는 중..." : "Loading report locations..."}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold tracking-tight text-slate-200 truncate">
                {(() => {
                  const activeCount = regions.filter((r) => (r.scamCount || 0) > 0).length;
                  if (activeCount > 0) {
                    return lang === "ko"
                      ? `${activeCount}곳의 제보 위치를 불러왔습니다`
                      : `${activeCount} locations loaded`;
                  }
                  return lang === "ko" ? "등록된 제보 위치가 없습니다" : "No reports registered yet";
                })()}
              </span>
            </>
          )}
        </div>
      )}

      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        className="h-full w-full z-0"
        zoomControl={true}
        minZoom={3}
        maxZoom={18}
        maxBounds={[[-85, -180], [85, 180]]}
        maxBoundsViscosity={1.0}
      >
        {/* 동적 맵 스타일 프로바이더 연동 (Google, Mapbox, OSM) 🎨 */}
        {(() => {
          const provider = process.env.NEXT_PUBLIC_MAP_PROVIDER || "GOOGLE";
          const isGoogle = provider.toUpperCase() === "GOOGLE";
          const isMapbox = provider.toUpperCase() === "MAPBOX";
          const isHighRes = isGoogle || isMapbox;

          // 고해상도 레티나(High-DPI / Retina 2x) 대응 타일 URL 설정 🌟
          let tileUrl = `https://mt1.google.com/vt/lyrs=m&hl=${lang}&x={x}&y={y}&z={z}&scale=2`;
          let attribution = '&copy; <a href="https://maps.google.com">Google Maps</a>';

          if (isMapbox) {
            const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
            // 프로필/i18n 언어(lang) 설정에 따른 Mapbox 다국어 스타일 자동 스위칭 연동 🎯
            const defaultStyle = process.env.NEXT_PUBLIC_MAPBOX_STYLE || "mapbox/streets-v12";
            const koStyle = process.env.NEXT_PUBLIC_MAPBOX_STYLE_KO || defaultStyle;
            const enStyle = process.env.NEXT_PUBLIC_MAPBOX_STYLE_EN || defaultStyle;
            const style = lang === "ko" ? koStyle : enStyle;

            tileUrl = `https://api.mapbox.com/styles/v1/${style}/tiles/512/{z}/{x}/{y}@2x?access_token=${token}`;
            attribution = '&copy; <a href="https://www.mapbox.com/">Mapbox</a>';
          } else if (provider.toUpperCase() === "OSM") {
            tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
            attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
          }

          return (
            <TileLayer
              key={`${provider}-${lang}`}
              attribution={attribution}
              url={tileUrl}
              noWrap={true}
              tileSize={isMapbox ? 512 : 256}
              zoomOffset={isMapbox ? -1 : 0}
              maxZoom={18}
              maxNativeZoom={18}
            />
          );
        })()}
        
        <MapViewHandler center={mapCenter} zoom={mapZoom} />
        <MapCursorHandler active={isReportMode} />
        <MapResizeHandler />
        
        <MapEventsHandler 
          onZoomChange={(zoom) => setCurrentZoom(zoom)} 
          onMapClick={handleMapClick} 
        />

        {/* 제보 중인 임시 타겟 포인트 */}
        {reportCoords && (
          <Marker 
            ref={markerRef}
            position={reportCoords} 
            icon={createTempReportIcon()}
          >
            {isReportConfirmModalOpen && (
              <Popup
                position={reportCoords}
                closeButton={false}
                autoClose={false}
                closeOnClick={false}
                closeOnEscapeKey={false}
                autoPan={false}
              >
                <div className="p-0.5 space-y-2.5 max-w-[220px] text-slate-100 min-w-0">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-extrabold text-blue-400 flex items-center gap-1">
                      🧭 제보 위치 확인
                    </p>
                    <p className="text-[10.5px] font-bold leading-relaxed text-slate-200">
                      지도 위 선택하신 이 위치에 제보하시겠습니까?
                    </p>
                    {geoData && (() => {
                      const getDisplayName = () => {
                        if (geoData.name && geoData.name.trim() !== "") {
                          return geoData.name;
                        }
                        const addr = geoData.address || {};
                        const road = addr.road || addr.street || "";
                        const houseNumber = addr.house_number || "";
                        if (road) {
                          return houseNumber ? `${road} ${houseNumber}` : road;
                        }
                        const parts = geoData.display_name.split(",").map((p: string) => p.trim());
                        const validPart = parts.find((p: string) => p && !/^\d+$/.test(p));
                        return validPart || parts[0] || "지정된 위치";
                      };
                      return (
                        <p className="text-[9.5px] font-medium text-slate-300 bg-slate-950/60 border border-slate-800/80 p-1.5 rounded-md mt-1 truncate block w-full">
                          {getDisplayName()}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="flex gap-1.5 pt-1 w-full flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        L.DomEvent.stopPropagation(e.nativeEvent);
                        setGeocodeConfirmModalOpen(false);
                        setReportConfirmModalOpen(false);
                        setReportCoords(null);
                      }}
                      className="flex-1 py-1 px-2 border border-slate-700 text-slate-300 rounded text-[10px] font-semibold hover:bg-slate-800 cursor-pointer text-center bg-transparent transition-colors"
                      type="button"
                    >
                      아니오
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        L.DomEvent.stopPropagation(e.nativeEvent);
                        setReportConfirmModalOpen(false);
                        setItemReportTypeModalOpen(true);
                      }}
                      className="flex-1 py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold cursor-pointer text-center transition-colors"
                      type="button"
                    >
                      예
                    </button>
                  </div>
                </div>
              </Popup>
            )}
          </Marker>
        )}

        {/* 고르는 중인 겪은 위치 */}
        {sightingPick && sightingCoords && (
          <Marker position={sightingCoords} icon={createTempReportIcon()} interactive={false} zIndexOffset={3000} />
        )}

        {/* 펼친 주의사항을 겪은 사람들의 위치 */}
        {focusedScamId && !sightingPick && <SightingsFitHandler sightings={sightings} onFit={(center, zoom) => {
          setMapCenter(center);
          setMapZoom(zoom);
        }} />}
        {focusedScamId && sightings.map((sighting, index) => (
          <CircleMarker
            key={`sighting-${sighting.latitude}-${sighting.longitude}-${index}`}
            center={[sighting.latitude, sighting.longitude]}
            radius={7}
            interactive={false}
            pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#dc2626", fillOpacity: 0.85 }}
          />
        ))}

        {/* 사용자 현재 위치 마커 (이벤트 클릭 투과 & 하위 zIndex 레이어 설정 🛡️) */}
        {userLocation && (
          <Marker 
            position={userLocation} 
            icon={createUserLocationIcon()} 
            interactive={false}
            zIndexOffset={-500}
          />
        )}

        {/* 내 주변 또는 검색한 장소 주변으로 찾은 범위 */}
        {nearby && nearbyRadiusM !== null && (
          <Circle
            center={nearby.center}
            radius={nearbyRadiusM}
            interactive={false}
            pathOptions={{ fillColor: "#3b82f6", fillOpacity: 0.06, color: "#2563eb", weight: 1.5, dashArray: "6, 6" }}
          />
        )}

        {/* 호객꾼처럼 이동하는 주의사항은 한 점이 아니라 구역으로 그린다 */}
        {currentZoom >= 13 && regions
          .filter((r) => r.hasRegionScope && (r.scamCount || 0) > 0)
          .map((r) => {
            const isActive = r.id === selectedRegionId || r.id === highlightedRegionId;
            return (
              <Circle
                key={`area-${r.id}`}
                center={[r.latitude, r.longitude]}
                radius={REGION_AREA_RADIUS_M}
                interactive={false}
                pathOptions={{
                  fillColor: "#a855f7",
                  fillOpacity: isActive ? 0.24 : 0.12,
                  color: "#c026d3",
                  weight: isActive ? 2 : 1,
                  dashArray: "4, 6",
                }}
              />
            );
          })}

        {/* 동적 통합 클러스터 렌더링 (제보 마커를 내 위치보다 최상위 zIndex로 레이어링) */}
        {getDynamicClusters()
          .filter((cluster) => {
            if (filterReportType === "ALL") return true;
            if (filterReportType === "CAUTION") return (cluster.cautionCount || 0) > 0;
            if (filterReportType === "TIP") return (cluster.tipCount || 0) > 0;
            return true;
          })
          .map((cluster) => {
            const isSelected = cluster.regions.some((r: any) => r.id === selectedRegionId || r.id === highlightedRegionId);

            // 필터 활성화 시 해당 타입의 count만 표시, 전체일 때는 총 scamCount
            let displayCount = cluster.scamCount;
            if (filterReportType === "CAUTION") displayCount = cluster.cautionCount || 0;
            else if (filterReportType === "TIP") displayCount = cluster.tipCount || 0;

            // 마커 아이콘 색상: 필터 활성화 시 해당 타입, 전체일 때는 다수 타입 기준
            let dominantType: "CAUTION" | "TIP" | "INFO" = "CAUTION";
            if (filterReportType === "TIP") {
              dominantType = "TIP";
            } else if (filterReportType === "ALL") {
              dominantType = (cluster.tipCount || 0) > (cluster.cautionCount || 0) ? "TIP" : "CAUTION";
            }

            return (
              <Marker
                key={cluster.id}
                position={[cluster.latitude, cluster.longitude]}
                icon={createClusterIcon(
                  cluster.name,
                  cluster.cautionCount || 0,
                  cluster.tipCount || 0,
                  isSelected,
                  filterReportType,
                  // 국가·도시처럼 넓게 묶인 마커는 여러 유형이 섞이므로 지역 단위에서만 유형을 보여 준다
                  currentZoom > 9 ? topCategoryIcons(cluster.regions) : ""
                )}
                zIndexOffset={isSelected ? 2000 : 1000}
                eventHandlers={{
                  click: () => handleDynamicClusterClick(cluster),
                }}
              />
            );
          })}
      </MapContainer>

      {/* 제보 위치를 고를 때 쓰는 현재 위치 이동 버튼 */}
      {isReportMode && (
        <button
          onClick={handleLocateUser}
          className="absolute top-[76px] left-[10px] z-[1000] w-[34px] h-[34px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px] shadow flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 active:scale-95 cursor-pointer transition-all duration-200"
          title="현재 위치로 이동"
        >
          <Locate className="w-4.5 h-4.5" />
        </button>
      )}

      {/* 겪은 위치 기록 안내 */}
      {sightingPick && (
        <div className="absolute inset-x-2.5 top-2.5 z-[1200] mx-auto max-w-md space-y-2.5 rounded-2xl border border-border bg-card p-3.5 text-card-foreground shadow-2xl">
          <div>
            <p className="text-sm font-bold">
              {sightingCoords ? "이 위치가 맞나요? 다른 곳을 눌러 바꿀 수 있어요" : "이 일을 겪은 위치를 지도에서 눌러 주세요"}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{sightingPick.title}</p>
          </div>
          {sightingFarNotice && (
            <p role="alert" className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              {sightingFarNotice}
            </p>
          )}

          <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer text-xs" onClick={pickCurrentLocationForSighting}>
            <Locate className="h-3.5 w-3.5" aria-hidden="true" />
            지금 현지에 있어요 (현재 위치)
          </Button>

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-semibold">언제 겪으셨나요?</legend>
            <div className="flex flex-wrap gap-1.5">
              {SIGHTING_WHEN_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={sightingWhen === option.value}
                  onClick={() => setSightingWhen(option.value)}
                  className={`h-8 cursor-pointer rounded-full border px-2.5 text-xs font-semibold transition-colors ${
                    sightingWhen === option.value
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {sightingWhen === "earlier" && (
              <select
                aria-label="겪은 달"
                value={sightingEarlierMonth}
                onChange={(event) => setSightingEarlierMonth(event.target.value)}
                className="h-9 w-full cursor-pointer rounded-lg border border-border bg-background px-2 text-base md:text-xs"
              >
                <option value="">몇 월쯤인지 골라 주세요</option>
                {earlierMonthOptions().map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            )}
            {sightingWhen === "exact" && (
              <input
                type="date"
                aria-label="겪은 날짜"
                value={sightingExactDate}
                max={formatLocalDate(new Date())}
                onChange={(event) => setSightingExactDate(event.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-2 text-base md:text-xs"
              />
            )}
          </fieldset>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">약 100m 단위의 위치와 날짜만 공개됩니다.</p>
            <div className="flex shrink-0 gap-1.5">
              <Button type="button" variant="ghost" size="sm" className="h-8 cursor-pointer text-xs" onClick={() => setSightingPick(null)}>
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!sightingCoords || !resolvedSightingDate || saveSightingMutation.isPending}
                className="h-8 cursor-pointer bg-red-600 text-xs font-bold text-white hover:bg-red-700"
                onClick={() => {
                  if (!sightingCoords || !resolvedSightingDate) return;
                  saveSightingMutation.mutate({
                    scamId: sightingPick.scamId,
                    sighting: { latitude: sightingCoords[0], longitude: sightingCoords[1], ...resolvedSightingDate },
                  });
                }}
              >
                기록하기
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 현지에서 내 주변 주의사항을 바로 확인하는 버튼 */}
      {!isReportMode && !sightingPick && (
        <button
          type="button"
          onClick={handleLocateUser}
          className={`absolute bottom-[84px] md:bottom-6 left-1/2 -translate-x-1/2 z-[1000] h-11 md:flex ${isMobileFeedOpen ? "hidden" : "flex"} items-center gap-2 whitespace-nowrap rounded-full bg-blue-600 px-5 text-sm font-bold text-white shadow-xl transition-all hover:bg-blue-700 active:scale-95 cursor-pointer`}
        >
          <Navigation className="h-4 w-4" aria-hidden="true" />
          내 주변 주의사항
        </button>
      )}

      {/* 지도 상단 퀵 필터 토글 칩 오버레이 🧭 */}
      <div className={`absolute top-[60px] left-[10px] z-[1000] items-center gap-1.5 bg-slate-900/90 ${isReportMode || sightingPick ? "hidden" : "flex"} backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-lg text-xs`}>
        <button
          type="button"
          onClick={() => setFilterReportType("ALL")}
          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
            filterReportType === "ALL"
              ? "bg-white text-slate-900 shadow"
              : "text-slate-300 hover:text-white hover:bg-white/10"
          }`}
        >
          🌐 전체
        </button>

        <button
          type="button"
          onClick={() => setFilterReportType("CAUTION")}
          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
            filterReportType === "CAUTION"
              ? "bg-red-600 text-white shadow ring-2 ring-red-400/40"
              : "text-red-300 hover:bg-red-950/40"
          }`}
        >
          <span>⚠️</span>
          <span>주의/위험만</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterReportType("TIP")}
          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
            filterReportType === "TIP"
              ? "bg-amber-500 text-white shadow ring-2 ring-amber-400/40"
              : "text-amber-300 hover:bg-amber-950/40"
          }`}
        >
          <span>💡</span>
          <span>사전 꿀팁만</span>
        </button>
      </div>

      {/* ESC 키 제보 위치 선택 취소 확인 모달 🛑 */}
      <Dialog open={isEscConfirmOpen} onOpenChange={setIsEscConfirmOpen}>
        <DialogContent className="w-[90%] max-w-[360px] p-5 rounded-2xl bg-card border border-border shadow-2xl z-[99999]">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-base font-extrabold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              🛑 제보 위치 선택 중단
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              제보 위치 선택을 중단하시겠습니까? 현재 선택 중이던 위치 정보가 초기화됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2.5 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsEscConfirmOpen(false)}
              className="flex-1 text-xs font-semibold h-9 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer"
            >
              아니오
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setIsEscConfirmOpen(false);
                setIsReportMode(false);
                setReportCoords(null);
              }}
              className="flex-1 text-xs font-bold h-9 rounded-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer"
            >
              예
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 제보 성격(유형) 선택 모달 🎯 */}
      <Dialog open={isItemReportTypeModalOpen} onOpenChange={setItemReportTypeModalOpen}>
        <DialogContent className="w-[90%] max-w-[380px] p-6 rounded-2xl bg-card border border-border shadow-2xl z-[99999]">
          <DialogHeader className="space-y-1.5 text-center">
            <DialogTitle className="text-lg font-black tracking-tight text-foreground flex items-center justify-center gap-1.5">
              제보 유형 선택
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground text-center">
              등록하실 제보의 정보 성격을 선택해 주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 pt-2">
            {/* ⚠️ 주의 / 위험 제보 선택 카드 */}
            <button
              type="button"
              onClick={() => {
                setItemReportType("CAUTION");
                setItemReportTypeModalOpen(false);
                setReportModalOpen(true);
              }}
              className="flex items-start gap-3.5 p-4 rounded-xl border-2 border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/60 dark:hover:bg-red-950/40 text-left transition-all cursor-pointer group shadow-sm hover:shadow"
            >
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                ⚠️
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="text-sm font-bold text-red-700 dark:text-red-300">⚠️ 주의 / 위험 제보</h4>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                  해당 지역 방문 시 유의할 위험/주의 정보 (소매치기, 바가지 요금, 사기 등)를 제보합니다.
                </p>
              </div>
            </button>

            {/* 💡 사전 꿀팁 공유 선택 카드 */}
            <button
              type="button"
              onClick={() => {
                setItemReportType("TIP");
                setItemReportTypeModalOpen(false);
                setReportModalOpen(true);
              }}
              className="flex items-start gap-3.5 p-4 rounded-xl border-2 border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/40 text-left transition-all cursor-pointer group shadow-sm hover:shadow"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                💡
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-300">💡 사전 꿀팁 공유</h4>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                  해당 지역 방문 시 도움이 될 사전 정보 (예약/패스 팁, 촬영 포인트, 로컬 맛집 등)를 공유합니다.
                </p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 범례 플로팅 카드 (Map Legend) 🗺️ */}
      <div className="absolute bottom-20 right-3 sm:bottom-4 sm:right-4 z-[1000] select-none">
        {isLegendOpen ? (
          <div className="bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-md border border-slate-200/10 text-slate-100 rounded-2xl p-3 shadow-2xl flex flex-col gap-2 w-[175px] animate-in fade-in slide-in-from-bottom-2 duration-300 text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                마커 범례
              </span>
              <button
                onClick={() => setIsLegendOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer text-xs font-bold leading-none p-0.5"
                title="범례 닫기"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-500 to-rose-700 border border-white/20 shrink-0 flex items-center justify-center text-[9px]">⚠️</div>
                <span className="font-semibold text-slate-200">주의/위험</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 border border-white/20 shrink-0 flex items-center justify-center text-[9px]">💡</div>
                <span className="font-semibold text-slate-200">사전 꿀팁</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-purple-500/25 border border-dashed border-fuchsia-400 shrink-0"></div>
                <span className="font-semibold text-slate-200">자주 나타나는 구역</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 flex items-center justify-center shrink-0"><div className="w-3 h-3 rounded-full bg-red-600 border border-white"></div></div>
                <span className="font-semibold text-slate-200">겪은 위치</span>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsLegendOpen(true)}
            className="w-9 h-9 bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-md border border-slate-200/10 rounded-xl shadow-lg flex items-center justify-center text-slate-200 hover:text-white hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
            title="범례 보기"
          >
            🗺️
          </button>
        )}
      </div>
    </div>
  );
}
