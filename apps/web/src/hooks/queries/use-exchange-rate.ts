import { useQuery } from '@tanstack/react-query';
import { getExchangeRate, ExchangeRateInfo } from '@/lib/api/exchange-rate';

export function useExchangeRate(currencyCode: string) {
  return useQuery<ExchangeRateInfo | null>({
    queryKey: ['exchange-rate', currencyCode],
    queryFn: () => getExchangeRate(currencyCode),
    enabled: !!currencyCode && currencyCode !== 'KRW',
    staleTime: 1000 * 60 * 30, // 30분간 캐싱
  });
}
