"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useScamMapStore } from "@/lib/stores/scam-map.store";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useTranslation } from "@/hooks/use-translation";
import { scamsApi, ScamInfo, Region, Country, City } from "@/lib/api/scams";
import { uploadsApi } from "@/lib/api/uploads";
import { getCountryName } from "@/lib/utils/country";
import { formatExternalUrl } from "@/lib/utils/url";
import { NEARBY_LOCATION_THRESHOLD } from "@/lib/constants/map";
import { findNearbyRegions, formatDistance, formatRadius, REGION_AREA_RADIUS_M, zoomForRadius } from "@/lib/nearby";
import { PlaceSearch } from "@/components/map/place-search";
import {
  CAUTION_CATEGORY_ITEMS,
  TIP_CATEGORY_ITEMS,
  OTHER_NOTE_MIN_LENGTH,
  getCategoryInfo,
  hasOtherCategory,
  parseCategories,
} from "@/lib/constants/scam-categories";
import { ScamCategoryPicker } from "@/components/scams/scam-category-picker";
import {
  AudienceNationalityBadges,
  AudienceNationalityPicker,
  parseAudienceNationalities,
  serializeAudienceNationalities,
} from "@/components/scams/audience-nationality-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Comments } from "@/components/comments/comments";
import { ReportDialog } from "@/components/common/report-dialog";
import { MediaDetailModal } from "@/components/common/media-detail-modal";
import { ScamReportModal } from "@/components/scams/scam-report-modal";
import GeocodeConfirmModal from "@/components/scams/scam-geocode-confirm-modal";
import AddressSearchModal from "@/components/scams/scam-address-search-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertTriangle, 
  MapPin, 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare, 
  Flag, 
  ExternalLink,
  Info,
  Compass,
  Search,
  ImageIcon,
  X,
  Loader2,
  Share2,
  Lightbulb
} from "lucide-react";
import { toast } from "sonner";

// Prevent SSR window references for Leaflet map component
const ReadyBeforeGoMap = dynamic(() => import("@/components/map/ReadyBeforeGoMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-slate-50 flex flex-col items-center justify-center gap-4 animate-pulse">
      <Compass className="w-12 h-12 text-slate-400 animate-spin" />
      <span className="text-sm font-semibold text-slate-500">interactive map loading...</span>
    </div>
  ),
});

const EMPTY_ARRAY: any[] = [];

