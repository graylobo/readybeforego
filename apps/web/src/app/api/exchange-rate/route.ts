import { NextRequest, NextResponse } from 'next/server';

const REUTERS_CODES: Record<string, string> = {
  JPY: 'FX_JPYKRW',
  USD: 'FX_USDKRW',
  EUR: 'FX_EURKRW',
  THB: 'FX_THBKRW',
  VND: 'FX_VNDKRW',
  TWD: 'FX_TWDKRW',
  PHP: 'FX_PHPKRW',
  HKD: 'FX_HKDKRW',
  SGD: 'FX_SGDKRW',
  CNY: 'FX_CNYKRW',
};

// 하나은행 표준 스프레드율 (현찰 살때/팔때 1.75%, 송금 보낼때/받을때 0.98%)
const SPREAD_RATES = {
  cashBuying: 1.0175,
  cashSelling: 0.9825,
  ttSelling: 1.0098,
  ttBuying: 0.9902,
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const currency = (searchParams.get('currency') || '').toUpperCase();

  const reutersCode = REUTERS_CODES[currency];
  if (!reutersCode) {
    return NextResponse.json({ error: 'Unsupported currency' }, { status: 400 });
  }

  // 1차 시도: 네이버 증권 공식 하나은행 실시간 고시 API (api.stock.naver.com)
  try {
    const res = await fetch(
      `https://api.stock.naver.com/marketindex/exchange/${reutersCode}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
        },
        next: { revalidate: 30 }, // 30초간 캐싱
      }
    );

    if (res.ok) {
      const data = await res.json();
      const info = data?.exchangeInfo;
      if (info && info.closePrice) {
        const basePrice = parseFloat(info.closePrice) || 0;
        const changePrice = parseFloat(info.fluctuations) || 0;
        const changeRate = parseFloat(info.fluctuationsRatio) || 0;
        const flType = info.fluctuationsType?.name || 'UNCHANGED';

        const change = flType === 'RISING' ? 'RISE' : flType === 'FALLING' ? 'FALL' : 'EVEN';
        const dateStr = info.localTradedAt ? info.localTradedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
        const timeStr = info.localTradedAt ? info.localTradedAt.slice(11, 19) : new Date().toISOString().slice(11, 19);

        return NextResponse.json([{
          code: reutersCode,
          currencyCode: currency,
          currencyName: info.fullName || currency,
          basePrice: basePrice,
          change: change,
          changePrice: changePrice,
          changeRate: changeRate,
          cashBuyingPrice: Math.round(basePrice * SPREAD_RATES.cashBuying * 100) / 100,
          cashSellingPrice: Math.round(basePrice * SPREAD_RATES.cashSelling * 100) / 100,
          ttSellingPrice: Math.round(basePrice * SPREAD_RATES.ttSelling * 100) / 100,
          ttBuyingPrice: Math.round(basePrice * SPREAD_RATES.ttBuying * 100) / 100,
          date: dateStr,
          time: timeStr,
        }]);
      }
    }
  } catch {
    // 1차 API 장애 시 2차로 이동
  }

  // 2차 시도: 하나은행 실시간 환율 (manana API)
  try {
    const res = await fetch(`https://api.manana.kr/exchange/rate.json?base=KRW&code=${currency}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const rawRate = Number(item.rate) || 0;
        if (rawRate > 0) {
          const unitMultiplier = currency === 'JPY' ? 100 : currency === 'VND' ? 1000 : 1;
          const basePrice = Math.round(rawRate * unitMultiplier * 100) / 100;

          return NextResponse.json([{
            code: reutersCode,
            currencyCode: currency,
            currencyName: currency,
            basePrice: basePrice,
            change: 'EVEN',
            changePrice: 0,
            changeRate: 0,
            cashBuyingPrice: Math.round(basePrice * SPREAD_RATES.cashBuying * 100) / 100,
            cashSellingPrice: Math.round(basePrice * SPREAD_RATES.cashSelling * 100) / 100,
            ttSellingPrice: Math.round(basePrice * SPREAD_RATES.ttSelling * 100) / 100,
            ttBuyingPrice: Math.round(basePrice * SPREAD_RATES.ttBuying * 100) / 100,
            date: item.date ? item.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
            time: item.date ? item.date.slice(11, 19) : new Date().toISOString().slice(11, 19),
          }]);
        }
      }
    }
  } catch {
    // 2차 API 통과
  }

  // 3차 시도: open.er-api.com 글로벌 실시간 환율 백업 API
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      const rates = data.rates || {};
      const usdToKrw = rates.KRW || 1385;
      const targetRate = rates[currency] || 1;
      const krwPerUnit = usdToKrw / targetRate;

      const unitMultiplier = currency === 'JPY' ? 100 : currency === 'VND' ? 1000 : 1;
      const basePrice = Math.round(krwPerUnit * unitMultiplier * 100) / 100;

      return NextResponse.json([{
        code: reutersCode,
        currencyCode: currency,
        currencyName: currency,
        basePrice: basePrice,
        change: 'EVEN',
        changePrice: 0,
        changeRate: 0,
        cashBuyingPrice: Math.round(basePrice * SPREAD_RATES.cashBuying * 100) / 100,
        cashSellingPrice: Math.round(basePrice * SPREAD_RATES.cashSelling * 100) / 100,
        ttSellingPrice: Math.round(basePrice * SPREAD_RATES.ttSelling * 100) / 100,
        ttBuyingPrice: Math.round(basePrice * SPREAD_RATES.ttBuying * 100) / 100,
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toISOString().slice(11, 19),
      }]);
    }
  } catch {
    // 3차 API 통과
  }

  return NextResponse.json({ error: 'Exchange rate service currently unavailable' }, { status: 503 });
}
