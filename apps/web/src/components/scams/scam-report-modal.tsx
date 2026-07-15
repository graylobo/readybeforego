"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useScamMapStore } from "@/lib/stores/scam-map.store";
import { useTranslation } from "@/hooks/use-translation";
import { scamsApi, Country, City, Region, ScamInfo } from "@/lib/api/scams";
import { uploadsApi } from "@/lib/api/uploads";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PlusCircle, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCountryName } from "@/lib/utils/country";

const CATEGORY_ITEMS = [
  { value: "FORCED_SHOPPING", tKey: "categories.FORCED_SHOPPING" },
  { value: "DRUG_HAZARD", tKey: "categories.DRUG_HAZARD" },
  { value: "LIES_TOURISM", tKey: "categories.LIES_TOURISM" },
  { value: "FAKE_TAXI", tKey: "categories.FAKE_TAXI" },
  { value: "OVERCHARGING", tKey: "categories.OVERCHARGING" },
];

export function ScamReportModal() {
  const queryClient = useQueryClient();
  const { t, lang } = useTranslation();
  const {
    selectedCountryCode,
    selectedCityId,
    reportCoords,
    isReportModalOpen,
    setReportModalOpen,
    setReportCoords,
    setIsReportMode,
    setSelectedRegionId,
    setMapCenter,
    setMapZoom,
    reportType,
    setReportType,
    selectedRegionId,
    selectedRegion,
    geoData,
  } = useScamMapStore();

  const [countryCode, setCountryCode] = useState("");
  const [cityId, setCityId] = useState("");
  const [regionName, setRegionName] = useState("");
  const [scamCategory, setScamCategory] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [avoidanceTip, setAvoidanceTip] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // 로컬 상태로 regionId만 관리
  const [regionId, setRegionId] = useState("");

  // Dynamic Reverse Geocoding States
  const [detectedCountryName, setDetectedCountryName] = useState("");
  const [detectedCountryCode, setDetectedCountryCode] = useState("");
  const [detectedCityName, setDetectedCityName] = useState("");
  const [isLoadingGeo, setIsLoadingGeo] = useState(false);

  // Form Inline Validation Error States
  const [errors, setErrors] = useState<Record<string, string>>({});

  // useQuery hooks moved here to be referenced inside useEffect
  const { data: countries = [] } = useQuery<Country[]>({
    queryKey: ["countries"],
    queryFn: () => scamsApi.getCountries(),
    enabled: isReportModalOpen,
  });

  const { data: cities = [], isPending: isCitiesPending } = useQuery<City[]>({
    queryKey: ["cities", countryCode],
    queryFn: () => scamsApi.getCities(countryCode),
    enabled: isReportModalOpen && !!countryCode,
  });

  const { data: cityRegions = [], isPending: isRegionsPending } = useQuery<Region[]>({
    queryKey: ["city-regions", cityId],
    queryFn: () => scamsApi.getRegions(cityId),
    enabled: isReportModalOpen && !!cityId && cityId !== "NEW_CITY",
  });

  useEffect(() => {
    if (isReportModalOpen) {
      setRegionName("");
      setScamCategory("");
      setSelectedCats([]);
      setTitle("");
      setDescription("");
      setAvoidanceTip("");
      setSourceUrl("");
      setImageFiles([]);
      setImagePreviews([]);
      setUploading(false);
      setErrors({});

      if (reportType === "existing" && selectedRegionId) {
        setRegionId(selectedRegionId);
        if (selectedRegion) {
          if (selectedRegion.countryCode) setCountryCode(selectedRegion.countryCode);
          if (selectedRegion.cityId) setCityId(selectedRegion.cityId);
        }
      } else {
        setRegionId("");
        setCountryCode("");
        setCityId("");
      }
      
      // A. 신규 핀 제보인 경우에만 cached geoData 파싱
      if (reportType === "new" && geoData) {
        setIsLoadingGeo(true);
        try {
          const addr = geoData.address || {};
          const country = addr.country || "기타 국가";
          const countryCodeVal = (addr.country_code || "ETC").toUpperCase();
          const city = addr.city || addr.province || addr.state || addr.region || addr.town || addr.village || addr.city_district || addr.state_district || addr.county || "기타 도시";

          // 1. 광역/기초 자치단체 필터 함수 정의
          const isBroadArea = (name: string) => {
            if (!name) return true;
            const isGenericName = 
              name.toLowerCase() === country.toLowerCase() || 
              name.toLowerCase() === city.toLowerCase() ||
              /^\d+$/.test(name) ||
              name.includes("대한민국") ||
              name.includes("Korea") ||
              name === "기타 지역";
            
            const isDistrictOrCounty = 
              /^[a-zA-Z0-9가-힣\s\-]{1,10}(구|군|시)$/.test(name) ||
              name.toLowerCase().endsWith("gu") ||
              name.toLowerCase().endsWith("gun") ||
              name.toLowerCase().endsWith("si") ||
              name.toLowerCase().includes("district") ||
              name.toLowerCase().includes("county");

            return isGenericName || isDistrictOrCounty;
          };

          // 2. 1순위: address 내부의 구체적인 지상 지물/랜드마크 태그 추출
          const landmark = addr.amenity || addr.tourism || addr.historic || addr.attraction || addr.place || addr.religion || addr.shop || addr.building || "";
          
          // 만약 1순위 지물이 광범위 행정구역이 아니라면 바로 채택!
          if (landmark && !isBroadArea(landmark)) {
            setRegionName(landmark);
          } else {
            // 3. 2순위 (폴백): display_name의 첫 토큰 또는 data.name 추출 (기장읍, 용호동, 시랑리 등)
            let fallbackName = "";
            if (geoData.name) {
              fallbackName = geoData.name;
            } else if (geoData.display_name) {
              const parts = geoData.display_name.split(",");
              if (parts.length > 0) {
                fallbackName = parts[0].trim();
              }
            }

            // 2순위 지물이 광범위 행정구역이 아니라면 채택!
            if (fallbackName && !isBroadArea(fallbackName)) {
              setRegionName(fallbackName);
            } else {
              // 4. 3순위 (동/리/도로명 폴백): address 내부의 상세 세부 지명 추출 (neighbourhood, suburb, road 등)
              const subLandmark = addr.neighbourhood || addr.suburb || addr.road || "";
              if (subLandmark && !isBroadArea(subLandmark)) {
                setRegionName(subLandmark);
              } else {
                setRegionName("");
              }
            }
          }

          setDetectedCountryName(country);
          setDetectedCountryCode(countryCodeVal);
          setDetectedCityName(city);

          // 기등록 국가 목록 매칭 검사
          const existingCountry = countries.find(c => c.code === countryCodeVal);
          if (existingCountry) {
            setCountryCode(existingCountry.code);
            
            // 해당 국가의 기등록 도시 목록 비동기 매칭
            scamsApi.getCities(existingCountry.code)
              .then((cityList: City[]) => {
                const matchedCity = cityList.find((c: any) => 
                  c.name.includes(city) || city.includes(c.name)
                );
                if (matchedCity) {
                  setCityId(matchedCity.id);
                } else {
                  setCityId("NEW_CITY");
                }
              })
              .catch(() => {
                setCityId("NEW_CITY");
              });
          } else {
            setCountryCode("NEW_COUNTRY");
            setCityId("NEW_CITY");
          }
        } catch (err) {
          console.error("Geocoding Parsing Error:", err);
          setCountryCode("");
          setCityId("");
        } finally {
          setIsLoadingGeo(false);
        }
      } else if (reportType === "new") {
        setCountryCode("");
        setCityId("");
        setDetectedCountryName("");
        setDetectedCountryCode("");
        setDetectedCityName("");
        setIsLoadingGeo(false);
      } else {
        // B. 기존 장소 목록 제보인 경우: 현재 맵 및 스토어에 바인딩된 국가/도시를 프리필하여 세팅
        setCountryCode(selectedCountryCode || "");
        setCityId(selectedCityId || "");
        setDetectedCountryName("");
        setDetectedCountryCode("");
        setDetectedCityName("");
        setIsLoadingGeo(false);
      }
    }
  }, [isReportModalOpen, reportCoords, reportType, selectedCountryCode, selectedCityId, countries, geoData]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  const createMutation = useMutation<ScamInfo, Error, Parameters<typeof scamsApi.createScam>[0]>({
    mutationFn: (data: Parameters<typeof scamsApi.createScam>[0]) => scamsApi.createScam(data),
    onSuccess: (newScam) => {
      toast.success(t("report_modal.submit") + " " + "성공");
      
      queryClient.invalidateQueries({ queryKey: ["scam-regions"] });
      queryClient.invalidateQueries({ queryKey: ["scams"] });
      if (cityId) {
        queryClient.invalidateQueries({ queryKey: ["regions", cityId] });
      }

      setReportModalOpen(false);
      setReportCoords(null);
      setIsReportMode(false);
      setImageFiles([]);
      setImagePreviews([]);
      setUploading(false);

      if (newScam.regionId) {
        setSelectedRegionId(newScam.regionId);
        if (reportCoords) {
          setMapCenter(reportCoords);
          setMapZoom(15);
        }
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || "Error";
      toast.error(msg);
      setUploading(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      
      if (imageFiles.length + selectedFiles.length > 5) {
        toast.error(t("report_modal.attachments_label"));
        return;
      }

      setImageFiles((prev) => [...prev, ...selectedFiles]);
      const newPreviews = selectedFiles.map((file) => URL.createObjectURL(file));
      setImagePreviews((prev) => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(imagePreviews[index]);
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    // A. 국가/도시 매칭 검증
    if (!cityId && (!detectedCountryName || !detectedCityName)) {
      newErrors.cityId = "제보할 국가와 도시를 선택해 주세요.";
    }
    
    // B. 제보 위치 지정 방식별 검증
    if (reportType === "new") {
      if (!regionName.trim()) {
        newErrors.regionName = t("report_modal.place_name_placeholder");
      } else if (regionName.trim().length < 2) {
        newErrors.regionName = "세부 장소명은 최소 2자 이상이어야 합니다.";
      }
      if (!reportCoords) {
        newErrors.coords = "지정된 좌표 정보가 없습니다.";
      }
    } else {
      // 기존 등록 장소 제보인 경우 검사
      if (!regionId) {
        newErrors.regionId = "기존에 등록된 장소를 선택해 주세요.";
      }
    }

    if (!scamCategory) {
      newErrors.scamCategory = "사기 피해 카테고리를 선택해 주세요.";
    }
    
    if (!title.trim()) {
      newErrors.title = "제보 제목을 입력해 주세요.";
    } else if (title.trim().length < 2) {
      newErrors.title = "제목은 최소 2자 이상이어야 합니다.";
    }

    if (!description.trim()) {
      newErrors.description = "피해 상황 상세 설명을 입력해 주세요.";
    } else if (description.trim().length < 10) {
      newErrors.description = "설명은 최소 10자 이상 자세히 설명해 주세요.";
    }

    // 에러 존재 시 제출 가드
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("입력한 제보 정보에 유효하지 않은 항목이 있습니다. 빨간색 안내를 확인해 주세요.");
      return;
    }

    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of imageFiles) {
        const url = await uploadsApi.uploadImage(file, { compress: true, folder: "scams" });
        urls.push(url);
      }

      if (reportType === "new" && reportCoords) {
        createMutation.mutate({
          cityId: cityId === "NEW_CITY" ? undefined : cityId,
          countryCode: countryCode === "NEW_COUNTRY" ? detectedCountryCode : countryCode || undefined,
          countryName: countryCode === "NEW_COUNTRY" ? detectedCountryName : undefined,
          cityName: cityId === "NEW_CITY" ? detectedCityName : undefined,
          regionName: regionName.trim(),
          latitude: reportCoords[0],
          longitude: reportCoords[1],
          scamCategory,
          title: title.trim(),
          description: description.trim(),
          avoidanceTip: avoidanceTip.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          imageUrls: urls,
        });
      } else {
        createMutation.mutate({
          regionId,
          scamCategory,
          title: title.trim(),
          description: description.trim(),
          avoidanceTip: avoidanceTip.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          imageUrls: urls,
        });
      }
    } catch (error) {
      toast.error("Upload Error");
      setUploading(false);
    }
  };

  const handleClose = () => {
    setReportModalOpen(false);
    setReportCoords(null);
  };

  return (
    <Dialog open={isReportModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[550px] p-6 rounded-2xl bg-card max-h-[95vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-red-600" />
            {t("report_modal.title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            {t("report_modal.desc", {
              lat: reportCoords?.[0].toFixed(5) || 0,
              lng: reportCoords?.[1].toFixed(5) || 0,
            })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          
          {(() => {
            const matchedCountry = countries.find((c) => c.code === detectedCountryCode);
            const matchedCity = cities.find((c) => c.id === cityId);
            
            // 지오코딩이 무사히 성공하여 유효한 위치 정보가 식별되었는가?
            const isGeoSuccess = 
              !!detectedCountryCode && 
              detectedCountryCode !== "ETC" && 
              !!detectedCityName && 
              detectedCityName !== "기타 도시" &&
              detectedCityName !== "기타 지역";

            const displayCountryText = matchedCountry
              ? `${getCountryName(matchedCountry.code, lang)} (자동 감지)`
              : detectedCountryName 
                ? `${detectedCountryName} (자동 감지)` 
                : "위치 정보 없음";

            const displayCityText = matchedCity
              ? `${matchedCity.name} (자동 감지)`
              : detectedCityName
                ? `${detectedCityName} (자동 감지)`
                : "위치 정보 없음";

            return (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t("report_modal.country")}
                  </Label>
                  {reportType === "new" && isGeoSuccess ? (
                    <Input
                      value={displayCountryText}
                      disabled
                      className="w-full h-9 text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 text-slate-500 font-medium select-none"
                    />
                  ) : (
                    <Select 
                      value={countryCode} 
                      onValueChange={(val) => { 
                        setCountryCode(val); 
                        setCityId(""); 
                        if (errors.cityId) setErrors(prev => ({ ...prev, cityId: "" }));
                      }} 
                      disabled={uploading || isLoadingGeo || reportType === "existing"}
                    >
                      <SelectTrigger className={`w-full text-xs cursor-pointer ${errors.cityId ? "border-red-500 focus:ring-red-400" : ""}`}>
                        {isLoadingGeo ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            위치 감지 중...
                          </span>
                        ) : (
                          <SelectValue placeholder={t("report_modal.country_select")} />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((c) => (
                          <SelectItem key={c.code} value={c.code} className="cursor-pointer">
                            {getCountryName(c.code, lang)}
                          </SelectItem>
                        ))}
                        {detectedCountryName && detectedCountryCode !== "ETC" && (
                          <SelectItem value="NEW_COUNTRY" className="cursor-pointer text-blue-600 font-semibold">
                            {detectedCountryName} (자동 감지)
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t("report_modal.city")}
                  </Label>
                  {reportType === "new" && isGeoSuccess ? (
                    <Input
                      value={displayCityText}
                      disabled
                      className="w-full h-9 text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 text-slate-500 font-medium select-none"
                    />
                  ) : (
                    <Select 
                      value={cityId} 
                      onValueChange={(val) => {
                        setCityId(val);
                        if (errors.cityId) setErrors(prev => ({ ...prev, cityId: "" }));
                      }}
                      disabled={(!countryCode && cityId !== "NEW_CITY") || isCitiesPending || uploading || isLoadingGeo || reportType === "existing"}
                    >
                      <SelectTrigger className={`w-full text-xs cursor-pointer ${errors.cityId ? "border-red-500 focus:ring-red-400" : ""}`}>
                        {isLoadingGeo ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            도시 감지 중...
                          </span>
                        ) : (
                          <SelectValue placeholder={t("report_modal.city_select")} />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map((city) => (
                          <SelectItem key={city.id} value={city.id} className="cursor-pointer">
                            {city.name}
                          </SelectItem>
                        ))}
                        {detectedCityName && detectedCityName !== "기타 도시" && detectedCityName !== "기타 지역" && (
                          <SelectItem value="NEW_CITY" className="cursor-pointer text-blue-600 font-semibold">
                            {detectedCityName} (자동 감지)
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            );
          })()}
          {errors.cityId && <p className="text-[10px] text-red-500 font-semibold mt-1">⚠️ {errors.cityId}</p>}



          {/* 제보 폼 분기 */}
          {reportType === "new" ? (
            <div className="space-y-1.5">
              <Label htmlFor="regionName" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t("report_modal.place_name")} (새로 등록할 세부 장소명)
              </Label>
              <Input
                id="regionName"
                placeholder={t("report_modal.place_name_placeholder")}
                value={regionName}
                onChange={(e) => {
                  setRegionName(e.target.value);
                  if (errors.regionName) setErrors(prev => ({ ...prev, regionName: "" }));
                }}
                className={`text-xs transition-all ${errors.regionName ? "border-red-500 focus-visible:ring-red-400 focus-visible:border-red-500" : ""}`}
                required
                disabled={uploading}
              />
              {errors.regionName ? (
                <p className="text-[10px] text-red-500 font-semibold mt-1">⚠️ {errors.regionName}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">{t("report_modal.place_name_desc")}</p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">기존 등록 장소 선택</Label>
              <Select 
                value={regionId} 
                onValueChange={(val) => {
                  setRegionId(val);
                  if (errors.regionId) setErrors(prev => ({ ...prev, regionId: "" }));
                }} 
                disabled={isRegionsPending || uploading || reportType === "existing"}
              >
                <SelectTrigger className={`w-full text-xs cursor-pointer ${errors.regionId ? "border-red-500 focus:ring-red-400" : ""}`}>
                  {isRegionsPending ? (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      지역 목록 불러오는 중...
                    </span>
                  ) : (
                    <SelectValue placeholder="등록된 기존 장소를 선택해 주세요" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {cityRegions.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="cursor-pointer">
                      {r.name}
                    </SelectItem>
                  ))}
                  {cityRegions.length === 0 && !isRegionsPending && (
                    <SelectItem value="NO_REGIONS" disabled className="text-muted-foreground text-xs text-center py-2">
                      등록된 기존 장소가 없습니다.
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {errors.regionId && <p className="text-[10px] text-red-500 font-semibold mt-1">⚠️ {errors.regionId}</p>}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                카테고리 (최소 1개, 최대 3개)
              </Label>
              <span className="text-[10px] text-muted-foreground font-semibold">
                선택됨: {selectedCats.length}/3
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              {CATEGORY_ITEMS.map((item) => {
                const isChecked = selectedCats.includes(item.value);
                return (
                  <button
                    key={item.value}
                    type="button"
                    disabled={uploading}
                    onClick={() => {
                      let next;
                      if (isChecked) {
                        next = selectedCats.filter((c) => c !== item.value);
                      } else {
                        if (selectedCats.length >= 3) {
                          toast.warning("카테고리는 최대 3개까지 선택할 수 있습니다.");
                          return;
                        }
                        next = [...selectedCats, item.value];
                      }
                      setSelectedCats(next);
                      setScamCategory(next.join(","));
                      if (errors.scamCategory) setErrors(prev => ({ ...prev, scamCategory: "" }));
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                      isChecked
                        ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 font-bold font-semibold"
                        : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-900/50"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                      isChecked
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "border-slate-300 dark:border-slate-700 bg-transparent"
                    }`}>
                      {isChecked && (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor" className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                    <span className="truncate">{t(item.tKey)}</span>
                  </button>
                );
              })}
            </div>
            {errors.scamCategory && <p className="text-[10px] text-red-500 font-semibold mt-1">⚠️ {errors.scamCategory}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("report_modal.attachments_label")}</Label>
            <div className="flex flex-wrap gap-2 items-center pt-1">
              
              {imagePreviews.length < 5 && (
                <label className="w-16 h-16 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 hover:border-slate-400 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 gap-1 text-[10px] text-muted-foreground">
                  <ImageIcon className="w-4 h-4 text-slate-500" />
                  {t("report_modal.add_photo")}
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                </label>
              )}

              {imagePreviews.map((url, index) => (
                <div key={index} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border group">
                  <img src={url} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 w-4.5 h-4.5 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    disabled={uploading}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-border my-4" />

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("report_modal.title_label")}</Label>
              <Input
                id="title"
                placeholder={t("report_modal.title_placeholder")}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors(prev => ({ ...prev, title: "" }));
                }}
                className={`text-xs transition-all ${errors.title ? "border-red-500 focus-visible:ring-red-400 focus-visible:border-red-500" : ""}`}
                required
                disabled={uploading}
              />
              {errors.title && <p className="text-[10px] text-red-500 font-semibold mt-1">⚠️ {errors.title}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("report_modal.desc_label")}</Label>
              <Textarea
                id="description"
                placeholder={t("report_modal.desc_placeholder")}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description) setErrors(prev => ({ ...prev, description: "" }));
                }}
                className={`text-xs min-h-[90px] resize-none transition-all ${errors.description ? "border-red-500 focus-visible:ring-red-400 focus-visible:border-red-500" : ""}`}
                required
                disabled={uploading}
              />
              {errors.description && <p className="text-[10px] text-red-500 font-semibold mt-1">⚠️ {errors.description}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="avoidanceTip" className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("report_modal.avoidance_label")}</Label>
              <Textarea
                id="avoidanceTip"
                placeholder={t("report_modal.avoidance_placeholder")}
                value={avoidanceTip}
                onChange={(e) => setAvoidanceTip(e.target.value)}
                className="text-xs min-h-[70px] resize-none"
                disabled={uploading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sourceUrl" className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("report_modal.source_label")}</Label>
              <Input
                id="sourceUrl"
                placeholder={t("report_modal.source_placeholder")}
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="text-xs"
                disabled={uploading}
              />
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2 sm:gap-0 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={handleClose} className="cursor-pointer" disabled={uploading}>
              {t("report_modal.cancel")}
            </Button>
            <Button 
              type="submit" 
              size="sm" 
              className="bg-red-600 hover:bg-red-700 text-white cursor-pointer ml-0 sm:ml-2"
              disabled={createMutation.isPending || uploading}
            >
              {uploading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {t("report_modal.uploading_images")}
                </span>
              ) : createMutation.isPending ? (
                t("report_modal.submitting")
              ) : (
                t("report_modal.submit")
              )}
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}
