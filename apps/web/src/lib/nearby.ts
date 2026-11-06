import type { Region } from "./api/scams";

export type LatLng = [number, number];

// 호객꾼처럼 한 지점에 머물지 않는 주의사항을 지도에 표시하는 구역의 반경
export const REGION_AREA_RADIUS_M = 300;

// 가까운 범위부터 넓혀 가며 주의사항이 있는 첫 범위를 쓴다
const SEARCH_RADII_M = [1000, 3000, 10000, 50000];

export interface NearbyRegion {
  region: Region;
  distanceM: number;
}

export interface NearbyResult {
  radiusM: number | null;
  items: NearbyRegion[];
  nearest: NearbyRegion | null;
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// 위치는 서버로 보내지 않고 브라우저에서 계산한다
// 주변에 장소 제보가 없을 때 도시 전체 주의사항을 찾는 거리
export const NEARBY_CITY_FALLBACK_RADIUS_M = 50000;

export function findNearbyRegions(center: LatLng, regions: Region[]): NearbyResult {
  const ranked = regions
    .filter((r) => (r.scamCount || 0) > 0)
    .map((region) => ({
      region,
      distanceM: distanceMeters(center, [region.latitude, region.longitude]),
    }))
    .sort((a, b) => a.distanceM - b.distanceM);

  const nearest = ranked[0] ?? null;
  for (const radiusM of SEARCH_RADII_M) {
    const items = ranked.filter((r) => r.distanceM <= radiusM);
    if (items.length > 0) return { radiusM, items, nearest };
  }
  return { radiusM: null, items: [], nearest };
}

export function zoomForRadius(radiusM: number | null): number {
  if (radiusM === null) return 13;
  if (radiusM <= 1000) return 15;
  if (radiusM <= 3000) return 14;
  if (radiusM <= 10000) return 12;
  return 10;
}

// GPS 오차와 호객꾼의 이동을 고려해 정확한 수치처럼 보이지 않도록 어림값으로 표시한다
export function formatDistance(distanceM: number): string {
  if (distanceM < 100) return "100m 이내";
  if (distanceM < 1000) return `약 ${Math.round(distanceM / 50) * 50}m`;
  if (distanceM < 10000) return `약 ${(distanceM / 1000).toFixed(1)}km`;
  return `약 ${Math.round(distanceM / 1000).toLocaleString("ko-KR")}km`;
}

export function formatRadius(radiusM: number): string {
  return radiusM >= 1000 ? `${radiusM / 1000}km` : `${radiusM}m`;
}
