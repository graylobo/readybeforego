"use client";

import { useState, useEffect, useCallback, memo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Image as ImageIcon, X, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { getCountryName } from "@/lib/utils/country";
import { formatExternalUrl } from "@/lib/utils/url";
import { ScamCategoryPicker } from "@/components/scams/scam-category-picker";
import {
  CAUTION_CATEGORY_ITEMS,
  TIP_CATEGORY_ITEMS,
  OTHER_CATEGORY,
  OTHER_NOTE_MIN_LENGTH,
  getCategoryInfo,
  hasOtherCategory,
} from "@/lib/constants/scam-categories";

interface ImagePreviewItemProps {
  url: string;
  index: number;
  onRemove: (index: number) => void;
  disabled: boolean;
}

const ImagePreviewItem = memo(({ url, index, onRemove, disabled }: ImagePreviewItemProps) => {
  return (
    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border group">
      <img src={url} alt="preview" className="w-full h-full object-cover" />
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="absolute top-1 right-1 w-4.5 h-4.5 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        disabled={disabled}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
});

ImagePreviewItem.displayName = "ImagePreviewItem";

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
    itemReportType,
    setItemReportType,
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
  const [otherCategoryNote, setOtherCategoryNote] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [avoidanceTip, setAvoidanceTip] = useState("");
  const [subLocation, setSubLocation] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [scope, setScope] = useState<'spot' | 'region' | 'city' | 'country'>('spot');

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
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

  const { data: cities = [], isFetching: isCitiesFetching } = useQuery<City[]>({
    queryKey: ["cities", countryCode],
    queryFn: () => scamsApi.getCities(countryCode),
    enabled: isReportModalOpen && !!countryCode,
  });

  const { data: cityRegions = [], isFetching: isRegionsFetching } = useQuery<Region[]>({
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
    return selectedCats
      .filter((cat) => cat !== OTHER_CATEGORY)
      .some((cat) => existingCategories.includes(cat));
  });

  useEffect(() => {
    if (isReportModalOpen) {
      setRegionName("");
      setScamCategory("");
      setSelectedCats([]);
      setOtherCategoryNote("");
      setTitle("");
      setDescription("");
      setAvoidanceTip("");
      setSubLocation("");
      setSourceUrl("");
      setImageFiles([]);
      setImagePreviews([]);
      setUploading(false);
      setUploadProgressText("");
      setIsCompressing(false);
      setErrors({});
      setScope("spot");

      // 단일 제어 흐름으로 전면 개편하여 상태 경합/덮어쓰기 버그 원천 봉쇄 🛡️
      if (reportType === "existing") {
        // 케이스 1: 기존 등록 장소에 추가 제보
        setRegionId(selectedRegionId || "");
        
        if (selectedRegionId && selectedRegion) {
          if (selectedRegion.countryCode) {
            setCountryCode(selectedRegion.countryCode);
            setDetectedCountryCode(selectedRegion.countryCode);
            setDetectedCountryName(getCountryName(selectedRegion.countryCode, lang) || "");
          }
          if (selectedRegion.cityId) {
            setCityId(selectedRegion.cityId);
          }
          if (selectedRegion.cityName) {
            setDetectedCityName(selectedRegion.cityName);
          }
        } else {
          setCountryCode(selectedCountryCode || "");
          setCityId(selectedCityId || "");
          setDetectedCountryName("");
          setDetectedCountryCode("");
          setDetectedCityName("");
        }
        setIsLoadingGeo(false);

      } else if (reportType === "new" && geoData) {
        // 케이스 2: 신규 핀 제보이고 역지오코딩 정보가 있는 경우
        setRegionId("");
        setIsLoadingGeo(true);
        try {
          const targetGeo = geoData?.data || geoData || {};
          const addr = targetGeo.address || {};
          const country = addr.country || "기타 국가";
          const countryCodeVal = (addr.country_code || "ETC").toUpperCase();

          // 표준 지오코딩 행정구역 우선순위에 따라 도시명(city) 추출 🏙️
          const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || addr.province || addr.state || "기타 도시";

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

          // 2. 세부 장소명(Region Name) 지능형 추출 🗺️
          const getRegionDisplayName = () => {
            if (targetGeo.name && targetGeo.name.trim() !== "") {
              return targetGeo.name;
            }
            const road = addr.road || addr.street || "";
            const houseNumber = addr.house_number || "";
            if (road) {
              return houseNumber ? `${road} ${houseNumber}` : road;
            }
            const parts = (targetGeo.display_name || "").split(",").map((p: string) => p.trim());
            const validPart = parts.find((p: string) => p && !/^\d+$/.test(p));
            return validPart || parts[0] || "";
          };

          const calculatedRegionName = getRegionDisplayName();
          if (calculatedRegionName && !isBroadArea(calculatedRegionName)) {
            setRegionName(calculatedRegionName);
          } else {
            setRegionName("");
          }

          setDetectedCountryName(country);
          setDetectedCountryCode(countryCodeVal);
          setDetectedCityName(city);
          setCountryCode(countryCodeVal);
          setCityId("NEW_CITY");
        } catch (err) {
          console.error("Geocoding Parsing Error:", err);
          setCountryCode("");
          setCityId("");
        } finally {
          setIsLoadingGeo(false);
        }

      } else {
        // 케이스 3: reportType === "new" 인데 geoData가 없는 경우 (탭 동적 전환 포함)
        setRegionId("");
        
        // 기존 프리필 국가/도시 보존 및 감지 데이터 매핑
        setCountryCode((prev) => prev || selectedCountryCode || "");
        setCityId((prev) => prev || selectedCityId || "");
        
        if (selectedRegion) {
          if (selectedRegion.countryCode) {
            setDetectedCountryCode(selectedRegion.countryCode);
            setDetectedCountryName(getCountryName(selectedRegion.countryCode, lang) || "");
          }
          if (selectedRegion.cityName) {
            setDetectedCityName(selectedRegion.cityName);
          }
        } else {
          setDetectedCountryName("");
          setDetectedCountryCode("");
          setDetectedCityName("");
        }
        setIsLoadingGeo(false);
      }
    }
  }, [isReportModalOpen, reportCoords, reportType, selectedCountryCode, selectedCityId, countries, geoData, selectedRegion, lang]);

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
      setUploading(false);
      const serverMsg = err.response?.data?.message || err.message;
      if (serverMsg && serverMsg !== "Validation failed" && serverMsg !== "Error") {
        toast.error(serverMsg);
      }
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

  const removeImage = useCallback((index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    // A. 제보 적용 범위별 국가/도시 검증
    if (scope === "country") {
      if (!countryCode && !detectedCountryName) {
        newErrors.cityId = "제보할 국가를 선택해 주세요.";
      }
    } else if (scope === "city") {
      if (!cityId && (!detectedCountryName || !detectedCityName)) {
        newErrors.cityId = "제보할 국가와 도시를 선택해 주세요.";
      }
    } else {
      // scope === "spot" 또는 "region" 인 경우
      if (!cityId && (!detectedCountryName || !detectedCityName)) {
        newErrors.cityId = "제보할 국가와 도시를 선택해 주세요.";
      }
    }
    
    // B. 제보 위치 지정 방식별 검증 (spot, region 범위일 때 지명/핀 필수 검증)
    if (scope === "spot" || scope === "region") {
      if (reportType === "new") {
        if (!regionName.trim()) {
          newErrors.regionName = scope === "region" ? "구역/거리 이름을 입력해 주세요." : t("report_modal.place_name_placeholder");
        } else if (regionName.trim().length < 2) {
          newErrors.regionName = scope === "region" ? "구역/거리 이름은 최소 2자 이상이어야 합니다." : "세부 장소명은 최소 2자 이상이어야 합니다.";
        }
        if (!reportCoords) {
          newErrors.coords = "지정된 좌표 정보가 없습니다.";
        }
      } else {
        // 기존 등록 장소 제보인 경우 검사
        if (!regionId) {
          newErrors.regionId = scope === "region" ? "기존에 등록된 구역을 선택해 주세요." : "기존에 등록된 장소를 선택해 주세요.";
        }
      }
    }

    if (!scamCategory) {
      newErrors.scamCategory = itemReportType === "TIP" ? "꿀팁 카테고리를 선택해 주세요." : "사기 피해 카테고리를 선택해 주세요.";
    } else if (hasOtherCategory(selectedCats) && otherCategoryNote.trim().length < OTHER_NOTE_MIN_LENGTH) {
      newErrors.otherCategoryNote = t("report_modal.other_note_required");
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

    let urls: string[] = [];
    try {
      if (imageFiles.length > 0) {
        setUploading(true);
        setUploadProgressText(`사진 업로드 준비 중... (0/${imageFiles.length})`);

        // 해외/모바일 느린 데이터 환경에서 대역폭 고갈 및 Socket Timeout을 원천 방지하기 위한 순차 업로드 🛡️
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          setUploadProgressText(`사진 업로드 중... (${i + 1}/${imageFiles.length})`);
          
          let attempts = 0;
          let uploadedUrl = "";

          while (attempts < 2) {
            try {
              uploadedUrl = await uploadsApi.uploadImage(file, { compress: false, folder: "scams" });
              break;
            } catch (err) {
              attempts++;
              console.warn(`[Image Upload Retry ${attempts}/2]`, err);
              if (attempts >= 2) throw err;
              await new Promise((res) => setTimeout(res, 1000));
            }
          }

          if (uploadedUrl) {
            urls.push(uploadedUrl);
          }
        }
      }

      if (reportType === "new" && reportCoords) {
        const isExistingCity = !!cityId && cityId !== "NEW_CITY";
        const isExistingCountry = !!countryCode && countryCode !== "NEW_COUNTRY";

        createMutation.mutate({
          scope,
          reportType: itemReportType as any,
          cityId: scope === "country" ? undefined : (isExistingCity ? cityId : undefined),
          countryCode: isExistingCountry ? countryCode : (detectedCountryCode || "ETC"),
          countryName: !isExistingCountry ? (detectedCountryName || "기타 국가") : undefined,
          cityName: scope === "country" ? undefined : (!isExistingCity ? (detectedCityName || "기타 도시") : undefined),
          regionName: (scope === "spot" || scope === "region") ? regionName.trim() : undefined,
          latitude: reportCoords[0],
          longitude: reportCoords[1],
          scamCategory,
          otherCategoryNote: hasOtherCategory(selectedCats) ? otherCategoryNote.trim() : undefined,
          title: title.trim(),
          description: description.trim(),
          avoidanceTip: avoidanceTip.trim() || undefined,
          subLocation: subLocation.trim() || undefined,
          sourceUrl: sourceUrl.trim() ? formatExternalUrl(sourceUrl.trim()) : undefined,
          imageUrls: urls,
        });
      } else {
        createMutation.mutate({
          scope,
          reportType: itemReportType as any,
          regionId: (scope === "spot" || scope === "region") ? regionId : undefined,
          cityId: scope === "city" ? cityId : undefined,
          countryCode: scope === "country" ? countryCode : undefined,
          scamCategory,
          otherCategoryNote: hasOtherCategory(selectedCats) ? otherCategoryNote.trim() : undefined,
          title: title.trim(),
          description: description.trim(),
          avoidanceTip: avoidanceTip.trim() || undefined,
          subLocation: subLocation.trim() || undefined,
          sourceUrl: sourceUrl.trim() ? formatExternalUrl(sourceUrl.trim()) : undefined,
          imageUrls: urls,
        });
      }
    } catch (error: any) {
      console.error("Image Upload Failed:", error);
      toast.error("사진 업로드에 실패했습니다. 모바일 데이터 상태를 확인한 후 다시 시도해 주세요.");
      setUploading(false);
      setUploadProgressText("");
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
            <PlusCircle className={`w-5 h-5 ${itemReportType === "TIP" ? "text-emerald-600" : "text-red-600"}`} />
            {itemReportType === "TIP" ? t("report_modal.title_tip") : t("report_modal.title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            {itemReportType === "TIP"
              ? t("report_modal.desc_tip", {
                  lat: reportCoords?.[0].toFixed(5) || 0,
                  lng: reportCoords?.[1].toFixed(5) || 0,
                })
              : t("report_modal.desc", {
                  lat: reportCoords?.[0].toFixed(5) || 0,
                  lng: reportCoords?.[1].toFixed(5) || 0,
                })
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          


          {/* 선택된 정보 성격 안내 배너 🎯 */}
          <div
            className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
              itemReportType === "CAUTION"
                ? "bg-red-50/70 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900/40 dark:text-red-300"
                : "bg-emerald-50/70 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900/40 dark:text-emerald-300"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold shrink-0 ${
                  itemReportType === "CAUTION"
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {itemReportType === "CAUTION" ? "⚠️" : "💡"}
              </div>
              <div className="text-xs leading-tight min-w-0">
                <p className="font-bold">
                  {itemReportType === "CAUTION" ? "주의 / 위험 제보" : "사전 꿀팁 제보"}
                </p>
                <p className="text-[11px] opacity-80 mt-0.5 truncate">
                  {itemReportType === "CAUTION"
                    ? "해당 지역 방문 시 유의할 위험/주의 정보를 알려주세요."
                    : "해당 지역 방문 시 도움이 될 사전 정보를 알려주세요."}
                </p>
              </div>
            </div>
          
          </div>

          {/* 제보 적용 범위 선택 🎯 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              제보 적용 범위
            </Label>
            <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl gap-1">
              {(["spot", "region", "city", "country"] as const).map((sc) => {
                const label = 
                  sc === "spot" ? "특정 위치" :
                  sc === "region" ? "구역 전체" :
                  sc === "city" ? "도시 전체" :
                  "국가 전체";
                
                const isActive = scope === sc;
                return (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => setScope(sc)}
                    className={`flex-1 text-center py-1.5 rounded-lg text-[10.5px] font-semibold cursor-pointer transition-all duration-200 ${
                      isActive
                        ? "bg-white dark:bg-slate-800 shadow text-slate-850 dark:text-slate-100 font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {/* 가이드라인 표시 */}
            <p className="text-[10px] text-muted-foreground leading-normal mt-1 pl-1">
              {scope === "spot" && "특정 위치 범위에 대한 정보입니다."}
              {scope === "region" && "특정 구역 범위에 대한 정보입니다."}
              {scope === "city" && "특정 도시 범위에 대한 정보입니다."}
              {scope === "country" && "국가 범위에 대한 정보입니다."}
            </p>
          </div>

          {(() => {
            // geoData가 전달되었을 때 렌더링 시점에 즉시 동기 추출하는 지오코딩 기본값 ⚡
            const rawGeo = geoData?.data || geoData || {};
            const rawAddr = rawGeo.address || {};
            const directCountryName = rawAddr.country || detectedCountryName || "";
            const directCountryCode = (rawAddr.country_code || detectedCountryCode || "ETC").toUpperCase();
            const directCityName = rawAddr.city || rawAddr.town || rawAddr.village || rawAddr.municipality || rawAddr.county || rawAddr.province || rawAddr.state || detectedCityName || "";

            const matchedCountry = countries.find((c) => c.code === (countryCode || directCountryCode));
            const matchedCity = cities.find((c) => c.id === cityId);
            
            const displayCountryText = matchedCountry
              ? getCountryName(matchedCountry.code, lang)
              : directCountryName || "위치 정보 없음";

            const displayCityText = directCityName || matchedCity?.name || "위치 정보 없음";

            const isGeoSuccess = !!displayCountryText && displayCountryText !== "위치 정보 없음" && !!displayCityText && displayCityText !== "위치 정보 없음";

            return (
              <div className={scope === "country" ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t("report_modal.country")} <span className="text-red-500 font-bold">*</span>
                  </Label>
                  <Select 
                    value={countryCode} 
                    onValueChange={(val) => { 
                      setCountryCode(val); 
                      setCityId(""); 
                      if (errors.cityId) setErrors(prev => ({ ...prev, cityId: "" }));
                    }} 
                    disabled={uploading || isLoadingGeo || reportType === "existing" || (reportType === "new" && isGeoSuccess)}
                  >
                    <SelectTrigger className={`w-full text-xs cursor-pointer ${errors.cityId ? "border-red-500 focus:ring-red-400" : ""}`}>
                      {isLoadingGeo ? (
                         <span className="flex items-center gap-1 text-muted-foreground">
                           <Loader2 className="w-3.5 h-3.5 animate-spin" />
                           위치 감지 중...
                         </span>
                      ) : (reportType === "new" && directCountryName) || reportType === "existing" || isGeoSuccess ? (
                        <span className="text-slate-900 dark:text-slate-100 font-medium truncate">
                          {displayCountryText}
                        </span>
                      ) : (
                        <SelectValue placeholder={t("report_modal.country_select")} />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {countries
                        .map((c) => ({
                          ...c,
                          displayName: getCountryName(c.code || c.name, lang) || c.name || c.code
                        }))
                        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'))
                        .map((c) => (
                          <SelectItem key={c.code} value={c.code} className="cursor-pointer">
                            {c.displayName}
                          </SelectItem>
                        ))}
                      {detectedCountryName && detectedCountryCode !== "ETC" && (
                        <SelectItem value="NEW_COUNTRY" className="cursor-pointer text-blue-600 font-semibold">
                          {detectedCountryName}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {scope !== "country" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t("report_modal.city")} <span className="text-red-500 font-bold">*</span>
                    </Label>
                    <Select 
                      value={cityId} 
                      onValueChange={(val) => {
                        setCityId(val);
                        if (errors.cityId) setErrors(prev => ({ ...prev, cityId: "" }));
                      }}
                      disabled={(!countryCode && cityId !== "NEW_CITY") || isCitiesFetching || uploading || isLoadingGeo || reportType === "existing" || (reportType === "new" && isGeoSuccess)}
                    >
                      <SelectTrigger className={`w-full text-xs cursor-pointer ${errors.cityId ? "border-red-500 focus:ring-red-400" : ""}`}>
                        {isLoadingGeo ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            도시 감지 중...
                          </span>
                        ) : (reportType === "new" && directCityName) || reportType === "existing" || isGeoSuccess ? (
                          <span className="text-slate-900 dark:text-slate-100 font-medium truncate">
                            {displayCityText}
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
                            {detectedCityName}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            );
          })()}
          {errors.cityId && <p className="text-[10px] text-red-500 font-semibold mt-1">⚠️ {errors.cityId}</p>}


          {/* 제보 폼 분기 */}
          {(scope === "spot" || scope === "region") && (
            reportType === "new" ? (
              <div className="space-y-1.5">
                <Label htmlFor="regionName" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {scope === "region" ? "구역/거리 이름 (예: 카오산로드 전체, 야시장 구역)" : `${t("report_modal.place_name")} (새로 등록할 세부 장소명)`} <span className="text-red-500 font-bold">*</span>
                </Label>
                <Input
                  id="regionName"
                  placeholder={scope === "region" ? "구역/거리 이름을 입력해 주세요." : t("report_modal.place_name_placeholder")}
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
                  <p className="text-[10px] text-muted-foreground">
                    {scope === "region" ? "제보가 묶여서 노출될 구역/거리의 현지 대표 명칭을 입력해 주세요." : t("report_modal.place_name_desc")}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5 opacity-85">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  제보 대상 장소
                </Label>
                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-900/40 flex items-center justify-between cursor-not-allowed select-none grayscale">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate">
                      {selectedRegion?.name || cityRegions.find((r) => r.id === regionId)?.name || "선택된 장소"}
                    </span>
                  </div>
                </div>
              </div>
            )
          )}

          {/* 세부 점포명 / 층수 (선택) 🏬 */}
          {(scope === "spot" || scope === "region") && (
            <div className="space-y-1.5">
              <Label htmlFor="subLocation" className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>세부 장소 (선택)</span>
                <span className="text-[10px] text-muted-foreground font-normal">건물/상가 내 장소 구분용</span>
              </Label>
              <Input
                id="subLocation"
                placeholder="예: 3층 201호 옷가게"
                value={subLocation}
                onChange={(e) => setSubLocation(e.target.value)}
                className="text-xs"
                disabled={uploading}
              />
            </div>
          )}

          <ScamCategoryPicker
            items={itemReportType === "TIP" ? TIP_CATEGORY_ITEMS : CAUTION_CATEGORY_ITEMS}
            selectedCats={selectedCats}
            onChange={(next) => {
              setSelectedCats(next);
              setScamCategory(next.join(","));
              if (errors.scamCategory || errors.otherCategoryNote) {
                setErrors((prev) => ({ ...prev, scamCategory: "", otherCategoryNote: "" }));
              }
            }}
            otherNote={otherCategoryNote}
            onOtherNoteChange={(note) => {
              setOtherCategoryNote(note);
              if (errors.otherCategoryNote) setErrors((prev) => ({ ...prev, otherCategoryNote: "" }));
            }}
            disabled={uploading}
            error={errors.scamCategory}
            otherNoteError={errors.otherCategoryNote}
            reportType={itemReportType}
          />

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
                        {scam.scamCategory.split(",").map((cat) => getCategoryInfo(cat, t, scam.otherCategoryNote).label).join(", ")}
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
                <ImagePreviewItem
                  key={url}
                  url={url}
                  index={index}
                  onRemove={removeImage}
                  disabled={uploading}
                />
              ))}
            </div>
          </div>

          <hr className="border-border my-4" />

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t("report_modal.title_label")} <span className="text-red-500 font-bold">*</span>
              </Label>
              <Input
                id="title"
                placeholder={itemReportType === "TIP" ? t("report_modal.title_placeholder_tip") : t("report_modal.title_placeholder")}
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
              <Label htmlFor="description" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {itemReportType === "TIP" ? t("report_modal.desc_label_tip") : t("report_modal.desc_label")} <span className="text-red-500 font-bold">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder={itemReportType === "TIP" ? t("report_modal.desc_placeholder_tip") : t("report_modal.desc_placeholder")}
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
              <Label htmlFor="avoidanceTip" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {itemReportType === "TIP" ? t("report_modal.avoidance_label_tip") : t("report_modal.avoidance_label")}
              </Label>
              <Textarea
                id="avoidanceTip"
                placeholder={itemReportType === "TIP" ? t("report_modal.avoidance_placeholder_tip") : t("report_modal.avoidance_placeholder")}
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
                  {uploadProgressText || t("report_modal.uploading_images")}
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
                  {getCategoryInfo(selectedScamDetail.scamCategory.split(",")[0], t, selectedScamDetail.otherCategoryNote).label}
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

                  if (targetScam) {
                    setSelectedRegionId(targetScam.regionId ?? null);
                    const matchedRegion = cityRegions.find((r) => r.id === targetScam.regionId);
                    if (matchedRegion) {
                      setSelectedRegion(matchedRegion);
                      setMapCenter([matchedRegion.latitude, matchedRegion.longitude]);
                      setMapZoom(15);
                    }
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
