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
  CheckCircle2,
  CheckSquare,
  AlertTriangle,
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

const POPULAR_COUNTRIES = [
  { code: "JP", name: "일본", emoji: "🇯🇵", plug: "110V", visa: "무비자 90일", currency: "엔 (JPY)", currencyCode: "JPY" },
  { code: "TH", name: "태국", emoji: "🇹🇭", plug: "220V / 220V 겸용", visa: "무비자 90일", currency: "바트 (THB)", currencyCode: "THB" },
  { code: "VN", name: "베트남", emoji: "🇻🇳", plug: "220V", visa: "무비자 45일", currency: "동 (VND)", currencyCode: "VND" },
  { code: "PH", name: "필리핀", emoji: "🇵🇭", plug: "220V / 110V", visa: "무비자 30일", currency: "페소 (PHP)", currencyCode: "PHP" },
  { code: "US", name: "미국", emoji: "🇺🇸", plug: "110V", visa: "ESTA 전자비자", currency: "달러 (USD)", currencyCode: "USD" },
  { code: "KR", name: "대한민국", emoji: "🇰🇷", plug: "220V", visa: "내국인", currency: "원 (KRW)", currencyCode: "KRW" },
];

export default function GuidePage() {
  const { user } = useAuthStore();
  const [selectedCountry, setSelectedCountry] = useState<string>("JP");
  const [activeTab, setActiveTab] = useState<"all" | "pre_travel" | "essentials" | "baggage" | "tips">("all");
  
  // 체크리스트 로컬스토리지 저장 상태
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  
  const { data: availableCountries = [] } = useAvailableGuideCountries();
  const { data: guideData, isPending } = useCountryGuides(selectedCountry);

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

  const currentCountryInfo = POPULAR_COUNTRIES.find(c => c.code === selectedCountry) || {
    code: selectedCountry,
    name: selectedCountry,
    emoji: "✈️",
    plug: "220V / 변환 어댑터 확인",
    visa: "무비자 여부 확인 필요",
    currency: "현지 통화",
    currencyCode: selectedCountry === "JP" ? "JPY" : selectedCountry === "TH" ? "THB" : selectedCountry === "VN" ? "VND" : selectedCountry === "US" ? "USD" : "USD",
  };

  const guides = guideData?.guides || [];

  // 전체보기 상황: 1. 클릭이 안 되는 요소(isCheckable === false) 제외 2. 필수(isRequired) 항목 우선 배치 정렬
  const filteredGuides = useMemo(() => {
    const list = guides.filter(g => {
      const categoryMatch = activeTab === "all" || g.category === activeTab;
      if (activeTab === "all") {
        return categoryMatch && g.isCheckable !== false;
      }
      return categoryMatch;
    });

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

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-20">
      {/* 🌟 상단 앰비언트 헤더 뱅크 */}
      <div className="relative overflow-hidden bg-gradient-to-b from-blue-900 via-slate-900 to-slate-950 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/20 via-indigo-500/10 to-transparent pointer-events-none" />
        
        <div className="max-w-5xl mx-auto text-center space-y-4 relative z-10">
          <Badge variant="outline" className="bg-blue-500/10 border-blue-400/30 text-blue-300 px-3.5 py-1 text-xs rounded-full inline-flex items-center gap-1.5 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span>스마트 국가별 여행 준비 가이드 & 체크리스트</span>
          </Badge>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
            해외여행 필수 가이드북 🎒
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            여행 전 체크리스트로 꼼꼼하게 짐을 싸고 안전하게 떠나세요.
          </p>

          {/* 🌏 국가 선택 드롭다운 & 인기 칩 UI */}
          <div className="pt-4 max-w-xl mx-auto space-y-3">
            <div className="flex items-center justify-center gap-2">
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger className="w-[280px] bg-white/10 text-white border-white/20 backdrop-blur-md h-11 text-sm font-bold rounded-2xl cursor-pointer hover:bg-white/20 transition-all">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <SelectValue placeholder="여행할 국가를 선택하세요" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl max-h-[300px]">
                  {availableCountries.length > 0 ? (
                    availableCountries.map((c) => (
                      <SelectItem key={c.countryCode} value={c.countryCode} className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 font-semibold">
                        <span className="mr-2">{POPULAR_COUNTRIES.find(p => p.code === c.countryCode)?.emoji || "✈️"}</span>
                        {c.countryName} ({c.countryCode})
                      </SelectItem>
                    ))
                  ) : (
                    POPULAR_COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code} className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800 font-semibold">
                        <span className="mr-2">{c.emoji}</span>
                        {c.name} ({c.code})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20 space-y-6">
        
        {/* 📌 선택한 국가 요약 퀵 카드 */}
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl shadow-inner">
                  {currentCountryInfo.emoji}
                </span>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    {currentCountryInfo.name} 핵심 여행 정보
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    출국 전 필수로 체크해야 하는 국가별 기본 명세입니다.
                  </p>
                </div>
              </div>

              {/* 📊 분리된 진행률 프로그레스 바 (필수 vs 일반 준비물) */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
                {/* 🚨 필수 준비물 진행률 */}
                <div className="w-full sm:w-48 bg-rose-500/10 dark:bg-rose-950/30 p-2.5 rounded-2xl border border-rose-500/20 dark:border-rose-900/50">
                  <div className="flex items-center justify-between text-xs font-semibold text-rose-900 dark:text-rose-200 mb-1">
                    <span className="flex items-center gap-1 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      필수 준비물
                    </span>
                    <span className="text-rose-600 dark:text-rose-400 font-extrabold text-[11px]">
                      {requiredChecked}/{requiredGuides.length} ({requiredPercent}%)
                    </span>
                  </div>
                  <div className="w-full bg-rose-200/50 dark:bg-rose-950/80 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-rose-500 to-amber-500 h-full transition-all duration-500 rounded-full"
                      style={{ width: `${requiredPercent}%` }}
                    />
                  </div>
                </div>

                {/* 🎒 일반/선택 준비물 진행률 */}
                <div className="w-full sm:w-48 bg-blue-500/10 dark:bg-blue-950/30 p-2.5 rounded-2xl border border-blue-500/20 dark:border-blue-900/50">
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">
                    <span className="flex items-center gap-1 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                      선택 준비물
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 font-extrabold text-[11px]">
                      {optionalChecked}/{optionalGuides.length} ({optionalPercent}%)
                    </span>
                  </div>
                  <div className="w-full bg-blue-200/50 dark:bg-blue-950/80 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-500 rounded-full"
                      style={{ width: `${optionalPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3대 정보 태그 (플러그, 비자, 통화 + 실시간 환율 모달 버튼) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs items-center">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span className="font-bold text-slate-400">🔌 전압/플러그:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{currentCountryInfo.plug}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span className="font-bold text-slate-400">🛂 비자 조건:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{currentCountryInfo.visa}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-400">💰 통화 단위:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{currentCountryInfo.currency}</span>
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

        {/* 🎛️ 카테고리 필터 탭 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "all", label: "전체 보기", icon: Sparkles },
            { id: "pre_travel", label: "🛫 사전 준비", icon: Plane },
            { id: "essentials", label: "🎒 필수 준비물", icon: Luggage },
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
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md scale-[1.02]"
                    : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 📋 가이드 & 준비물 체크리스트 목록 */}
        <div className="space-y-3">
          {isPending ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4 border-slate-200/80 dark:border-slate-800">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filteredGuides.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">해당 카테고리의 가이드 항목이 아직 등록되지 않았습니다.</p>
            </Card>
          ) : (
            filteredGuides.map((item) => {
              const isChecked = !!checkedIds[item.id];
              return (
                <Card 
                  key={item.id} 
                  className={`transition-all duration-300 border overflow-hidden ${
                    isChecked 
                      ? "bg-slate-50/80 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800 opacity-75"
                      : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 shadow-sm"
                  }`}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start gap-3.5">
                      {/* 체크박스 버튼 */}
                      {item.isCheckable && (
                        <button
                          type="button"
                          onClick={() => toggleCheck(item.id)}
                          className="mt-0.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer shrink-0"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      )}

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.icon && <span className="text-base">{item.icon}</span>}
                          <h3 className={`text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 ${isChecked ? "line-through text-slate-500" : ""}`}>
                            {item.title}
                          </h3>
                          {item.isRequired && (
                            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 dark:bg-red-950/20 dark:border-red-900 text-[10px] font-bold px-1.5 py-0">
                              필수
                            </Badge>
                          )}
                        </div>
                        <p className={`text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed ${isChecked ? "text-slate-400 dark:text-slate-500" : ""}`}>
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
