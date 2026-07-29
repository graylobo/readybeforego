"use client";

import { useState, useEffect } from "react";
import { Coins, ArrowLeftRight, TrendingUp, TrendingDown, RefreshCw, Landmark, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useExchangeRate } from "@/hooks/queries/use-exchange-rate";
import { CURRENCY_CONFIG } from "@/lib/api/exchange-rate";

interface ExchangeRateCardProps {
  countryName: string;
  currencyCode: string;
  flagEmoji: string;
}

export function ExchangeRateCard({ countryName, currencyCode, flagEmoji }: ExchangeRateCardProps) {
  const { data: rateInfo, isLoading, isError, refetch, isRefetching } = useExchangeRate(currencyCode);
  const config = CURRENCY_CONFIG[currencyCode] || { unit: 1, symbol: currencyCode, name: currencyCode };

  const [calcMode, setCalcMode] = useState<'base' | 'buying'>('base'); // 매매기준율 vs 현찰살때
  const [foreignAmount, setForeignAmount] = useState<string>("");
  const [krwAmount, setKrwAmount] = useState<string>("");

  const activeRate = rateInfo
    ? calcMode === 'buying' ? rateInfo.cashBuyingPrice : rateInfo.basePrice
    : 0;

  // 기본 단위 금액(예: 100엔) 세팅
  useEffect(() => {
    if (rateInfo && activeRate > 0) {
      setForeignAmount(String(rateInfo.unit));
      const calcKrw = (rateInfo.unit / rateInfo.unit) * activeRate;
      setKrwAmount(String(Math.round(calcKrw * 100) / 100));
    }
  }, [rateInfo, activeRate, currencyCode]);

  // 외화 금액 변경 시 KRW 계산
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

  // KRW 금액 변경 시 외화 계산
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

  if (currencyCode === "KRW") return null;

  const isRise = rateInfo?.change === 'RISE';
  const isFall = rateInfo?.change === 'FALL';

  return (
    <Card className="border-blue-200/80 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/60 via-indigo-50/20 to-white dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900 shadow-lg rounded-2xl overflow-hidden">
 
      <CardContent className="p-4 sm:p-5 space-y-4">
        {isLoading ? (
          <div className="h-24 bg-slate-200/60 dark:bg-slate-800 animate-pulse rounded-xl" />
        ) : isError || !rateInfo ? (
          <div className="text-xs text-slate-400 text-center py-4">
            실시간 하나은행 환율 정보를 가져오는 데 실패했습니다.
          </div>
        ) : (
          <>
            {/* 네이버 환율과 100% 동일한 메인 환율 표시 카드 */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{flagEmoji}</span>
                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                      {countryName} {rateInfo.currency} {rateInfo.unit}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                      매매기준율
                    </span>
                  </div>

                  {/* 큰 환율 숫자 (네이버 883.86 스타일) */}
                  <div className="flex items-baseline gap-2 pt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                      {rateInfo.basePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-sm font-bold text-slate-500">원</span>

                    {/* 변동율 뱃지 */}
                    <div className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-md ${
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
                </div>

                <div className="text-right text-[11px] text-slate-400 self-end sm:self-center">
                  <div>하나은행 고시기준</div>
                  <div className="font-medium">{rateInfo.updatedAt} 기준</div>
                </div>
              </div>

              {/* 세부 시세 정보 (현찰 살 때 / 현찰 팔 때 / 송금 보낼 때 / 송금 받을 때) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                  <div className="text-[11px] text-slate-400 mb-0.5">현찰 살 때</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {rateInfo.cashBuyingPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} 원
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                  <div className="text-[11px] text-slate-400 mb-0.5">현찰 팔 때</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {rateInfo.cashSellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} 원
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                  <div className="text-[11px] text-slate-400 mb-0.5">송금 보낼 때</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {rateInfo.ttSellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} 원
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                  <div className="text-[11px] text-slate-400 mb-0.5">송금 받을 때</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {rateInfo.ttBuyingPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} 원
                  </div>
                </div>
              </div>
            </div>

            {/* 간이 환율 계산기 필드 */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  🧮 실시간 환산 계산기
                </span>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCalcMode('base')}
                    className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-colors ${
                      calcMode === 'base'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
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
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    현찰 살 때 (환전 시)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-11 gap-2.5 items-center">
                {/* 외화 입력 */}
                <div className="sm:col-span-5 relative">
                  <div className="relative">
                    <Input
                      type="number"
                      value={foreignAmount}
                      onChange={(e) => handleForeignChange(e.target.value)}
                      placeholder="0"
                      className="pr-12 text-sm font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      {config.symbol}
                    </span>
                  </div>
                </div>

                {/* 화살표 아이콘 */}
                <div className="sm:col-span-1 flex justify-center py-1 sm:py-0">
                  <div className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                    <ArrowLeftRight className="w-4 h-4 rotate-90 sm:rotate-0" />
                  </div>
                </div>

                {/* 원화 입력 */}
                <div className="sm:col-span-5 relative">
                  <div className="relative">
                    <Input
                      type="number"
                      value={krwAmount}
                      onChange={(e) => handleKrwChange(e.target.value)}
                      placeholder="0"
                      className="pr-10 text-sm font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      ₩
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
