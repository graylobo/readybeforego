"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useScamMapStore } from "@/lib/stores/scam-map.store";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useTranslation } from "@/hooks/use-translation";
import { scamsApi, ScamInfo, Region, Country, City } from "@/lib/api/scams";
import { uploadsApi } from "@/lib/api/uploads";
import { getCountryName } from "@/lib/utils/country";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Comments } from "@/components/comments/comments";
import { ReportDialog } from "@/components/common/report-dialog";
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
  Loader2
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

// Category helper maps
const CATEGORY_MAP: Record<string, { label: string; color: string; icon: string }> = {
  FORCED_SHOPPING: { label: "🛍️ 호객/강매", color: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300", icon: "🛍️" },
  DRUG_HAZARD: { label: "💊 약물 위험", color: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300", icon: "💊" },
  LIES_TOURISM: { label: "🗣️ 가짜 관광정보", color: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300", icon: "🗣️" },
  FAKE_TAXI: { label: "🚕 가짜 택시/바가지", color: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300", icon: "🚕" },
  OVERCHARGING: { label: "💸 바가지 요금", color: "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300", icon: "💸" },
};

function getCategoryInfo(cat: string, t: any) {
  const info = CATEGORY_MAP[cat] || { label: cat, color: "bg-slate-100 text-slate-800", icon: "⚠️" };
  return {
    ...info,
    label: t(`categories.${cat}`, { defaultValue: info.label })
  };
}

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
    setReportType,
    setReportModalOpen,
    setReportCoords,
    setAddressSearchModalOpen,
  } = useScamMapStore();

  const [activeReportScamId, setActiveReportScamId] = useState<string | null>(null);
  const [activeCommentScamId, setActiveCommentScamId] = useState<string | null>(null);

  const [editingScam, setEditingScam] = useState<ScamInfo | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAvoidanceTip, setEditAvoidanceTip] = useState("");
  const [editSourceUrl, setEditSourceUrl] = useState("");
  const [editScamCategory, setEditScamCategory] = useState("");
  const [editImageFiles, setEditImageFiles] = useState<File[]>([]);
  const [editImagePreviews, setEditImagePreviews] = useState<string[]>([]);
  const [editExistingImageUrls, setEditExistingImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);



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
  });

  // 줌 수준 및 선택된 스코프(국가/도시/지역)에 따른 다형적 사기 목록 쿼리
  const { data: scams = [], isPending: isScamsPending } = useQuery<ScamInfo[]>({
    queryKey: ["scams", selectedCountryCode, selectedCityId, selectedRegionId],
    queryFn: () => {
      if (selectedRegionId) {
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
    enabled: !!selectedRegionId || !!selectedCityId || !!selectedCountryCode,
  });

  // Upvote/Downvote mutation
  const reactionMutation = useMutation({
    mutationFn: ({ scamId, type }: { scamId: string; type: "like" | "dislike" }) =>
      scamsApi.toggleReaction(scamId, type),
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

  // 제보 카드 클릭 시 해당 제보 위치로 지도 이동 및 최대 확대
  const handleCardClick = (scam: ScamInfo) => {
    const region = allRegions.find(r => r.id === scam.regionId);
    if (region) {
      setMapCenter([region.latitude, region.longitude]);
      setMapZoom(18);
      // 모바일 기기인 경우 카드를 눌렀을 때 지도가 잘 보이게 바텀 시트를 닫아줌
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setIsMobileFeedOpen(false);
      }
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
    if (isScamsPending) {
      return (
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
      );
    }

    if (scams.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
          <Info className="w-8 h-8 text-slate-300" />
          <p className="text-xs text-muted-foreground">{t("common.empty_warnings")}</p>
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
        {scams.map((scam) => {
          const cat = getCategoryInfo(scam.scamCategory, t);
          const isSuperAdmin = user?.role === "super_admin";
          const isOwner = user && scam.userId === user.id;
          const canManage = isSuperAdmin || isOwner;
          
          const isEdited = new Date(scam.updatedAt).getTime() - new Date(scam.createdAt).getTime() > 1000;

          return (
            <Card 
              key={scam.id} 
              className="border-border overflow-hidden hover:border-slate-300 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer"
              onClick={() => handleCardClick(scam)}
            >
              <CardHeader className="p-4 pb-2 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className={`${cat.color} border text-[10px] font-semibold py-0.5 px-2`}>
                      {cat.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground select-none">
                      {formatDate(scam.createdAt)}
                      {isEdited && ` (수정됨: ${formatDateTime(scam.updatedAt)})`}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {scam.sourceUrl && (
                      <a 
                        href={scam.sourceUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t("common.source_link")} <ExternalLink className="w-2.5 h-2.5" />
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
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  {scam.description}
                </p>

                {/* Attached image gallery layout */}
                {scam.imageUrls && Array.isArray(scam.imageUrls) && scam.imageUrls.length > 0 && (
                  <div className={`grid gap-1.5 rounded-lg overflow-hidden ${
                    scam.imageUrls.length === 1 
                      ? 'grid-cols-1' 
                      : scam.imageUrls.length === 2 
                        ? 'grid-cols-2' 
                        : 'grid-cols-3'
                  }`}>
                    {scam.imageUrls.map((url, idx) => (
                      <a 
                        key={idx} 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="block relative aspect-[4/3] overflow-hidden border border-slate-100 dark:border-slate-800 hover:opacity-90 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <img 
                          src={url} 
                          alt={`scam-attachment-${idx}`} 
                          className="w-full h-full object-cover" 
                        />
                      </a>
                    ))}
                  </div>
                )}

                {scam.avoidanceTip && (
                  <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-3 text-xs text-rose-800 space-y-1 dark:bg-rose-950/10 dark:border-rose-950/20 dark:text-rose-300">
                    <h4 className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> 
                      {t("common.avoidance_title")}
                    </h4>
                    <p className="leading-relaxed whitespace-pre-line">{scam.avoidanceTip}</p>
                  </div>
                )}

                {/* Card Footer Actions */}
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
                          className={`h-7 w-7 rounded-full hover:bg-slate-100 cursor-pointer active:scale-95 transition-transform group ${
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
                          className={`h-7 w-7 rounded-full hover:bg-slate-100 cursor-pointer active:scale-95 transition-transform group ${
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
          );
        })}
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
    <div className="flex flex-col md:flex-row h-full w-full overflow-hidden bg-background font-sans relative">
      
      {/* Left Map Canvas (Occupies full viewport on mobile) */}
      <div className="flex-1 h-[100vh] md:h-full relative z-0">
        <ReadyBeforeGoMap />

        {/* 플로팅 컨트롤 그룹 (검색 버튼 + 제보하기 버튼) */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {/* 플로팅 지역선택 검색 버튼 */}
          <Button
            size="icon"
            className="w-9 h-9 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg flex items-center justify-center cursor-pointer transition-all active:scale-95 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
            onClick={() => setIsFilterModalOpen(true)}
            title={t("report_modal.city_select")}
          >
            <Search className="w-4.5 h-4.5" />
          </Button>

          {/* 맵 직접 제보하기 플로팅 버튼 */}
          <Button
            size="sm"
            variant={isReportMode ? "destructive" : "default"}
            className={`font-bold text-xs h-9 px-3.5 rounded-full shadow-lg flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 border ${
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
          </Button>
        </div>
      </div>

      {/* Right Sidebar Panel (Hidden on mobile, only desktop, visible when a region is selected) */}
      {selectedRegionId && (
        <div className="hidden md:flex w-[450px] h-full flex-col border-l border-border bg-card/95 backdrop-blur-md z-10 shadow-lg shrink-0">
          
          {/* Active Scope Header */}
          <div className="px-6 py-4 bg-muted/40 border-b border-border flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-600" />
              <h2 className="font-bold text-sm text-card-foreground">
                {selectedRegion?.name} <span className="text-xs font-normal text-muted-foreground">{t("common.warning_info")}</span>
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-8 px-2.5 rounded-full flex items-center gap-1 shadow-sm cursor-pointer transition-all active:scale-95"
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
                  setReportModalOpen(true);
                }}
              >
                <span>➕</span>
                <span>{t("common.report_here", { defaultValue: "이 위치에 추가 제보하기" })}</span>
              </Button>

              {/* 닫기 (X) 버튼 */}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full cursor-pointer hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                onClick={resetSelections}
                title="닫기"
              >
                <span className="text-base font-bold">✕</span>
              </Button>
            </div>
          </div>

          {/* Feed Container */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200">
            {renderFeedContent()}
          </div>
        </div>
      )}

      {/* --- 모바일 전용 바텀 시트 (마커 클릭 시 아래서 올라오는 팝업 카드) --- */}
      <Dialog open={isMobileFeedOpen} onOpenChange={setIsMobileFeedOpen}>
        <DialogContent className="md:hidden sm:max-w-[480px] h-[75vh] bottom-0 top-auto translate-y-0 rounded-t-2xl rounded-b-none p-0 overflow-hidden flex flex-col gap-0 border-t border-border bg-card/98 backdrop-blur-lg">
          <DialogHeader className="px-6 py-4 bg-muted/40 border-b border-border flex flex-row items-center justify-between gap-2 shrink-0 space-y-0">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-600" />
              <DialogTitle className="font-bold text-sm text-card-foreground">
                {selectedRegionId 
                  ? selectedRegion?.name 
                  : selectedCityId 
                    ? (cities.find(c => c.id === selectedCityId)?.name || "도시")
                    : (getCountryName(selectedCountryCode, lang) || "국가")
                } 
              </DialogTitle>
            </div>

            {selectedRegionId && (
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-7 px-2.5 rounded-full flex items-center gap-1 shadow-sm shrink-0 cursor-pointer transition-all active:scale-95 mr-6"
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
                  setReportModalOpen(true);
                  setIsMobileFeedOpen(false);
                }}
              >
                <span>➕</span>
                <span>{t("common.report_here", { defaultValue: "이 위치에 추가 제보하기" })}</span>
              </Button>
            )}
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {renderFeedContent()}
          </div>
        </DialogContent>
      </Dialog>

      {/* --- 필터 다이얼로그 (상단 둥둥 검색바 터치 시 팝업) --- */}
      <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
        <DialogContent className="w-[90%] max-w-[360px] p-5 rounded-2xl bg-card border border-border">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-extrabold flex items-center gap-1.5">
              🧭 {t("common.welcome_title")}
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              필터를 변경해 타겟 지역의 사기 주의보를 확인하세요.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-2">
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  {t("report_modal.country")}
                </label>
                <Select value={selectedCountryCode || ""} onValueChange={handleCountryChange}>
                  <SelectTrigger className="w-full text-xs cursor-pointer">
                    <SelectValue placeholder={t("report_modal.country_select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.code} value={c.code} className="cursor-pointer">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  {t("report_modal.city")}
                </label>
                <Select 
                  value={selectedCityId || ""} 
                  onValueChange={handleCityChange}
                  disabled={!selectedCountryCode || isCitiesPending}
                >
                  <SelectTrigger className="w-full text-xs cursor-pointer">
                    <SelectValue placeholder={t("report_modal.city_select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem key={city.id} value={city.id} className="cursor-pointer">
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  {t("report_modal.place_name")}
                </label>
                <Select 
                  value={selectedRegionId || ""} 
                  onValueChange={handleRegionChange}
                  disabled={!selectedCityId || isRegionsPending}
                >
                  <SelectTrigger className="w-full text-xs cursor-pointer">
                    <SelectValue placeholder="선택" />
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
              🧭 피해 제보 위치 지정
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              제보 등록을 위한 위치 지정 방식을 선택해 주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3.5 pt-3">
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
                  지도의 특정 지점을 콕 찝어 새로운 피해 상권이나 랜드마크 이름을 작명하여 제보합니다.
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
                  건물명이나 도로명 주소 검색을 통해 제보할 장소를 간편하고 정확하게 찾습니다.
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
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                사기 유형 카테고리
              </label>
              <Select value={editScamCategory} onValueChange={setEditScamCategory}>
                <SelectTrigger className="text-xs h-9 cursor-pointer">
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OVERCHARGING" className="cursor-pointer">{t("categories.OVERCHARGING")}</SelectItem>
                  <SelectItem value="LIES_TOURISM" className="cursor-pointer">{t("categories.LIES_TOURISM")}</SelectItem>
                  <SelectItem value="FAKE_TAXI" className="cursor-pointer">{t("categories.FAKE_TAXI")}</SelectItem>
                  <SelectItem value="FORCED_SHOPPING" className="cursor-pointer">{t("categories.FORCED_SHOPPING")}</SelectItem>
                  <SelectItem value="DRUG_HAZARD" className="cursor-pointer">{t("categories.DRUG_HAZARD")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                증거 사진 첨부 (영수증, 간판, 현장 등 - 최대 5장)
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

    </div>
  );
}