export default function Home() {
  const queryClient = useQueryClient();
  const { t, lang, setLang } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  
  // Mismatch hydration guard for persistent localstorage lang
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    selectedCountryCode,
    selectedCityId,
    selectedRegionId,
    selectedRegion,
    setSelectedCountryCode,
    setSelectedCityId,
    setSelectedRegionId,
    setSelectedRegion,
    nearby,
    setNearby,
    setHighlightedRegionId,
    setFocusedScamId,
    sightingPick,
    setSightingPick,
    filterReportType,
    mapCenter,
    setMapCenter,
    mapZoom,
    setMapZoom,
    resetSelections,
    isReportMode,
    setIsReportMode,
    isMobileFeedOpen,
    setIsMobileFeedOpen,
    isFilterModalOpen,
    setIsFilterModalOpen,
    isSelectTypeModalOpen,
    setSelectTypeModalOpen,
    isReportModalOpen,
    setReportModalOpen,
    setItemReportTypeModalOpen,
    isAddressSearchModalOpen,
    setAddressSearchModalOpen,
    isGeocodeConfirmModalOpen,
    setGeocodeConfirmModalOpen,
    isReportConfirmModalOpen,
    setReportConfirmModalOpen,
    setReportType,
    setReportCoords,
    setGeoData,
  } = useScamMapStore();

  const [activeReportScamId, setActiveReportScamId] = useState<string | null>(null);
  const [activeCommentScamId, setActiveCommentScamId] = useState<string | null>(null);
  const [activeMediaScam, setActiveMediaScam] = useState<ScamInfo | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number>(0);

  const [editingScam, setEditingScam] = useState<ScamInfo | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAvoidanceTip, setEditAvoidanceTip] = useState("");
  const [editSourceUrl, setEditSourceUrl] = useState("");
  const [editScamCategory, setEditScamCategory] = useState("");
  const [editOtherCategoryNote, setEditOtherCategoryNote] = useState("");
  const [editAudienceNationalities, setEditAudienceNationalities] = useState<string[]>([]);
  const [editImageFiles, setEditImageFiles] = useState<File[]>([]);
  const [editImagePreviews, setEditImagePreviews] = useState<string[]>([]);
  const [editExistingImageUrls, setEditExistingImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [displayScams, setDisplayScams] = useState<ScamInfo[]>([]);
  const [feedScopeFilter, setFeedScopeFilter] = useState<'all' | 'spot' | 'region' | 'city' | 'country'>('all');
  const [expandedScamIds, setExpandedScamIds] = useState<Set<string>>(new Set());
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const sheetDragStartY = useRef<number | null>(null);
  const isInitialUrlParsed = useRef(false);

  // 장소를 새로 고르면 그곳에 해당하는 주의사항을 범위 구분 없이 모두 보여 준다
  useEffect(() => {
    setFeedScopeFilter('all');
    setExpandedScamIds(new Set());
    setFocusedScamId(null);
  }, [selectedCountryCode, selectedCityId, selectedRegionId, nearby, setFocusedScamId]);

  // 휴대폰에서는 무언가 선택되면 지도를 가리지 않는 높이로 목록을 연다
  const isFeedActive = !!(selectedCountryCode || selectedCityId || selectedRegionId || nearby);
  useEffect(() => {
    setIsMobileFeedOpen(isFeedActive && window.innerWidth < 768);
    setIsSheetExpanded(false);
  }, [isFeedActive, selectedRegionId, setIsMobileFeedOpen]);

  // 모바일 환경 하드웨어 뒤로가기 버튼(및 스와이프 백) 제어 📱
  useEffect(() => {
    const isAnyModalOpen =
      isMobileFeedOpen ||
      isReportModalOpen ||
      isSelectTypeModalOpen ||
      isGeocodeConfirmModalOpen ||
      isReportConfirmModalOpen ||
      isAddressSearchModalOpen ||
      isEditModalOpen ||
      isReportMode;

    if (isAnyModalOpen) {
      // 모달이 하나라도 열리면 브라우저 history 스택에 가상 상태 주입
      if (typeof window !== "undefined" && window.history.state?.modalActive !== true) {
        window.history.pushState({ modalActive: true }, "");
      }
    } else {
      // 모달이 전부 닫혔는데 가상 상태가 남아있다면 히스토리백 처리하여 정리
      if (typeof window !== "undefined" && window.history.state?.modalActive === true) {
        window.history.back();
      }
    }
  }, [
    isMobileFeedOpen,
    isReportModalOpen,
    isSelectTypeModalOpen,
    isGeocodeConfirmModalOpen,
    isReportConfirmModalOpen,
    isAddressSearchModalOpen,
    isEditModalOpen,
    isReportMode,
  ]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // 뒤로가기를 눌러 modalActive 가 없는 상태가 감지되면 모든 오버레이 닫기
      if (!e.state || e.state.modalActive !== true) {
        setIsMobileFeedOpen(false);
        setReportModalOpen(false);
        setSelectTypeModalOpen(false);
        setGeocodeConfirmModalOpen(false);
        setReportConfirmModalOpen(false);
        setAddressSearchModalOpen(false);
        setIsEditModalOpen(false);
        resetSelections(); // 기존 핀/피드 선택 상태 원복
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("popstate", handlePopState);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("popstate", handlePopState);
      }
    };
  }, [
    setIsMobileFeedOpen,
    setReportModalOpen,
    setSelectTypeModalOpen,
    setGeocodeConfirmModalOpen,
    setReportConfirmModalOpen,
    setAddressSearchModalOpen,
    resetSelections,
  ]);



  // Countries / Cities / Regions Query definitions
  const { data: countries = [] } = useQuery<Country[]>({
    queryKey: ["countries"],
    queryFn: () => scamsApi.getCountries(),
  });

  const { data: cities = [], isPending: isCitiesPending } = useQuery<City[]>({
    queryKey: ["cities", selectedCountryCode],
    queryFn: () => scamsApi.getCities(selectedCountryCode!),
    enabled: !!selectedCountryCode,
  });

  const { data: regions = [], isPending: isRegionsPending } = useQuery<Region[]>({
    queryKey: ["regions", selectedCityId],
    queryFn: () => scamsApi.getRegions(selectedCityId!),
    enabled: !!selectedCityId,
  });

  // 지도 이동을 위한 전역 지역 정보 목록 조회
  const { data: allRegions = [] } = useQuery<Region[]>({
    queryKey: ["scam-regions"],
    queryFn: () => scamsApi.getAllRegions(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // 동일/근접 좌표를 갖는 모든 지역 필터링 (클러스터 단위 통합 피드 구현 🎯)
  const sharingRegions = selectedRegionId && selectedRegion
    ? allRegions.filter(
        (r) =>
          (r.latitude === selectedRegion.latitude && r.longitude === selectedRegion.longitude) ||
          (Math.abs(r.latitude - selectedRegion.latitude) < NEARBY_LOCATION_THRESHOLD &&
           Math.abs(r.longitude - selectedRegion.longitude) < NEARBY_LOCATION_THRESHOLD)
      )
    : [];
  const selectedRegionIds = sharingRegions.length > 0 
    ? Array.from(new Set(sharingRegions.map((r) => r.id))) 
    : (selectedRegionId ? [selectedRegionId] : []);

  // 내 위치는 서버로 보내지 않고, 브라우저에서 가까운 지역을 계산한 뒤 해당 도시의 목록만 요청한다
  const nearbyResult = useMemo(
    () => (nearby ? findNearbyRegions(nearby.center, allRegions) : null),
    [nearby, allRegions]
  );
  const nearbyDistances = useMemo(
    () => new Map((nearbyResult?.items || []).map((item) => [item.region.id, item.distanceM])),
    [nearbyResult]
  );
  const nearbyCityIds = useMemo(
    () => Array.from(new Set((nearbyResult?.items || []).map((item) => item.region.cityId))),
    [nearbyResult]
  );

  useEffect(() => {
    if (nearby && allRegions.length > 0) {
      setMapZoom(zoomForRadius(nearbyResult?.radiusM ?? null));
    }
  }, [nearby, nearbyResult?.radiusM, allRegions.length, setMapZoom]);

  // 줌 수준 및 선택된 스코프(국가/도시/지역)에 따른 다형적 사기 목록 쿼리
  const { data: scams = EMPTY_ARRAY, isPending: isScamsPending, isFetching: isScamsFetching } = useQuery<ScamInfo[]>({
    queryKey: ["scams", selectedCountryCode, selectedCityId, selectedRegionId, selectedRegionIds.join(","), nearby ? `${nearby.center.join(",")}|${nearbyCityIds.join(",")}` : null],
    queryFn: async () => {
      if (nearby) {
        const results = await Promise.all(nearbyCityIds.map((id) => scamsApi.getScamsByCity(id)));
        const unique = new Map(results.flat().map((scam) => [scam.id, scam]));
        return Array.from(unique.values()).filter(
          (scam) => scam.scope === "city" || scam.scope === "country" || (!!scam.regionId && nearbyDistances.has(scam.regionId))
        );
      }
      if (selectedRegionId) {
        if (selectedRegionIds.length > 1) {
          // 동일 좌표 내의 모든 지역 제보들을 병렬 패치하여 병합
          const results = await Promise.all(
            selectedRegionIds.map((id) => scamsApi.getScamsByRegion(id))
          );
          return results
            .flat()
            .sort((a, b) => b.upvoteCount - a.upvoteCount || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        return scamsApi.getScamsByRegion(selectedRegionId);
      }
      if (selectedCityId) {
        return scamsApi.getScamsByCity(selectedCityId);
      }
      if (selectedCountryCode) {
        return scamsApi.getScamsByCountry(selectedCountryCode);
      }
      return [];
    },
    enabled: !!selectedRegionId || !!selectedCityId || !!selectedCountryCode || (!!nearby && nearbyCityIds.length > 0),
  });

  // scams의 데이터 갱신 시 순서 동결(Freeze) 처리하여 Layout Instability 방지
  useEffect(() => {
    const scamsIds = scams.map((s) => s.id).sort().join(",");
    const prevIds = displayScams.map((s) => s.id).sort().join(",");
    
    if (scamsIds !== prevIds) {
      setDisplayScams(scams);
    } else {
      // 순서를 보존하며 개별 요소의 내용이 변했는지 체크
      let changed = false;
      const updated = displayScams.map((ds) => {
        const fresh = scams.find((s) => s.id === ds.id);
        if (fresh && (
          fresh.upvoteCount !== ds.upvoteCount || 
          fresh.downvoteCount !== ds.downvoteCount || 
          fresh.commentCount !== ds.commentCount || 
          fresh.sightingCount !== ds.sightingCount || 
          fresh.sightedByMe !== ds.sightedByMe || 
          fresh.updatedAt !== ds.updatedAt
        )) {
          changed = true;
          return fresh;
        }
        return ds;
      });
      
      if (changed) {
        setDisplayScams(updated);
      }
    }
  }, [scams, displayScams]);

  // URL regionId 파라미터 실시간 동기화 🔗
  useEffect(() => {
    // 초기 URL 파라미터 파싱이 완료되기 전에는 동기화를 차단하여 파라미터 소실 방지
    if (!isInitialUrlParsed.current) return;

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (selectedRegionId) {
        url.searchParams.set("regionId", selectedRegionId);
        window.history.replaceState(null, "", url.pathname + url.search);
      } else {
        url.searchParams.delete("regionId");
        window.history.replaceState(null, "", url.pathname + url.search);
      }
    }
  }, [selectedRegionId]);

  // 첫 마운트 또는 전체 지역 정보 로드 시, URL regionId 파라미터가 있으면 자동 이동 및 선택 처리 📍
  useEffect(() => {
    if (mounted && allRegions.length > 0 && !isInitialUrlParsed.current) {
      const params = new URLSearchParams(window.location.search);
      const sharedRegionId = params.get("regionId");
      if (sharedRegionId) {
        const targetRegion = allRegions.find((r) => r.id === sharedRegionId);
        if (targetRegion) {
          setSelectedRegionId(targetRegion.id);
          setSelectedRegion(targetRegion);
          if (targetRegion.cityId) setSelectedCityId(targetRegion.cityId);
          if (targetRegion.countryCode) setSelectedCountryCode(targetRegion.countryCode);
          setMapCenter([targetRegion.latitude, targetRegion.longitude]);
          setMapZoom(16);
          
          if (window.innerWidth < 768) {
            setIsMobileFeedOpen(true);
          }
        }
      }
      isInitialUrlParsed.current = true; // 초기 파라미터 파싱 및 맵 배치 완료 설정
    }
  }, [mounted, allRegions, setSelectedRegionId, setSelectedRegion, setSelectedCityId, setSelectedCountryCode, setMapCenter, setMapZoom, setIsMobileFeedOpen]);


  // Upvote/Downvote mutation (낙관적 업데이트로 클릭 즉시 반응 & 깜빡임 차단)
  const reactionMutation = useMutation({
    mutationFn: ({ scamId, type }: { scamId: string; type: "like" | "dislike" }) =>
      scamsApi.toggleReaction(scamId, type),
    onMutate: async ({ scamId, type }) => {
      // 로컬 displayScams에 즉시 반응 반영 (Optimistic Update)
      setDisplayScams((prev) =>
        prev.map((s) => {
          if (s.id !== scamId) return s;
          const reactions = s.reactions || [];
          const hasLike = reactions.some((r) => r.type === "like");
          const hasDislike = reactions.some((r) => r.type === "dislike");

          let newUpvoteCount = s.upvoteCount;
          let newDownvoteCount = s.downvoteCount;
          let newReactions = [...reactions];

          if (type === "like") {
            if (hasLike) {
              newUpvoteCount = Math.max(0, newUpvoteCount - 1);
              newReactions = newReactions.filter((r) => r.type !== "like");
            } else {
              newUpvoteCount += 1;
              newReactions.push({ id: 'temp-like', type: 'like' });
              if (hasDislike) {
                newDownvoteCount = Math.max(0, newDownvoteCount - 1);
                newReactions = newReactions.filter((r) => r.type !== "dislike");
              }
            }
          } else {
            if (hasDislike) {
              newDownvoteCount = Math.max(0, newDownvoteCount - 1);
              newReactions = newReactions.filter((r) => r.type !== "dislike");
            } else {
              newDownvoteCount += 1;
              newReactions.push({ id: 'temp-dislike', type: 'dislike' });
              if (hasLike) {
                newUpvoteCount = Math.max(0, newUpvoteCount - 1);
                newReactions = newReactions.filter((r) => r.type !== "like");
              }
            }
          }

          return {
            ...s,
            upvoteCount: newUpvoteCount,
            downvoteCount: newDownvoteCount,
            reactions: newReactions,
          };
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scams"] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (scamId: string) => scamsApi.deleteScam(scamId),
    onSuccess: () => {
      toast.success("제보가 성공적으로 삭제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["scam-regions"] });
      queryClient.invalidateQueries({ queryKey: ["scams"] });

      // 만약 선택된 특정 지역(Region)의 마지막 제보를 삭제한 경우, 해당 지역 선택을 해제하고 피드창을 닫습니다.
      if (selectedRegionId && scams.length <= 1) {
        setSelectedRegionId(null);
        setSelectedRegion(null);
        setIsMobileFeedOpen(false);
      }
    },
    onError: (error: any) => {
      console.error(error);
      toast.error("제보 삭제에 실패했습니다.");
    }
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: ({ scamId, data }: { scamId: string; data: any }) =>
      scamsApi.updateScam(scamId, data),
    onSuccess: () => {
      toast.success("제보가 성공적으로 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["scams"] });
      editImagePreviews.forEach(url => URL.revokeObjectURL(url));
      setEditImagePreviews([]);
      setEditImageFiles([]);
      setIsEditModalOpen(false);
      setEditingScam(null);
    },
    onError: (error: any) => {
      console.error(error);
      toast.error("제보 수정에 실패했습니다.");
    }
  });

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const totalCount = editExistingImageUrls.length + editImageFiles.length + selectedFiles.length;
      if (totalCount > 5) {
        toast.error("사진은 최대 5장까지 첨부할 수 있습니다.");
        return;
      }
      setEditImageFiles((prev) => [...prev, ...selectedFiles]);
      const newPreviews = selectedFiles.map((file) => URL.createObjectURL(file));
      setEditImagePreviews((prev) => [...prev, ...newPreviews]);
    }
  };

  const removeEditExistingImage = (index: number) => {
    setEditExistingImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const removeEditNewImage = (index: number) => {
    setEditImageFiles((prev) => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(editImagePreviews[index]);
    setEditImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScam) return;
    if (editDescription.trim().length < 10) {
      toast.error("설명은 최소 10자 이상 입력해야 합니다.");
      return;
    }
    if (!editScamCategory) {
      toast.error("사기 피해 카테고리를 최소 1개 이상 선택해 주세요.");
      return;
    }
    if (hasOtherCategory(editScamCategory) && editOtherCategoryNote.trim().length < OTHER_NOTE_MIN_LENGTH) {
      toast.error("기타를 고르면 한 줄로 알려 주세요.");
      return;
    }

    setIsUploading(true);
    try {
      const uploadedUrls = await Promise.all(
        editImageFiles.map(async (file) => {
          const isAnimated = file.type === "image/gif" || file.type === "image/webp";
          return uploadsApi.uploadImage(file, {
            compress: !isAnimated,
            folder: "scams",
          });
        })
      );

      const finalImageUrls = [...editExistingImageUrls, ...uploadedUrls];

      editMutation.mutate({
        scamId: editingScam.id,
        data: {
          title: editTitle,
          description: editDescription,
          avoidanceTip: editAvoidanceTip || null,
          sourceUrl: editSourceUrl || null,
          scamCategory: editScamCategory,
          otherCategoryNote: hasOtherCategory(editScamCategory) ? editOtherCategoryNote.trim() : null,
          audienceNationalities: serializeAudienceNationalities(editAudienceNationalities),
          imageUrls: finalImageUrls.length > 0 ? finalImageUrls : null,
        }
      });
    } catch (err) {
      toast.error("이미지 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  // Close cleanup
  useEffect(() => {
    if (!isEditModalOpen) {
      editImagePreviews.forEach(url => URL.revokeObjectURL(url));
      setEditImagePreviews([]);
      setEditImageFiles([]);
    }
  }, [isEditModalOpen]);

  // 제보 카드를 누르면 내용을 펼치고, 해당 위치의 마커를 지도에서 강조한다
  const handleCardClick = (scam: ScamInfo) => {
    // 펼친 제보를 겪은 사람들의 위치를 지도에 점으로 보여 준다
    setFocusedScamId(expandedScamIds.has(scam.id) ? null : scam.id);
    setExpandedScamIds((prev) => {
      const next = new Set(prev);
      if (next.has(scam.id)) next.delete(scam.id);
      else next.add(scam.id);
      return next;
    });
    const region = allRegions.find(r => r.id === scam.regionId);
    if (region) {
      setHighlightedRegionId(region.id);
      setMapCenter([region.latitude, region.longitude]);
      setMapZoom(Math.max(mapZoom, 15));
    }
  };

  const cancelSightingMutation = useMutation({
    mutationFn: (scamId: string) => scamsApi.deleteSighting(scamId),
    onSuccess: (_data, scamId) => {
      toast.success("겪은 위치 기록을 취소했습니다.");
      queryClient.invalidateQueries({ queryKey: ["scams"] });
      queryClient.invalidateQueries({ queryKey: ["scam-sightings", scamId] });
    },
    onError: () => {
      toast.error("기록을 취소하지 못했습니다. 다시 시도해 주세요.");
    },
  });

  const handleSightingClick = (scam: ScamInfo) => {
    if (!isAuthenticated) {
      if (confirm(t("common.login_required_confirm", { defaultValue: "로그인이 필요한 기능입니다. 로그인 페이지로 이동하시겠습니까?" }))) {
        router.push("/login");
      }
      return;
    }
    if (scam.sightedByMe) {
      cancelSightingMutation.mutate(scam.id);
      return;
    }
    setFocusedScamId(scam.id);
    setExpandedScamIds((prev) => new Set(prev).add(scam.id));
    const region = allRegions.find((r) => r.id === scam.regionId);
    if (region) {
      setMapCenter([region.latitude, region.longitude]);
      setMapZoom(Math.max(mapZoom, 16));
    }
    setSightingPick({ scamId: scam.id, title: scam.title });
  };

  const selectRegionFromFeed = (region: Region) => {
    setSelectedCountryCode(region.countryCode || null);
    setSelectedCityId(region.cityId);
    setSelectedRegionId(region.id);
    setSelectedRegion(region);
    setMapCenter([region.latitude, region.longitude]);
    setMapZoom(15);
  };

  // 공유하기 기능 🔗
  const handleShare = () => {
    if (!selectedRegionId) return;
    
    const shareUrl = `${window.location.origin}${window.location.pathname}?regionId=${selectedRegionId}`;
    
    // 모바일/태블릿 기기 여부 감지
    const isMobileDevice = typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (navigator.share && isMobileDevice) {
      navigator.share({
        title: "ReadyBeforeGo - 위험 제보 정보",
        text: `📍 ${selectedRegion?.name || "지정 위치"}의 피해 제보 및 주의 정보입니다.`,
        url: shareUrl,
      })
      .then(() => toast.success("성공적으로 공유되었습니다."))
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Share failed:", err);
        }
      });
    } else {
      // 데스크톱 환경에서는 시스템 공유창 대신 즉시 클립보드로 링크 복사
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          toast.success("공유 링크가 클립보드에 복사되었습니다! 🔗");
        })
        .catch((err) => {
          console.error("Clipboard copy failed:", err);
          toast.error("링크 복사에 실패했습니다. 주소창의 URL을 직접 복사해 주세요.");
        });
    }
  };

  // Location selector change handlers
  const handleCountryChange = (code: string) => {
    setSelectedCountryCode(code);
    setSelectedCityId(null);
    setSelectedRegionId(null);
    setSelectedRegion(null);
  };

  const handleCityChange = (cityId: string) => {
    const city = cities.find(c => c.id === cityId);
    setSelectedCityId(cityId);
    setSelectedRegionId(null);
    setSelectedRegion(null);
    if (city) {
      setMapCenter([city.latitude, city.longitude]);
      setMapZoom(11);
    }
  };

  const handleRegionChange = (regionId: string) => {
    const region = regions.find(r => r.id === regionId);
    setSelectedRegionId(regionId);
    if (region) {
      setSelectedRegion(region);
      setMapCenter([region.latitude, region.longitude]);
      setMapZoom(14);
    }
  };

  // Common warning feed renderer shared between Desktop sidebar and Mobile sheet
  const renderFeedContent = () => {
    const chips = [
      { value: "all", label: "전체" },
      { value: "spot", label: "특정 위치" },
      { value: "region", label: "구역 전체" },
      { value: "city", label: "도시 전체" },
      { value: "country", label: "국가 전체" },
    ] as const;

    // 피드 목록 렌더링 시 특정 위치/구역(spot/region) 제보글이 최상단에 1순위로 노출되도록 정렬 🎯
    const distanceOf = (scam: ScamInfo) => (scam.regionId ? nearbyDistances.get(scam.regionId) : undefined);

    const sortedDisplayScams = [...displayScams].sort((a, b) => {
      const getScopePriority = (scope?: string) => {
        if (scope === "spot" || scope === "region") return 1;
        if (scope === "city") return 2;
        if (scope === "country") return 3;
        return 4;
      };
      const priorityA = getScopePriority(a.scope);
      const priorityB = getScopePriority(b.scope);
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      const distanceA = distanceOf(a);
      const distanceB = distanceOf(b);
      if (distanceA !== undefined && distanceB !== undefined && distanceA !== distanceB) {
        return distanceA - distanceB;
      }
      return b.upvoteCount - a.upvoteCount || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const filteredScams = sortedDisplayScams.filter((s) => {
      if (filterReportType !== "ALL" && (s.reportType || "CAUTION") !== filterReportType) return false;
      if (feedScopeFilter === "all") return true;
      return s.scope === feedScopeFilter;
    });

    // 어디서 겪을 수 있는 내용인지 범위별로 묶어 보여 준다
    const groupLabelOf = (scam: ScamInfo) => {
      if (scam.scope === "city") {
        const cityName = allRegions.find((r) => r.cityId === scam.cityId)?.cityName || "도시";
        return `${cityName} 어디서나`;
      }
      if (scam.scope === "country") {
        return `${getCountryName(scam.countryCode, lang) || "이 나라"} 어디서나`;
      }
      if (nearby) return nearby.kind === "gps" ? "내 주변" : `${nearby.label} 주변`;
      return selectedRegion ? "이 근처에서" : "장소별";
    };

    const distanceLabelOf = (scam: ScamInfo) => {
      const distance = distanceOf(scam);
      if (distance === undefined) return null;
      if (scam.scope === "region" && distance <= REGION_AREA_RADIUS_M) {
        return nearby?.kind === "gps" ? "지금 이 구역 안" : "이 구역 안";
      }
      return formatDistance(distance);
    };

    if (nearby && nearbyResult && nearbyResult.items.length === 0) {
      const nearest = nearbyResult.nearest;
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Info className="w-8 h-8 text-slate-300" />
          <p className="text-sm text-muted-foreground">이 주변에는 아직 등록된 주의사항이 없습니다.</p>
          {nearest && (
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => selectRegionFromFeed(nearest.region)}>
              가장 가까운 곳 보기: {nearest.region.name} ({formatDistance(nearest.distanceM)})
            </Button>
          )}
        </div>
      );
    }

    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    };

    const formatDateTime = (dateStr: string) => {
      const d = new Date(dateStr);
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${yy}-${mm}-${dd} ${hh}:${min}`;
    };

    return (
      <div className="space-y-4 pb-8">
        {/* 필터 칩 목록 🎛️ */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] select-none">
          {chips.map((chip) => {
            const isActive = feedScopeFilter === chip.value;
            const count = chip.value === "all" 
              ? displayScams.length 
              : displayScams.filter(s => s.scope === chip.value).length;

            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => setFeedScopeFilter(chip.value)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all duration-200 ${
                  isActive
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {chip.label} <span className="text-[10px] opacity-75 ml-0.5 font-bold">({count})</span>
              </button>
            );
          })}
        </div>

        {isScamsPending && displayScams.length === 0 ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i} className="border-border">
                <CardHeader className="space-y-2 p-4">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredScams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
            <Info className="w-8 h-8 text-slate-300" />
            <p className="text-xs text-muted-foreground">
              {feedScopeFilter === "all" ? t("common.empty_warnings") : "선택한 범위의 제보가 없습니다."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredScams.map((scam, scamIndex) => {
              const isExpanded = expandedScamIds.has(scam.id);
              const groupLabel = groupLabelOf(scam);
              const showGroupLabel = feedScopeFilter === "all" && (scamIndex === 0 || groupLabelOf(filteredScams[scamIndex - 1]) !== groupLabel);
              const distanceLabel = distanceLabelOf(scam);
              const isSuperAdmin = user?.role === "super_admin";
              const isOwner = user && scam.userId === user.id;
              const canManage = isSuperAdmin || isOwner;
              
              const isEdited = new Date(scam.updatedAt).getTime() - new Date(scam.createdAt).getTime() > 1000;

              return (
                <div key={scam.id} className="space-y-2">
                {showGroupLabel && (
                  <h3 className="pt-1 text-xs font-bold text-muted-foreground">{groupLabel}</h3>
                )}
                <Card 
                  className="border-border overflow-hidden hover:border-slate-300 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer"
                  onClick={() => handleCardClick(scam)}
                  onMouseEnter={() => setHighlightedRegionId(scam.regionId || null)}
                  onMouseLeave={() => setHighlightedRegionId(null)}
                >
                  <CardHeader className="p-4 pb-2 space-y-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        {distanceLabel && (
                          <Badge className="bg-blue-600 text-white text-[10px] font-bold py-0.5 px-2 shrink-0">
                            {distanceLabel}
                          </Badge>
                        )}
                        {/* 적용 범위 배지 뱃지 🏷️ */}
                        {isExpanded && scam.scope === "country" && (
                          <Badge variant="outline" className="bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50 text-red-600 dark:text-red-400 text-[10px] font-bold py-0.5 px-2 select-none shrink-0">
                            {scam.countryCode ? `🇹🇭 ${getCountryName(scam.countryCode, lang)} 전체` : "🇹🇭 국가 경보"}
                          </Badge>
                        )}
                        {isExpanded && scam.scope === "city" && (() => {
                          const matchedRegion = allRegions.find(r => r.cityId === scam.cityId);
                          const cityName = matchedRegion?.cityName || "도시";
                          return (
                            <Badge variant="outline" className="bg-amber-50 border-amber-250 dark:bg-amber-950/20 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 text-[10px] font-bold py-0.5 px-2 select-none shrink-0">
                              🏙️ {cityName} 전체
                            </Badge>
                          );
                        })()}
                        {isExpanded && scam.scope === "region" && (
                          <Badge variant="outline" className="bg-violet-50 border-violet-200 dark:bg-violet-950/20 dark:border-violet-900/50 text-violet-700 dark:text-violet-400 text-[10px] font-bold py-0.5 px-2 select-none shrink-0">
                            🗺️ 구역 전체
                          </Badge>
                        )}
                        {isExpanded && scam.scope === "spot" && (
                          <Badge variant="outline" className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/50 text-blue-700 dark:text-blue-400 text-[10px] font-bold py-0.5 px-2 select-none shrink-0">
                            📍 특정 위치
                          </Badge>
                        )}

                        {/* 위치 정보(Breadcrumb) 및 세부 점포(subLocation) 뱃지 🗺️ */}
                        {(() => {
                          const currentScamRegion = allRegions.find((r) => r.id === scam.regionId);
                          if (currentScamRegion) {
                            return (
                              <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-semibold py-0.5 px-2 max-w-full truncate">
                                📍 {currentScamRegion.cityName} · {currentScamRegion.name}
                              </Badge>
                            );
                          }
                          return null;
                        })()}

                        {scam.subLocation && (
                          <Badge variant="outline" className="bg-amber-50/80 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 text-[10px] font-bold py-0.5 px-2 shrink-0">
                            🏬 {scam.subLocation}
                          </Badge>
                        )}
                        {scam.scamCategory.split(",").filter(Boolean).map((catKey) => {
                          const cat = getCategoryInfo(catKey, t, scam.otherCategoryNote);
                          return (
                            <Badge key={catKey} variant="outline" className={`${cat.color} border text-[10px] font-semibold py-0.5 px-2 shrink-0`}>
                              {cat.label}
                            </Badge>
                          );
                        })}
                        {isExpanded && (
                          <>
                            <AudienceNationalityBadges value={scam.audienceNationalities} />
                            <span className="text-[10px] text-muted-foreground select-none shrink-0">
                              {formatDate(scam.createdAt)}
                              {isEdited && ` (수정됨: ${formatDateTime(scam.updatedAt)})`}
                            </span>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0 ml-auto whitespace-nowrap">
                        {scam.sourceUrl && (
                          <a 
                            href={formatExternalUrl(scam.sourceUrl)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 shrink-0 whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t("common.source_link")} <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        )}

                        {canManage && (
                          <div className="flex items-center gap-1 text-[10px] shrink-0 whitespace-nowrap">
                            <span className="text-slate-300 select-none">|</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingScam(scam);
                                setEditTitle(scam.title);
                                setEditDescription(scam.description);
                                setEditAvoidanceTip(scam.avoidanceTip || "");
                                setEditSourceUrl(scam.sourceUrl || "");
                                setEditScamCategory(scam.scamCategory);
                                setEditOtherCategoryNote(scam.otherCategoryNote || "");
                                setEditAudienceNationalities(parseAudienceNationalities(scam.audienceNationalities));
                                setEditExistingImageUrls(scam.imageUrls || []);
                                setEditImageFiles([]);
                                setEditImagePreviews([]);
                                setIsEditModalOpen(true);
                              }}
                              className="text-slate-500 hover:text-blue-600 font-bold px-1 py-0.5 rounded hover:bg-slate-100 cursor-pointer transition-colors whitespace-nowrap"
                            >
                              수정
                            </button>
                            <span className="text-slate-300 select-none">|</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("정말로 이 제보를 삭제하시겠습니까?")) {
                                  deleteMutation.mutate(scam.id);
                                }
                              }}
                              className="text-slate-500 hover:text-red-600 font-bold px-1 py-0.5 rounded hover:bg-slate-100 cursor-pointer transition-colors whitespace-nowrap"
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-sm font-bold leading-snug">{scam.title}</CardTitle>
                  </CardHeader>
                  
                  <CardContent className="p-4 pt-0 pb-3 space-y-3">
                    {isExpanded && (
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                      {scam.description}
                    </p>
                    )}

                    {/* Attached image gallery layout */}
                    {isExpanded && scam.imageUrls && Array.isArray(scam.imageUrls) && scam.imageUrls.length > 0 && (
                      <div className={`grid gap-1.5 rounded-lg overflow-hidden ${
                        scam.imageUrls.length === 1 
                          ? 'grid-cols-1' 
                          : scam.imageUrls.length === 2 
                            ? 'grid-cols-2' 
                            : 'grid-cols-3'
                      }`}>
                        {scam.imageUrls.map((url, idx) => (
                          <button 
                            key={idx} 
                            type="button"
                            className="block relative aspect-[4/3] overflow-hidden border border-slate-100 dark:border-slate-800 hover:opacity-90 transition-opacity cursor-pointer text-left"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMediaScam(scam);
                              setActiveMediaIndex(idx);
                            }}
                          >
                            <img 
                              src={url} 
                              alt={`scam-attachment-${idx}`} 
                              className="w-full h-full object-cover" 
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    {scam.avoidanceTip && (
                      <div className={scam.reportType === "TIP"
                        ? "bg-emerald-50/50 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-800 space-y-1 dark:bg-emerald-950/10 dark:border-emerald-950/20 dark:text-emerald-300"
                        : "bg-rose-50/50 border border-rose-100 rounded-lg p-3 text-xs text-rose-800 space-y-1 dark:bg-rose-950/10 dark:border-rose-950/20 dark:text-rose-300"
                      }>
                        <h4 className="font-bold flex items-center gap-1">
                          {scam.reportType === "TIP" ? (
                            <>
                              <Lightbulb className="w-3.5 h-3.5 text-emerald-600" /> 
                              <span>추가 팁 & 유의사항</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> 
                              <span>{t("common.avoidance_title")}</span>
                            </>
                          )}
                        </h4>
                        <p className={`leading-relaxed whitespace-pre-line ${isExpanded ? "" : "line-clamp-2"}`}>{scam.avoidanceTip}</p>
                      </div>
                    )}

                    {isExpanded && !!scam.sightingCount && (
                      <p className="text-xs font-medium text-red-700 dark:text-red-400">
                        {scam.sightingCount}명이 겪었어요. 지도의 빨간 점이 겪은 위치입니다.
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        className="text-xs font-semibold text-blue-700 dark:text-blue-400 cursor-pointer"
                      >
                        {isExpanded ? "접기" : "자세히 보기"}
                      </button>

                      {scam.reportType !== "TIP" && (
                        <button
                          type="button"
                          disabled={cancelSightingMutation.isPending}
                          aria-pressed={!!scam.sightedByMe}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSightingClick(scam);
                          }}
                          className={`flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-bold transition-colors cursor-pointer disabled:cursor-wait ${
                            scam.sightedByMe
                              ? "border-red-600 bg-red-600 text-white"
                              : "border-border text-foreground hover:bg-muted"
                          }`}
                        >
                          {scam.sightedByMe ? "기록 취소" : "나도 겪었어요"}
                          {!!scam.sightingCount && <span className="font-black">{scam.sightingCount}</span>}
                        </button>
                      )}
                    </div>

                    {/* Card Footer Actions */}
                    {isExpanded && (
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-muted-foreground">
                      
                      {/* Reactions (Likes/Dislikes) & Comments */}
                      {(() => {
                        const isLiked = scam.reactions && scam.reactions.some(r => r.type === "like");
                        const isDisliked = scam.reactions && scam.reactions.some(r => r.type === "dislike");
                        const isCommentsOpen = activeCommentScamId === scam.id;
                        return (
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              disabled={reactionMutation.isPending}
                              className={`h-7 w-7 rounded-full hover:bg-slate-100 cursor-pointer active:scale-95 transition-transform group disabled:opacity-50 disabled:cursor-not-allowed ${
                                isLiked ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/20' : ''
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isAuthenticated) {
                                  if (confirm(t("common.login_required_confirm", { defaultValue: "로그인이 필요한 기능입니다. 로그인 페이지로 이동하시겠습니까?" }))) {
                                    router.push("/login");
                                  }
                                  return;
                                }
                                reactionMutation.mutate({ scamId: scam.id, type: "like" });
                              }}
                            >
                              <ThumbsUp className={`w-3.5 h-3.5 transition-colors ${isLiked ? 'fill-blue-600 stroke-blue-600 text-blue-600' : 'text-slate-500 group-hover:stroke-blue-600'}`} />
                            </Button>
                            <span className={`font-bold text-[11px] min-w-[12px] text-center ${isLiked ? 'text-blue-600' : 'text-slate-700'}`}>{scam.upvoteCount}</span>

                            <Button 
                              variant="ghost" 
                              size="icon" 
                              disabled={reactionMutation.isPending}
                              className={`h-7 w-7 rounded-full hover:bg-slate-100 cursor-pointer active:scale-95 transition-transform group disabled:opacity-50 disabled:cursor-not-allowed ${
                                isDisliked ? 'text-red-600 bg-red-50 dark:bg-red-950/20' : ''
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isAuthenticated) {
                                  if (confirm(t("common.login_required_confirm", { defaultValue: "로그인이 필요한 기능입니다. 로그인 페이지로 이동하시겠습니까?" }))) {
                                    router.push("/login");
                                  }
                                  return;
                                }
                                reactionMutation.mutate({ scamId: scam.id, type: "dislike" });
                              }}
                            >
                              <ThumbsDown className={`w-3.5 h-3.5 transition-colors ${isDisliked ? 'fill-red-600 stroke-red-600 text-red-600' : 'text-slate-500 group-hover:stroke-red-600'}`} />
                            </Button>
                            <span className={`text-[11px] min-w-[12px] text-center ${isDisliked ? 'text-red-600 font-bold' : 'text-slate-500'} mr-2`}>{scam.downvoteCount}</span>

                            {/* 댓글 버튼 (싫어요 우측) */}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={`h-7 w-7 rounded-full hover:bg-slate-100 cursor-pointer active:scale-95 transition-transform group ${
                                isCommentsOpen ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/20' : ''
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveCommentScamId(isCommentsOpen ? null : scam.id);
                              }}
                            >
                              <MessageSquare className={`w-3.5 h-3.5 transition-colors ${isCommentsOpen ? 'fill-blue-600 stroke-blue-600 text-blue-600' : 'text-slate-500 group-hover:stroke-blue-600'}`} />
                            </Button>
                            <span className={`text-[11px] min-w-[12px] text-center ${isCommentsOpen ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>{scam.commentCount || 0}</span>
                          </div>
                        );
                      })()}

                      {/* Report (Flag) trigger */}
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveReportScamId(scam.id);
                          }}
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    )}

                    {/* Collapsible Discussion Panel */}
                    {activeCommentScamId === scam.id && (
                      <div 
                        className="border-t border-slate-100 dark:border-slate-800 pt-2 transition-all duration-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Comments 
                          targetType="scam_info" 
                          targetId={scam.id} 
                          allowAnonymous={true} 
                          onMutationSuccess={() => {
                            queryClient.invalidateQueries({ queryKey: ["scams"] });
                          }}
                        />
                      </div>
                    )}
                  </CardContent>

                  {/* Flag Dialog */}
                  <ReportDialog
                    isOpen={activeReportScamId === scam.id}
                    onClose={() => setActiveReportScamId(null)}
                    targetType="SCAM_INFO"
                    targetId={scam.id}
                  />
                </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // 목록 패널 제목과 동작 버튼 (데스크톱·휴대폰 공통)
  const renderPanelHeader = () => {
    const placeName = (() => {
      if (nearby) return nearby.kind === "gps" ? "내 주변" : `${nearby.label} 주변`;
      if (selectedRegion) return selectedRegion.name;
      if (selectedCityId) {
        return cities.find((c) => c.id === selectedCityId)?.name
          || allRegions.find((r) => r.cityId === selectedCityId)?.cityName
          || "도시";
      }
      return getCountryName(selectedCountryCode, lang) || "국가";
    })();
    const radiusM = nearbyResult?.radiusM;

    return (
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="font-bold text-sm text-card-foreground truncate">{placeName} 주의사항</h2>
            {nearby && radiusM && (
              <p className="text-xs text-muted-foreground">반경 {formatRadius(radiusM)} 안에서 찾았어요</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedRegionId && (
            <>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-8 px-2.5 rounded-full flex items-center gap-1 shadow-sm cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                onClick={() => {
                  if (!isAuthenticated) {
                    if (confirm(t("common.login_required_confirm", { defaultValue: "로그인이 필요한 기능입니다. 로그인 페이지로 이동하시겠습니까?" }))) {
                      router.push("/login");
                    }
                    return;
                  }
                  setIsReportMode(true);
                  setReportType("existing");
                  setReportCoords([selectedRegion!.latitude, selectedRegion!.longitude]);
                  setItemReportTypeModalOpen(true);
                  setIsMobileFeedOpen(false);
                }}
              >
                <span aria-hidden="true">➕</span>
                <span>제보 추가</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full cursor-pointer hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
                onClick={handleShare}
                title="공유하기"
                aria-label="공유하기"
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full cursor-pointer hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
            onClick={resetSelections}
            title="닫기"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Prevent rendering dynamic values during SSR to avoid Hydration Error
  if (!mounted) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <Compass className="w-12 h-12 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] w-full overflow-hidden bg-background font-sans relative">
      
      {/* Left Map Canvas (Occupies full viewport on mobile) */}
      {/* 휴대폰에서 목록이 열리면 지도를 줄여 선택한 위치가 목록에 가리지 않게 한다 */}
      <div className={`md:flex-1 md:h-full relative z-0 ${isMobileFeedOpen && !isReportMode && !sightingPick ? "flex-none h-[calc(52%-4rem)]" : "flex-1 h-[calc(100vh-8rem)]"}`}>
        <ReadyBeforeGoMap />

        {/* 플로팅 컨트롤 그룹 (여행지 검색 + 제보하기 버튼). 제보 위치를 고르는 동안에는 안내 배너에 자리를 내준다 */}
        <div className={`absolute top-2.5 right-2.5 flex items-center justify-end gap-2 ${isReportMode ? "z-10" : "left-2.5 z-[1100]"}`}>
          {!isReportMode && !sightingPick && <PlaceSearch regions={allRegions} />}

          {/* 맵 직접 제보하기 플로팅 버튼 */}
          {!sightingPick && <Button
            size="sm"
            variant={isReportMode ? "destructive" : "default"}
            className={`font-bold text-xs h-10 px-3.5 rounded-full shrink-0 shadow-lg flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 border ${
              isReportMode 
                ? "bg-red-600 border-red-700 text-white animate-pulse" 
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
            onClick={() => {
              if (!isAuthenticated) {
                if (confirm(t("common.login_required_confirm", { defaultValue: "로그인이 필요한 기능입니다. 로그인 페이지로 이동하시겠습니까?" }))) {
                  router.push("/login");
                }
                return;
              }
              if (isReportMode) {
                setIsReportMode(false);
              } else {
                setSelectTypeModalOpen(true);
              }
            }}
          >
            {isReportMode ? t("common.report_cancel_btn") : t("common.report_direct_btn")}
          </Button>}
        </div>
      </div>

      {/* 데스크톱 오른쪽 목록 패널 */}
      {isFeedActive && !isReportMode && (
        <div className="hidden md:flex w-[450px] h-full flex-col border-l border-border bg-card/95 backdrop-blur-md z-10 shadow-lg shrink-0">
          <div className="px-6 py-4 bg-muted/40 border-b border-border shrink-0">
            {renderPanelHeader()}
          </div>
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200">
            {renderFeedContent()}
          </div>
        </div>
      )}

      {/* 휴대폰 하단 목록 시트. 지도를 계속 보고 만질 수 있도록 모달로 띄우지 않는다 */}
      {isMobileFeedOpen && !isReportMode && !sightingPick && (
        <div
          className={`md:hidden absolute inset-x-0 bottom-16 z-20 flex flex-col overflow-hidden rounded-t-2xl border-t border-border bg-card shadow-[0_-8px_30px_rgba(0,0,0,0.2)] transition-[height] duration-200 ${
            isSheetExpanded ? "h-[calc(100%-5rem)]" : "h-[48%]"
          }`}
        >
          <button
            type="button"
            aria-label={isSheetExpanded ? "목록 줄이기" : "목록 크게 보기"}
            aria-expanded={isSheetExpanded}
            onClick={() => setIsSheetExpanded((prev) => !prev)}
            onPointerDown={(event) => {
              sheetDragStartY.current = event.clientY;
            }}
            onPointerUp={(event) => {
              const start = sheetDragStartY.current;
              sheetDragStartY.current = null;
              if (start === null) return;
              const delta = event.clientY - start;
              if (delta < -30) setIsSheetExpanded(true);
              if (delta > 30) setIsSheetExpanded(false);
              if (Math.abs(delta) > 30) event.preventDefault();
            }}
            className="flex h-6 w-full shrink-0 cursor-grab touch-none items-center justify-center bg-muted/40"
          >
            <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
          </button>
          <div className="px-4 pb-3 pt-1 bg-muted/40 border-b border-border shrink-0">
            {renderPanelHeader()}
          </div>
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {renderFeedContent()}
          </div>
        </div>
      )}

      {/* --- 필터 다이얼로그 (상단 둥둥 검색바 터치 시 팝업) --- */}
      <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
        <DialogContent className="w-[90%] max-w-[360px] p-5 rounded-2xl bg-card border border-border">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-extrabold flex items-center gap-1.5">
              🧭 {t("common.welcome_title")}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-2">
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  {t("report_modal.country")}
                </label>
                <SearchableSelect
                  value={selectedCountryCode || ""}
                  onValueChange={handleCountryChange}
                  placeholder={t("report_modal.country_select")}
                  searchPlaceholder="국가명 검색"
                  options={countries
                    .map((c) => {
                      const displayName = getCountryName(c.code || c.name, lang) || c.name || c.code;
                      return {
                        value: c.code,
                        label: displayName,
                        keywords: `${c.name} ${c.nameEn} ${c.code}`,
                      };
                    })
                    .sort((a, b) => a.label.localeCompare(b.label, "ko"))}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  {t("report_modal.city")}
                </label>
                <SearchableSelect
                  value={selectedCityId || ""}
                  onValueChange={handleCityChange}
                  disabled={!selectedCountryCode || isCitiesPending}
                  placeholder={t("report_modal.city_select")}
                  searchPlaceholder="도시명 검색"
                  options={cities.map((city) => ({
                    value: city.id,
                    label: city.name,
                    keywords: `${city.name} ${city.nameEn}`,
                  }))}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  {t("report_modal.place_name")}
                </label>
                <Select 
                  value={selectedRegionId || ""} 
                  onValueChange={handleRegionChange}
                  disabled={!selectedCityId || isRegionsPending || regions.length === 0}
                >
                  <SelectTrigger className="w-full text-xs cursor-pointer">
                    <SelectValue placeholder={
                      !selectedCityId
                        ? "도시를 먼저 선택해 주세요"
                        : isRegionsPending
                          ? "불러오는 중..."
                          : regions.length === 0
                            ? "등록된 장소가 없습니다"
                            : "선택"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="cursor-pointer">
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>


            
            <Button 
              className="w-full mt-2 cursor-pointer font-bold text-xs bg-red-600 hover:bg-red-700 text-white" 
              onClick={() => setIsFilterModalOpen(false)}
            >
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 실시간 사용자 직접 제보 모달 (UGC 폼) */}
      <ScamReportModal />
      <GeocodeConfirmModal />
      <AddressSearchModal />

      {/* 제보 방식 분기 다이얼로그 */}
      <Dialog open={isSelectTypeModalOpen} onOpenChange={setSelectTypeModalOpen}>
        <DialogContent className="w-[90%] max-w-[420px] p-6 rounded-2xl bg-card border border-border shadow-2xl">
          <DialogHeader className="space-y-1.5 text-center">
            <DialogTitle className="text-lg font-black tracking-tight flex items-center justify-center gap-1.5 text-foreground">
              제보 위치 지정
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground text-center">
              제보 등록을 위한 위치 지정 방식을 선택해 주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3.5 pt-3">
            <button
              type="button"
              className="flex items-start gap-3.5 p-4 rounded-xl border border-border bg-card hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-all text-left group cursor-pointer shadow-sm hover:shadow"
              onClick={() => {
                const requestCurrentPosition = () => {
                  toast.loading("현재 위치 정보를 수신하고 있습니다...", { id: "geolocation-loading" });
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const { latitude, longitude } = position.coords;
                      
                      // 1. 지도 중심 이동, 최대 줌 설정 및 제보 핀 활성화
                      setMapCenter([latitude, longitude]);
                      setMapZoom(18);
                      setIsReportMode(true);
                      setReportCoords([latitude, longitude]);

                      // 다른 위치 확인 다이얼로그들 우선 해제
                      setReportConfirmModalOpen(false);
                      setGeocodeConfirmModalOpen(false);
                      setSelectTypeModalOpen(false);

                      // 2. 백그라운드 지오코딩 수행 후 제보 위치 확인 모달 기동
                      scamsApi.reverseGeocode(latitude, longitude)
                        .then((data: any) => {
                          toast.dismiss("geolocation-loading");
                          if (data && data.address && Object.keys(data.address).length > 0) {
                            setReportType("new");
                            setGeoData(data);
                            setReportConfirmModalOpen(true);
                            toast.success("현재 위치 수신 성공! 지도를 확인해 주세요. 📍");
                          } else {
                            setReportType("new");
                            setGeocodeConfirmModalOpen(true);
                            toast.warning("상세 주소를 수신하지 못해 주소 검색 창을 엽니다.");
                          }
                        })
                        .catch((err: any) => {
                          toast.dismiss("geolocation-loading");
                          console.error("Geolocation reverse geocode error:", err);
                          setReportType("new");
                          setGeocodeConfirmModalOpen(true);
                          toast.error("통신 장애로 수동 주소 검색 창을 엽니다.");
                        });
                    },
                    (error) => {
                      toast.dismiss("geolocation-loading");
                      console.error("Geolocation error:", error);
                      
                      if (error.code === error.PERMISSION_DENIED) {
                        const confirmRetry = window.confirm(
                          "위치 권한 수집 동의가 필요합니다.\n\n" +
                          "주소창 좌측의 설정(자물쇠) 아이콘을 눌러 위치 권한을 '허용'으로 변경하신 후 [확인]을 누르면 권한 요청을 다시 시도합니다.\n\n" +
                          "주소 직접 검색으로 대신 제보하시려면 [취소]를 눌러주세요."
                        );
                        if (confirmRetry) {
                          requestCurrentPosition();
                        } else {
                          setReportType("new");
                          setAddressSearchModalOpen(true);
                          setSelectTypeModalOpen(false);
                        }
                      } else {
                        toast.error("위치 획득에 실패했습니다. 주소 검색 창을 대신 엽니다.");
                        setReportType("new");
                        setAddressSearchModalOpen(true);
                        setSelectTypeModalOpen(false);
                      }
                    },
                    { enableHighAccuracy: true, timeout: 8500, maximumAge: 0 }
                  );
                };

                if (typeof window === "undefined" || !navigator.geolocation) {
                  toast.error("위치 서비스를 지원하지 않는 환경입니다. 주소 검색을 실행합니다.");
                  setReportType("new");
                  setAddressSearchModalOpen(true);
                  setSelectTypeModalOpen(false);
                  return;
                }

                // 권한 사전 조회 후 거부(denied) 상태이면 브라우저 설정 안내 띄움
                if (navigator.permissions && navigator.permissions.query) {
                  navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((permissionStatus) => {
                    if (permissionStatus.state === 'denied') {
                      const confirmRetry = window.confirm(
                        "브라우저의 위치 권한이 차단되어 있습니다.\n\n" +
                        "주소창 좌측의 설정(자물쇠/슬라이더) 아이콘을 클릭하여 위치 권한을 '허용'으로 설정한 뒤 [확인]을 클릭하시면 다시 위치 요청을 시작합니다.\n\n" +
                        "주소 검색을 대신 이용하시려면 [취소]를 클릭해 주세요."
                      );
                      if (confirmRetry) {
                        requestCurrentPosition();
                      } else {
                        setReportType("new");
                        setAddressSearchModalOpen(true);
                        setSelectTypeModalOpen(false);
                      }
                    } else {
                      requestCurrentPosition();
                    }
                  }).catch(() => {
                    requestCurrentPosition();
                  });
                } else {
                  requestCurrentPosition();
                }
              }}
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform shrink-0">
                🎯
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">현재 내 위치에서 제보</h4>
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  현재 내 위치에서 제보합니다.
                </p>
              </div>
            </button>

            <button
              type="button"
              className="flex items-start gap-3.5 p-4 rounded-xl border border-border bg-card hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-all text-left group cursor-pointer shadow-sm hover:shadow"
              onClick={() => {
                setReportType("new");
                setIsReportMode(true);
                setSelectTypeModalOpen(false);
              }}
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform shrink-0">
                📍
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">지도에서 직접 핀 찍기</h4>
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  지도의 특정 위치에 제보합니다.
                </p>
              </div>
            </button>

            <button
              type="button"
              className="flex items-start gap-3.5 p-4 rounded-xl border border-border bg-card hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-all text-left group cursor-pointer shadow-sm hover:shadow"
              onClick={() => {
                setReportType("new");
                setAddressSearchModalOpen(true);
                setSelectTypeModalOpen(false);
              }}
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform shrink-0">
                🔍
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">주소 검색을 통해 등록</h4>
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  주소 검색을 통해 제보할 지역을 찾습니다.
                </p>
              </div>
            </button>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => setSelectTypeModalOpen(false)}
            >
              취소
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 제보 수정 모달 ✏️ */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="w-[95%] max-w-[500px] p-5 rounded-2xl bg-card border border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold">✏️ 제보 수정하기</DialogTitle>
            <DialogDescription className="text-xs">
              선택한 제보 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            <ScamCategoryPicker
              items={editingScam?.reportType === "TIP" ? TIP_CATEGORY_ITEMS : CAUTION_CATEGORY_ITEMS}
              selectedCats={parseCategories(editScamCategory)}
              onChange={(next) => setEditScamCategory(next.join(","))}
              otherNote={editOtherCategoryNote}
              onOtherNoteChange={setEditOtherCategoryNote}
              disabled={isUploading || editMutation.isPending}
              reportType={editingScam?.reportType === "TIP" ? "TIP" : "CAUTION"}
            />

            <AudienceNationalityPicker
              key={editingScam?.id || "edit"}
              value={editAudienceNationalities}
              onChange={setEditAudienceNationalities}
              disabled={isUploading || editMutation.isPending}
            />

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                사진 첨부 (최대 5장)
              </label>
              <div className="flex flex-wrap gap-2 items-center pt-1">
                {editExistingImageUrls.length + editImageFiles.length < 5 && (
                  <label className="w-16 h-16 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 hover:border-slate-400 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 gap-1 text-[10px] text-muted-foreground">
                    <ImageIcon className="w-4 h-4 text-slate-500" />
                    사진 추가
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handleEditFileChange}
                      disabled={isUploading || editMutation.isPending}
                    />
                  </label>
                )}

                {/* Existing Images */}
                {editExistingImageUrls.map((url, index) => (
                  <div key={`existing-${index}`} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border group">
                    <img src={url} alt="existing preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeEditExistingImage(index)}
                      className="absolute top-1 right-1 w-4.5 h-4.5 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer opacity-100 transition-opacity duration-200"
                      disabled={isUploading || editMutation.isPending}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {/* New Previews */}
                {editImagePreviews.map((url, index) => (
                  <div key={`new-${index}`} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border group">
                    <img src={url} alt="new preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeEditNewImage(index)}
                      className="absolute top-1 right-1 w-4.5 h-4.5 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer opacity-100 transition-opacity duration-200"
                      disabled={isUploading || editMutation.isPending}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                제목
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="제목을 입력하세요"
                required
                className="text-xs h-9"
                disabled={isUploading || editMutation.isPending}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                상세 설명
              </label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="상세 정보를 입력하세요 (최소 10자)"
                required
                rows={4}
                className="text-xs resize-none"
                disabled={isUploading || editMutation.isPending}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                대처법 & 예방법 (선택)
              </label>
              <Textarea
                value={editAvoidanceTip}
                onChange={(e) => setEditAvoidanceTip(e.target.value)}
                placeholder="대처법 및 예방법을 입력하세요"
                rows={3}
                className="text-xs resize-none"
                disabled={isUploading || editMutation.isPending}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                출처 URL (선택)
              </label>
              <Input
                value={editSourceUrl}
                onChange={(e) => setEditSourceUrl(e.target.value)}
                placeholder="https://..."
                className="text-xs h-9"
                disabled={isUploading || editMutation.isPending}
              />
            </div>

            <DialogFooter className="pt-2 flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingScam(null);
                }}
                className="text-xs h-9 cursor-pointer"
                disabled={isUploading || editMutation.isPending}
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={isUploading || editMutation.isPending}
                className="text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                {isUploading || editMutation.isPending ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {isUploading ? "업로드 중..." : "저장 중..."}
                  </span>
                ) : (
                  "저장하기"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 이미지를 클릭했을 때 열리는 라운지 피드형 이미지 + 댓글 통합 상세 모달 🖼️ */}
      {activeMediaScam && (
        <MediaDetailModal
          isOpen={!!activeMediaScam}
          onOpenChange={(open) => {
            if (!open) setActiveMediaScam(null);
          }}
          images={activeMediaScam.imageUrls || EMPTY_ARRAY}
          initialImageIndex={activeMediaIndex}
          authorName={activeMediaScam.user?.name || activeMediaScam.guestName || "제보자"}
          authorAvatar={(activeMediaScam.user as any)?.image || activeMediaScam.user?.picture || ""}
          createdAt={activeMediaScam.createdAt}
          title={activeMediaScam.title}
          description={activeMediaScam.description}
          targetType="scam_info"
          targetId={activeMediaScam.id}
          avoidanceTip={activeMediaScam.avoidanceTip}
          reportType={activeMediaScam.reportType}
          badges={
            <>
              {activeMediaScam.reportType === "TIP" ? (
                <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400 text-[10px] font-bold py-0.5 px-2 shrink-0">
                  💡 사전 꿀팁
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400 text-[10px] font-bold py-0.5 px-2 shrink-0">
                  ⚠️ 주의 / 위험
                </Badge>
              )}
              {activeMediaScam.scope === "region" && (
                <Badge variant="outline" className="bg-violet-50 border-violet-200 dark:bg-violet-950/20 dark:border-violet-900/50 text-violet-700 dark:text-violet-400 text-[10px] font-bold py-0.5 px-2 select-none shrink-0">
                  🗺️ 구역 전체
                </Badge>
              )}
              {activeMediaScam.scope === "spot" && (
                <Badge variant="outline" className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/50 text-blue-700 dark:text-blue-400 text-[10px] font-bold py-0.5 px-2 select-none shrink-0">
                  📍 특정 위치
                </Badge>
              )}
              {(() => {
                const currentScamRegion = allRegions.find((r) => r.id === activeMediaScam.regionId);
                if (currentScamRegion) {
                  return (
                    <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-semibold py-0.5 px-2 max-w-full truncate">
                      📍 {currentScamRegion.cityName} · {currentScamRegion.name}
                    </Badge>
                  );
                }
                return null;
              })()}
              {activeMediaScam.subLocation && (
                <Badge variant="outline" className="bg-amber-50/80 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 text-[10px] font-bold py-0.5 px-2 shrink-0">
                  🏬 {activeMediaScam.subLocation}
                </Badge>
              )}
              <AudienceNationalityBadges value={activeMediaScam.audienceNationalities} />
            </>
          }
        />
      )}

    </div>
  );
}
