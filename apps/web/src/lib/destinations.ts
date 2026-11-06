/**
 * 도시별 주의사항 페이지. 먼저 방콕으로 반응을 본 뒤 도시를 늘린다.
 * cards는 페이지에서 먼저 보여줄 제보의 순서 (여기 없는 제보는 그 뒤에 나온다)
 */
export interface Destination {
  countrySlug: string;
  countryCode: string;
  citySlug: string;
  /** cities.name_en과 같은 값 (도시를 찾는 기준) */
  cityNameEn: string;
  cityName: string;
  cards: string[];
}

export const DESTINATIONS: Destination[] = [
  {
    countrySlug: 'th',
    countryCode: 'TH',
    citySlug: 'bangkok',
    cityNameEn: 'Bangkok',
    cityName: '방콕',
    cards: [
      '10000000-0000-0000-0000-000000000001', // 저렴한 툭툭 투어
      '10000000-0000-0000-0000-000000000003', // 사원이 닫았다는 거짓 안내
      '10000000-0000-0000-0000-000000000101', // 택시 미터기 거부
      '10000000-0000-0000-0000-000000000002', // 대마 성분 음식
      '10000000-0000-0000-0000-000000000004', // 음료 약물
    ],
  },
];

export const destinationPath = (destination: Destination) =>
  `/destinations/${destination.countrySlug}/${destination.citySlug}`;

export function findDestination(countrySlug: string, citySlug: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.countrySlug === countrySlug && d.citySlug === citySlug);
}

/** 정해 둔 순서를 먼저, 나머지는 받은 순서대로 */
export function sortByCardOrder<T extends { id: string }>(items: T[], cards: string[]): T[] {
  const rank = (id: string) => {
    const index = cards.indexOf(id);
    return index === -1 ? cards.length : index;
  };
  return items.map((item, i) => ({ item, i })).sort((a, b) => rank(a.item.id) - rank(b.item.id) || a.i - b.i).map(({ item }) => item);
}
