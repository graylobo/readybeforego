// 겪은 위치로 받을 수 있는 최대 거리. 서버 검증과 화면 안내가 같은 값을 쓴다
export const SIGHTING_MAX_DISTANCE_FROM_REGION_M = 5000;
export const SIGHTING_MAX_DISTANCE_FROM_CITY_M = 50000;

// 겪은 날짜의 정밀도. seenOn은 정밀도에 맞는 기간의 첫날이다 (week: 월요일, month: 1일)
export const SIGHTING_DATE_PRECISIONS = ['day', 'week', 'month'] as const;
export type SightingDatePrecision = (typeof SIGHTING_DATE_PRECISIONS)[number];
