export interface DunamuForexData {
  code: string; // FRX.KRWJPY
  currencyCode: string; // JPY
  currencyName: string; // 엔
  basePrice: number; // 매매기준율
  change: 'RISE' | 'FALL' | 'EVEN';
  changePrice: number;
  changeRate: number;
  cashBuyingPrice: number; // 현찰 살 때
  cashSellingPrice: number; // 현찰 팔 때
  ttSellingPrice: number; // 송금 보낼 때
  ttBuyingPrice: number; // 송금 받을 때
  date: string;
  time: string;
}

export interface ExchangeRateInfo {
  currency: string;
  unit: number; // 100엔, 1000동, 1달러 등
  unitSymbol: string;
  basePrice: number; // 매매기준율
  change: 'RISE' | 'FALL' | 'EVEN';
  changePrice: number;
  changeRate: number;
  cashBuyingPrice: number;
  cashSellingPrice: number;
  ttSellingPrice: number;
  ttBuyingPrice: number;
  updatedAt: string;
}

export const CURRENCY_CONFIG: Record<string, { unit: number; symbol: string; name: string }> = {
  JPY: { unit: 100, symbol: '￥', name: '일본 엔' },
  VND: { unit: 100, symbol: '₫', name: '베트남 동' },
  THB: { unit: 1, symbol: '฿', name: '태국 바트' },
  USD: { unit: 1, symbol: '$', name: '미국 달러' },
  EUR: { unit: 1, symbol: '€', name: '유로' },
  TWD: { unit: 1, symbol: 'NT$', name: '대만 달러' },
  PHP: { unit: 1, symbol: '₱', name: '필리핀 페소' },
  HKD: { unit: 1, symbol: 'HK$', name: '홍콩 달러' },
  SGD: { unit: 1, symbol: 'S$', name: '싱가포르 달러' },
  CNY: { unit: 1, symbol: '¥', name: '중국 위안' },
};

// UTC 날짜/시각을 KST(한국 표준시 +9시간)로 보정 포맷팅
function formatToKST(dateStr?: string, timeStr?: string): string {
  if (!dateStr || !timeStr) {
    return new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  }

  try {
    const utcDate = new Date(`${dateStr}T${timeStr}Z`);
    if (isNaN(utcDate.getTime())) {
      return `${dateStr} ${timeStr}`;
    }

    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(utcDate);
  } catch {
    return `${dateStr} ${timeStr}`;
  }
}

export async function getExchangeRate(currencyCode: string): Promise<ExchangeRateInfo | null> {
  const code = currencyCode.toUpperCase();
  if (code === 'KRW') return null;

  const config = CURRENCY_CONFIG[code];
  if (!config) return null;

  try {
    // CORS 차단을 방지하기 위해 서버 측 Route Handler 로 프록시 호출
    const res = await fetch(`/api/exchange-rate?currency=${code}`, {
      cache: 'no-store'
    });

    if (!res.ok) throw new Error('Failed to fetch exchange rate data');
    const data: DunamuForexData[] = await res.json();

    if (!data || !Array.isArray(data) || data.length === 0) return null;
    const item = data[0];

    return {
      currency: code,
      unit: config.unit,
      unitSymbol: config.symbol,
      basePrice: item.basePrice,
      change: item.change,
      changePrice: item.changePrice,
      changeRate: Math.round(item.changeRate * 10000) / 100, // 백분율 %
      cashBuyingPrice: item.cashBuyingPrice,
      cashSellingPrice: item.cashSellingPrice,
      ttSellingPrice: item.ttSellingPrice,
      ttBuyingPrice: item.ttBuyingPrice,
      updatedAt: formatToKST(item.date, item.time),
    };
  } catch (error) {
    console.error('Exchange rate fetch error:', error);
    return null;
  }
}
