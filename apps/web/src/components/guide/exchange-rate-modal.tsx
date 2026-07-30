"use client";

import { useState, useEffect } from "react";
import { Coins, ArrowLeftRight, TrendingUp, TrendingDown, RefreshCw, Landmark, Calculator } from "lucide-react";
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useExchangeRate } from "@/hooks/queries/use-exchange-rate";
import { CURRENCY_CONFIG } from "@/lib/api/exchange-rate";

interface ExchangeRateModalProps {
  countryName: string;
  currencyCode: string;
  flagEmoji: string;
  trigger?: React.ReactNode;
}

export function ExchangeRateModal({ countryName, currencyCode, flagEmoji, trigger }: ExchangeRateModalProps) {
  const [open, setOpen] = useState(false);
  const { data: rateInfo, isLoading, isError, refetch, isRefetching } = useExchangeRate(currencyCode);
  const config = CURRENCY_CONFIG[currencyCode] || { unit: 1, symbol: currencyCode, name: currencyCode };

  const [calcMode, setCalcMode] = useState<'base' | 'buying'>('base'); // 매매기준율 vs 현찰살때
  const [isSwapped, setIsSwapped] = useState(false); // 좌우 방향 스위칭
  const [foreignAmount, setForeignAmount] = useState<string>("");
  const [krwAmount, setKrwAmount] = useState<string>("");

  const activeRate = rateInfo
    ? calcMode === 'buying' ? rateInfo.cashBuyingPrice : rateInfo.basePrice
    : 0;

  // 모달이 열리거나 rateInfo 갱신 시 초기 금액 세팅
  useEffect(() => {
    if (rateInfo && activeRate > 0) {
      setForeignAmount(String(rateInfo.unit));
      const calculated = (rateInfo.unit / rateInfo.unit) * activeRate;
      setKrwAmount(String(Math.round(calculated * 100) / 100));
    }
  }, [rateInfo, activeRate, open, currencyCode]);

  const handleForeignChange = (val: string) => {
    setForeignAmount(val);
    const num = parseFloat(val);
    if (isNaN(num) || !rateInfo || activeRate === 0) {
      setKrwAmount("");
      return;
    }
    const calculated = (num / rateInfo.unit) * activeRate;
    setKrwAmount(String(Math.round(calculated * 100) / 100));
  };

  const handleKrwChange = (val: string) => {
    setKrwAmount(val);
    const num = parseFloat(val);
    if (isNaN(num) || !rateInfo || activeRate === 0) {
      setForeignAmount("");
      return;
    }
    const calculated = (num / activeRate) * rateInfo.unit;
    setForeignAmount(String(Math.round(calculated * 100) / 100));
  };

  const handleSwap = () => {
    setIsSwapped((prev) => !prev);
  };

  if (currencyCode === "KRW") return null;

  const isRise = rateInfo?.change === 'RISE';
  const isFall = rateInfo?.change === 'FALL';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-3 text-xs font-bold gap-1.5 rounded-xl border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50/50 hover:bg-blue-100/70 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 shadow-2xs cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>실시간 환율 & 계산기</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-lg p-5 sm:p-6 rounded-2xl border-slate-200/80 dark:border-slate-800">
        <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between pr-6">
          <div className="space-y-1">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <span className="text-2xl">{flagEmoji}</span>
              <span>{countryName} 하나은행 실시간 환율</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              하나은행 고시 매매기준율 및 실시간 환율 계산기입니다.
            </DialogDescription>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching || isLoading}
            className="h-7 px-2 text-xs text-slate-500 hover:text-blue-600 gap-1 rounded-md cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3 h-3 ${isRefetching ? "animate-spin text-blue-600" : ""}`} />
            <span>새로고침</span>
          </Button>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {isLoading ? (
            <div className="h-28 bg-slate-200/60 dark:bg-slate-800 animate-pulse rounded-xl" />
          ) : isError || !rateInfo ? (
            <div className="text-xs text-slate-400 text-center py-6">
              환율 정보를 가져오는 데 실패했습니다.
            </div>
          ) : (
            <>
              {/* 환율 메인 카드 */}
              <div className="bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-white dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900 p-4 rounded-xl border border-blue-100 dark:border-blue-900/40 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                      {countryName} {rateInfo.currency} {rateInfo.unit}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold">
                      매매기준율
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {rateInfo.updatedAt} 기준
                  </span>
                </div>

                {/* 메인 숫자 */}
                <div className="flex items-baseline gap-2 pt-0.5">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                    {rateInfo.basePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-sm font-bold text-slate-500">원</span>

                  {/* 변동 뱃지 */}
                  <div className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-md ml-1 ${
                    isFall 
                      ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50" 
                      : isRise 
                      ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50" 
                      : "text-slate-500 bg-slate-100"
                  }`}>
                    {isFall && <TrendingDown className="w-3.5 h-3.5" />}
                    {isRise && <TrendingUp className="w-3.5 h-3.5" />}
                    <span>
                      {isFall ? "-" : isRise ? "+" : ""}
                      {rateInfo.changePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} 
                      ({rateInfo.changeRate}%)
                    </span>
                  </div>
                </div>

                {/* 세부 시세 정보 테이블 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-xs">
                  <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-800/60">
                    <div className="text-[11px] text-slate-400 mb-0.5">현찰 살 때</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      {rateInfo.cashBuyingPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} 원
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-800/60">
                    <div className="text-[11px] text-slate-400 mb-0.5">현찰 팔 때</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      {rateInfo.cashSellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} 원
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-800/60">
                    <div className="text-[11px] text-slate-400 mb-0.5">송금 보낼 때</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      {rateInfo.ttSellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} 원
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-800/60">
                    <div className="text-[11px] text-slate-400 mb-0.5">송금 받을 때</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      {rateInfo.ttBuyingPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} 원
                    </div>
                  </div>
                </div>
              </div>

              {/* 실시간 계산기 섹션 */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-blue-500" />
                    <span>실시간 환산 계산기</span>
                  </span>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCalcMode('base')}
                      className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-colors ${
                        calcMode === 'base'
                          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      매매기준율
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalcMode('buying')}
                      className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-colors ${
                        calcMode === 'buying'
                          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      현찰 살 때 (환전 시)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-11 gap-2.5 items-center">
                  {/* 왼쪽 입력 창 (isSwapped 조건에 따라 KRW 또는 외화) */}
                  <div className="sm:col-span-5 relative">
                    <Input
                      type="number"
                      value={isSwapped ? krwAmount : foreignAmount}
                      onChange={(e) => isSwapped ? handleKrwChange(e.target.value) : handleForeignChange(e.target.value)}
                      placeholder="0"
                      className={`pr-12 text-sm font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-blue-500 ${
                        isSwapped ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-white"
                      }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      {isSwapped ? "₩" : config.symbol}
                    </span>
                  </div>

                  {/* 중앙 스위칭 토글 버튼 */}
                  <div className="sm:col-span-1 flex justify-center py-1 sm:py-0">
                    <button
                      type="button"
                      onClick={handleSwap}
                      title="통화 입력 스위칭"
                      className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer shadow-xs active:scale-90"
                    >
                      <ArrowLeftRight className={`w-4 h-4 transition-transform duration-300 ${isSwapped ? 'rotate-180' : 'rotate-0'}`} />
                    </button>
                  </div>

                  {/* 오른쪽 입력 창 (isSwapped 조건에 따라 외화 또는 KRW) */}
                  <div className="sm:col-span-5 relative">
                    <Input
                      type="number"
                      value={isSwapped ? foreignAmount : krwAmount}
                      onChange={(e) => isSwapped ? handleForeignChange(e.target.value) : handleKrwChange(e.target.value)}
                      placeholder="0"
                      className={`pr-12 text-sm font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-blue-500 ${
                        isSwapped ? "text-slate-900 dark:text-white" : "text-blue-600 dark:text-blue-400"
                      }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      {isSwapped ? config.symbol : "₩"}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
