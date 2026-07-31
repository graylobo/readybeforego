"use client";

import { Comments } from "@/components/comments/comments";
import { ExchangeRateModal } from "@/components/guide/exchange-rate-modal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAvailableGuideCountries,
  useCountryGuides,
} from "@/hooks/queries/use-guide-queries";
import { useAuthStore } from "@/lib/stores/auth.store";
import {
  CheckSquare,
  Globe,
  Info,
  Lightbulb,
  Luggage,
  Plane,
  ShieldCheck,
  Sparkles,
  Square
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { scamsApi, City } from "@/lib/api/scams";
import { useQuery } from "@tanstack/react-query";

export default function GuidePage() {
  const { user } = useAuthStore();
  const [selectedCountry, setSelectedCountry] = useState<string>("JP");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"all" | "pre_travel" | "essentials" | "baggage" | "tips">("all");
  
  // 체크리스트 로컬스토리지 저장 상태
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  
  const { data: availableCountries = [] } = useAvailableGuideCountries();

  // 특정 국가의 도시 목록 조회
  const { data: availableCities = [] } = useQuery<City[]>({
    queryKey: ['cities', selectedCountry],
    queryFn: () => scamsApi.getCities(selectedCountry),
    enabled: !!selectedCountry,
  });

  const { data: guideData, isPending } = useCountryGuides(selectedCountry, selectedCity !== 'all' ? selectedCity : undefined);

  // 국가 변경 시 도시 선택 초기화
  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode);
    setSelectedCity('all');
  };

  // LocalStorage 체크리스트 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`guide_checklist_${selectedCountry}`);
      if (saved) {
        setCheckedIds(JSON.parse(saved));
      } else {
        setCheckedIds({});
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedCountry]);

  // 체크 토글 함수
  const toggleCheck = (id: string) => {
    const updated = { ...checkedIds, [id]: !checkedIds[id] };
    setCheckedIds(updated);
    try {
      localStorage.setItem(`guide_checklist_${selectedCountry}`, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const currentCountryInfo = useMemo(() => {
    const dbMeta = availableCountries.find(c => c.countryCode === selectedCountry);

    return {
      code: selectedCountry,
      name: dbMeta?.countryName || selectedCountry,
      emoji: dbMeta?.emoji || "✈️",
      plug: dbMeta?.plug || "220V / 변환 어댑터 확인",
      visa: dbMeta?.visa || "무비자 여부 확인",
      currency: dbMeta?.currency || `${selectedCountry} 통화`,
      currencyCode: dbMeta?.currencyCode || selectedCountry,
    };
  }, [selectedCountry, availableCountries]);

  const guides = guideData?.guides || [];

  // 전체보기 상황: 1. 클릭이 안 되는 요소(isCheckable === false) 제외 2. 필수(isRequired) 항목 우선 배치 정렬
  const filteredGuides = useMemo(() => {
    if (!guides) return [];

    let list = guides;
    
    // 탭 필터링 및 "all"인 경우 isCheckable 제외 로직
    if (activeTab === "all") {
      list = list.filter(g => g.isCheckable !== false);
    } else if (activeTab === "pre_travel" || activeTab === "essentials") {
      list = list.filter(g => g.category === "pre_travel" || g.category === "essentials");
    } else {
      list = list.filter(g => g.category === activeTab);
    }

    if (activeTab === "all") {
      return [...list].sort((a, b) => {
        if (a.isRequired && !b.isRequired) return -1;
        if (!a.isRequired && b.isRequired) return 1;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      });
    }

    return list;
  }, [guides, activeTab]);

  // 카테고리별 개수 계산 (필수 vs 일반/선택 분리)
  const checkableGuides = useMemo(() => guides.filter(g => g.isCheckable), [guides]);

  const requiredGuides = useMemo(() => checkableGuides.filter(g => g.isRequired), [checkableGuides]);
  const optionalGuides = useMemo(() => checkableGuides.filter(g => !g.isRequired), [checkableGuides]);

  const requiredChecked = useMemo(() => requiredGuides.filter(g => checkedIds[g.id]).length, [requiredGuides, checkedIds]);
  const optionalChecked = useMemo(() => optionalGuides.filter(g => checkedIds[g.id]).length, [optionalGuides, checkedIds]);

  const requiredPercent = requiredGuides.length > 0 ? Math.round((requiredChecked / requiredGuides.length) * 100) : 100;
  const optionalPercent = optionalGuides.length > 0 ? Math.round((optionalChecked / optionalGuides.length) * 100) : 100;

  // 🔄 전체 선택 / 전체 해제 관련 로직
  const currentFilteredCheckableGuides = useMemo(() => filteredGuides.filter(g => g.isCheckable !== false), [filteredGuides]);
  const isAllChecked = useMemo(() => currentFilteredCheckableGuides.length > 0 && currentFilteredCheckableGuides.every(g => !!checkedIds[g.id]), [currentFilteredCheckableGuides, checkedIds]);

  const toggleAll = () => {
    setCheckedIds(prev => {
      const next = { ...prev };
      const targetState = !isAllChecked;
      currentFilteredCheckableGuides.forEach(g => {
        next[g.id] = targetState;
      });
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-20">
      {/* 🌟 상단 앰비언트 헤더 뱅크 */}
      <div className="relative overflow-hidden bg-gradient-to-b from-blue-900 via-slate-900 to-slate-950 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/20 via-indigo-500/10 to-transparent pointer-events-none" />
        
        <div className="max-w-5xl mx-auto text-center space-y-4 relative z-10">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
            여행 가이드북 🎒
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            여행 전 체크리스트를 꼼꼼하게 확인하고 떠나세요.
          </p>

          {/* 🌏 국가 및 도시 선택 드롭다운 UI */}
          <div className="pt-4 max-w-xl mx-auto space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <Select value={selectedCountry} onValueChange={handleCountryChange}>
                <SelectTrigger className="w-[200px] sm:w-[240px] bg-white/10 text-white border-white/20 backdrop-blur-md h-11 text-sm font-bold rounded-2xl cursor-pointer hover:bg-white/20 transition-all">
                  <div className="flex items-center gap-2 truncate">
                    <Globe className="w-4 h-4 text-blue-400 shrink-0" />
                    <SelectValue placeholder="여행 국가 선택" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl max-h-[300px]">
                  {availableCountries.map((c) => (
                    <SelectItem key={c.countryCode} value={c.countryCode} className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 font-semibold">
                      <span className="mr-2">{c.emoji || "✈️"}</span>
                      {c.countryName} ({c.countryCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {availableCities.length > 0 && (
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger className="w-[160px] sm:w-[190px] bg-white/10 text-white border-white/20 backdrop-blur-md h-11 text-sm font-bold rounded-2xl cursor-pointer hover:bg-white/20 transition-all">
                    <div className="flex items-center gap-2 truncate">
                      🌆 
                      <SelectValue placeholder="전체 도시 (선택)" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl max-h-[300px]">
                    <SelectItem value="all" className="cursor-pointer hover:bg-slate-800 font-semibold">
                      도시 전체(옵션)
                    </SelectItem>
                    {availableCities.map((city) => {
                      const displayName = city.name === city.nameEn || !city.nameEn 
                        ? city.name 
                        : `${city.name} (${city.nameEn})`;
                      return (
                        <SelectItem key={city.id} value={city.id} className="cursor-pointer hover:bg-slate-800 font-semibold">
                          📍 {displayName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20 space-y-6">
        
        {/* 📌 국가별 핵심 여행 정보 카드 (!py-0 패딩 오버라이드 적용) */}
        <Card className="!py-0 border-slate-200/80 dark:border-slate-800 shadow-md bg-white dark:bg-slate-900">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl sm:text-4xl p-2 bg-slate-100 dark:bg-slate-800 rounded-2xl shadow-xs shrink-0">
                {currentCountryInfo.emoji}
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  {currentCountryInfo.name} 핵심 여행 정보
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  출국 전 필수로 체크해야 하는 국가별 기본 명세입니다.
                </p>
              </div>
            </div>

            {/* 3대 정보 태그 (플러그, 비자, 통화 + 실시간 환율 모달 버튼) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs items-center">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 shrink-0">
                <span className="font-bold text-slate-400 whitespace-nowrap shrink-0">🔌 전압/플러그:</span>
                <span className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">{currentCountryInfo.plug}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 shrink-0">
                <span className="font-bold text-slate-400 whitespace-nowrap shrink-0">🛂 비자 조건:</span>
                <span className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">{currentCountryInfo.visa}</span>
              </div>
              <div className="flex items-center justify-between sm:justify-start md:justify-between gap-3 text-slate-600 dark:text-slate-300 shrink-0">
                <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                  <span className="font-bold text-slate-400 whitespace-nowrap shrink-0">💰 통화 단위:</span>
                  <span className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">{currentCountryInfo.currency}</span>
                </div>
                <ExchangeRateModal
                  countryName={currentCountryInfo.name}
                  currencyCode={currentCountryInfo.currencyCode}
                  flagEmoji={currentCountryInfo.emoji}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 🎛️ 스티키 1줄 슬림 바 (main 스크롤 컨테이너 최상단 100% 밀착 top-0) */}
        <div className="sticky top-0 z-30 py-2.5 px-3 -mx-3 bg-slate-50 dark:bg-slate-950 backdrop-blur-md flex items-center justify-between gap-3 border-y border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          {/* 카테고리 필터 탭 & 전체 선택 버튼 */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {/* ☑️ 전체 선택 / 해제 토글 버튼 */}
            {currentFilteredCheckableGuides.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 cursor-pointer bg-blue-50 text-blue-600 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 shrink-0 mr-1"
              >
                {isAllChecked ? (
                  <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                <span>{isAllChecked ? "전체 해제" : "전체 선택"}</span>
              </button>
            )}

            {[
              { id: "all", label: "전체 보기", icon: Sparkles },
              { id: "pre_travel", label: "🎒 사전 준비 & 준비물", icon: Luggage },
              { id: "baggage", label: "✈️ 수하물 규정", icon: ShieldCheck },
              { id: "tips", label: "💡 현지 팁", icon: Lightbulb },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm scale-[1.02]"
                      : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* 스티키 시 상단에 표시되는 미니 콤팩트 프로그레스 뱃지 (모바일/PC 공통 노출) */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl bg-rose-500/10 dark:bg-rose-950/50 border border-rose-500/20 text-[10px] sm:text-[11px] font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
              <span className="hidden sm:inline">🚨 필수</span>
              <span className="sm:hidden">🚨</span>
              <span>{requiredChecked}/{requiredGuides.length}</span>
              <span className="text-rose-500 font-extrabold">({requiredPercent}%)</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl bg-blue-500/10 dark:bg-blue-950/50 border border-blue-500/20 text-[10px] sm:text-[11px] font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
              <span className="hidden sm:inline">🎒 선택</span>
              <span className="sm:hidden">🎒</span>
              <span>{optionalChecked}/{optionalGuides.length}</span>
              <span className="text-blue-500 font-extrabold">({optionalPercent}%)</span>
            </div>
          </div>
        </div>

        {/* 📋 가이드 & 준비물 체크리스트 목록 (초슬림 컴팩트 뷰) */}
        <div className="space-y-1.5">
          {isPending ? (
            <div className="space-y-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i} className="p-2 border-slate-200/80 dark:border-slate-800">
                  <div className="space-y-1">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filteredGuides.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <Info className="w-7 h-7 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">해당 카테고리의 가이드 항목이 아직 등록되지 않았습니다.</p>
            </Card>
          ) : (
            filteredGuides.map((item) => {
              const isChecked = !!checkedIds[item.id];
              const isClickable = item.isCheckable !== false;

              return (
                <Card 
                  key={item.id} 
                  onClick={() => isClickable && toggleCheck(item.id)}
                  className={`!py-2.5 transition-all duration-200 border overflow-hidden select-none ${
                    isClickable ? "cursor-pointer" : "cursor-default"
                  } ${
                    isChecked 
                      ? "bg-slate-100/70 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/80 opacity-70"
                      : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-2xs"
                  }`}
                >
                  <CardContent className="px-3 sm:px-3.5">
                    <div className="flex items-center gap-2.5">
                      {/* 체크박스 아이콘 */}
                      {item.isCheckable && (
                        <div className="shrink-0 text-slate-400 dark:text-slate-500">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                          )}
                        </div>
                      )}

                      {/* 텍스트 정보 (슬림 정렬) */}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.icon && <span className="text-sm leading-none">{item.icon}</span>}
                          {item.city && (
                            <Badge variant="outline" className="border-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 text-[10px] font-semibold">
                              📍 {item.city.name}
                            </Badge>
                          )}
                          <h3 className={`text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight ${isChecked ? "line-through text-slate-500 dark:text-slate-500" : ""}`}>
                            {item.title}
                          </h3>
                          {item.isRequired && (
                            <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/60 text-[10px] font-bold px-1.5 py-0 leading-none h-4">
                              필수
                            </Badge>
                          )}
                        </div>
                        <p className={`text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 leading-normal line-clamp-2 ${isChecked ? "text-slate-400 dark:text-slate-500" : ""}`}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* 💬 유저 추천 알짜 꿀팁 커뮤니티 (공통 Comments 모듈 전면 재사용) */}
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-lg bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <span>여행자 유저들의 실전 알짜 꿀팁 💡</span>
            </CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              실제 {currentCountryInfo.name} 여행을 다녀온 유저들이 공유하는 생생한 조언입니다. 자유롭게 질문하고 반응을 남겨보세요!
            </p>
          </CardHeader>

          <CardContent className="p-5">
            <Comments
              targetType="country_guide"
              targetId={selectedCountry}
              allowAnonymous={true}
              deleteMode="hard"
            />
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
