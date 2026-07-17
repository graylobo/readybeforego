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
    setSelectedRegion,
    setMapCenter,
    setMapZoom,
    reportType,
    setReportType,
    selectedRegionId,
    selectedRegion,
    geoData,
    setIsMobileFeedOpen,
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
  const [isCompressing, setIsCompressing] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [selectedScamDetail, setSelectedScamDetail] = useState<ScamInfo | null>(null);

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

  const { data: regionScams = [] } = useQuery<ScamInfo[]>({
    queryKey: ["scam-reports-for-duplicate-check", regionId],
    queryFn: () => scamsApi.getScamsByRegion(regionId),
    enabled: isReportModalOpen && !!regionId && regionId !== "NEW_CITY",
  });

  const overlappingScams = regionScams.filter((existingScam) => {
    const existingCategories = existingScam.scamCategory ? existingScam.scamCategory.split(",") : [];
    return selectedCats.some((cat) => existingCategories.includes(cat));
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
      setIsCompressing(false);
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
        // 기존 장소에서 신규 등록으로 동적 전환 시 기존 프리필 국가/도시 보존
        setCountryCode((prev) => prev || "");
        setCityId((prev) => prev || "");
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      
      if (imageFiles.length + selectedFiles.length > 5) {
        toast.error(t("report_modal.attachments_label"));
        return;
      }

      // 1. 임시 미리보기 생성하여 화면에 바로 피드백 노출
      const newPreviews = selectedFiles.map((file) => URL.createObjectURL(file));
      setImagePreviews((prev) => [...prev, ...newPreviews]);

      // 2. 비동기 백그라운드 이미지 압축 시작 (사용자 모르게 물밑에서 조용히 실행)
      setIsCompressing(true);
      try {
        const compressPromises = selectedFiles.map((file) => uploadsApi.compressImage(file));
        const compressedFiles = await Promise.all(compressPromises);
        
        setImageFiles((prev) => [...prev, ...compressedFiles]);
      } catch (err) {
        console.error("Image compression error:", err);
        // 압축 실패 시 원본이라도 저장하여 등록 가능하도록 지원
        setImageFiles((prev) => [...prev, ...selectedFiles]);
      } finally {
        setIsCompressing(false);
      }
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

    // 백그라운드 압축 진행중 가드
    if (isCompressing) {
      toast.warning("현재 이미지를 최적화하는 중입니다. 완료될 때까지 잠시만 기다려 주세요.");
      return;
    }

    setUploading(true);
    try {
      // 선택 시 미리 압축해 둔 파일 리스트를 병렬(Promise.all) 및 compress: false로 빠르게 업로드 ⚡
      const uploadPromises = imageFiles.map((file) =>
        uploadsApi.uploadImage(file, { compress: false, folder: "scams" })
      );
      const urls = await Promise.all(uploadPromises);

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
    setIsReportMode(false);
  };

  return (
    <>
    <Dialog open={isReportModalOpen} onOpenChange={(open) => !open && setIsCloseConfirmOpen(true)}>
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
          
          {/* 제보 방식 선택 토글 🔀 */}
          {reportCoords && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                제보 방식 선택
              </Label>
              <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setReportType("existing");
                    if (selectedRegionId) setRegionId(selectedRegionId);
                  }}
                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 ${
                    reportType === "existing"
                      ? "bg-white dark:bg-slate-800 shadow text-slate-850 dark:text-slate-100 font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  기존 등록 장소에 추가 제보
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportType("new");
                    setRegionId("");
                  }}
                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 ${
                    reportType === "new"
                      ? "bg-white dark:bg-slate-800 shadow text-slate-850 dark:text-slate-100 font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  이 위치에 새로운 장소 등록
                </button>
              </div>
            </div>
          )}

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
                          toast.warning("카테고리는 최대 3개까지 선택할 수 있습니다.", { id: "max-categories-warning" });
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

          {/* 동일 지역 내 유사 카테고리 제보 감지 경고 안내창 ⚠️ */}
          {overlappingScams.length > 0 && (
            <div className="p-3 bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500 font-bold text-xs">
                <span className="text-sm">⚠️</span>
                <span>이 지역에 이미 유사한 제보가 있습니다. (클릭 시 상세 확인)</span>
              </div>
              <div className="space-y-1 pt-0.5 max-h-[110px] overflow-y-auto scrollbar-thin">
                {overlappingScams.slice(0, 5).map((scam) => (
                  <button
                    key={scam.id}
                    type="button"
                    onClick={() => {
                      setSelectedScamDetail(scam);
                    }}
                    className="block w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-lg hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 truncate flex-1">
                        {scam.title}
                      </span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                        {scam.scamCategory.split(",").map(cat => t(`categories.${cat}`)).join(", ")}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {overlappingScams.length > 5 && (
                <p className="text-[9px] text-muted-foreground text-center font-medium">
                  + {overlappingScams.length - 5}개의 제보가 더 있습니다.
                </p>
              )}
            </div>
          )}

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
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCloseConfirmOpen(true)} className="cursor-pointer" disabled={uploading}>
              {t("report_modal.cancel")}
            </Button>
            <Button 
              type="submit" 
              size="sm" 
              className="bg-red-600 hover:bg-red-700 text-white cursor-pointer ml-0 sm:ml-2"
              disabled={createMutation.isPending || uploading || isCompressing}
            >
              {isCompressing ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  이미지 최적화 중...
                </span>
              ) : uploading ? (
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

    {/* 제보 취소 확인 모달 🛑 */}
    <Dialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
      <DialogContent className="w-[90%] max-w-[360px] p-5 rounded-2xl bg-card border border-border shadow-2xl z-[99999]">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-base font-extrabold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            🛑 제보 중단
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            제보를 중단하시겠습니까? 작성 중이던 내용은 저장되지 않습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2.5 mt-4">
          <Button
            variant="outline"
            onClick={() => setIsCloseConfirmOpen(false)}
            className="flex-1 text-xs font-semibold h-9 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer"
          >
            아니오
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setIsCloseConfirmOpen(false);
              handleClose();
            }}
            className="flex-1 text-xs font-bold h-9 rounded-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer"
          >
            예
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* 유사 제보 상세 확인 모달 🔍 */}
    <Dialog open={!!selectedScamDetail} onOpenChange={(open) => !open && setSelectedScamDetail(null)}>
      <DialogContent className="w-[95%] max-w-[500px] p-6 rounded-2xl bg-card border border-border shadow-2xl z-[999999] max-h-[85vh] overflow-y-auto scrollbar-thin">
        {selectedScamDetail && (
          <div className="space-y-4">
            <DialogHeader className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded">
                  {t(`categories.${selectedScamDetail.scamCategory.split(",")[0]}`)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(selectedScamDetail.createdAt).toLocaleDateString()}
                </span>
              </div>
              <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-slate-100 pt-1">
                {selectedScamDetail.title}
              </DialogTitle>
            </DialogHeader>

            {/* 제보 내용 */}
            <div className="space-y-1">
              <h4 className="text-[11px] font-bold text-slate-400">🚨 피해 상세 내용</h4>
              <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 whitespace-pre-wrap leading-relaxed">
                {selectedScamDetail.description}
              </p>
            </div>

            {/* 대처법 및 예방법 (있을 경우) */}
            {selectedScamDetail.avoidanceTip && (
              <div className="space-y-1">
                <h4 className="text-[11px] font-bold text-red-400 flex items-center gap-1">
                  💡 대처법 & 예방법
                </h4>
                <p className="text-xs text-red-800 dark:text-red-300 bg-red-500/10 dark:bg-red-500/5 p-3.5 rounded-xl border border-red-500/20 whitespace-pre-wrap leading-relaxed">
                  {selectedScamDetail.avoidanceTip}
                </p>
              </div>
            )}

            {/* 이미지 갤러리 */}
            {selectedScamDetail.imageUrls && selectedScamDetail.imageUrls.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-[11px] font-bold text-slate-400">📸 첨부 사진</h4>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {selectedScamDetail.imageUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="relative w-20 h-20 rounded-xl overflow-hidden border border-border shrink-0 hover:opacity-90 transition-opacity">
                      <img src={url} alt={`attachment-${i}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 하단 제보 공감 안내 및 닫기 버튼 */}
            <div className="pt-2 border-t border-border flex gap-2.5">
              <Button
                variant="outline"
                onClick={() => setSelectedScamDetail(null)}
                className="flex-1 text-xs font-semibold h-9 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer"
              >
                닫기
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  const targetScam = selectedScamDetail;
                  setSelectedScamDetail(null);
                  
                  // 제보하기 취소/동기화 처리하고 해당 피드로 이동
                  setReportModalOpen(false);
                  setReportCoords(null);
                  setIsCloseConfirmOpen(false);
                  setIsReportMode(false);

                  setSelectedRegionId(targetScam.regionId);
                  const matchedRegion = cityRegions.find((r) => r.id === targetScam.regionId);
                  if (matchedRegion) {
                    setSelectedRegion(matchedRegion);
                    setMapCenter([matchedRegion.latitude, matchedRegion.longitude]);
                    setMapZoom(15);
                  }

                  if (typeof window !== "undefined" && window.innerWidth < 768) {
                    setIsMobileFeedOpen(true);
                  }
                }}
                className="flex-1 text-xs font-bold h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                기존 제보글로 이동 (작성 취소)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
