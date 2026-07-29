import { useQuery } from '@tanstack/react-query';
import { guidesApi, CountryGuideData, AvailableCountryGuide } from '@/lib/api/guides';

export const useAvailableGuideCountries = () => {
  return useQuery<AvailableCountryGuide[]>({
    queryKey: ['guides', 'countries'],
    queryFn: guidesApi.getAvailableCountries,
  });
};

export const useCountryGuides = (countryCode: string) => {
  return useQuery<CountryGuideData>({
    queryKey: ['guides', 'country', countryCode],
    queryFn: () => guidesApi.getGuidesByCountry(countryCode),
    enabled: !!countryCode,
    staleTime: 1000 * 60 * 5,
  });
};
