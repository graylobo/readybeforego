"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useScamMapStore } from "@/lib/stores/scam-map.store";
import { useTranslation } from "@/hooks/use-translation";
import { Region, scamsApi } from "@/lib/api/scams";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

// Webpack marker-icon path fixes for Next.js bundle
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// 주요 국가별 표준 중심 좌표 정의 (도시/마커 분포 쏠림 방지)
const COUNTRY_COORDS: Record<string, [number, number]> = {
  KR: [36.3, 127.8], // 대한민국 중심
  TH: [13.7563, 100.5018], // 태국 방콕
  VN: [16.0544, 108.2022], // 베트남 다낭
  KH: [11.5564, 104.9282], // 캄보디아 프놈펜
  JP: [35.6762, 139.6503], // 일본 도쿄
};

// 주요 도시별 표준 중심 좌표 정의
const CITY_COORDS: Record<string, [number, number]> = {
  "부산광역시": [35.1796, 129.0756],
  "Busan": [35.1796, 129.0756],
  "서울특별시": [37.5665, 126.9780],
  "Seoul": [37.5665, 126.9780],
  "방콕": [13.7563, 100.5018],
  "Bangkok": [13.7563, 100.5018],
  "다낭": [16.0544, 108.2022],
  "Da Nang": [16.0544, 108.2022],
  "프놈펜": [11.5564, 104.9282],
  "Phnom Penh": [11.5564, 104.9282],
};

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon.src,
  iconRetinaUrl: markerIcon2x.src,
  shadowUrl: markerShadow.src,
});

// "직방" 스타일의 수량 비례형 원형 뱃지 마커 및 위치 이름 라벨 오버레이 생성
const createClusterIcon = (count: number, name: string) => {
  let sizeClass = "w-9 h-9 text-xs";
  let colorClass = "from-amber-400 to-orange-500";
  let pulseClass = "";

  if (count >= 6) {
    sizeClass = "w-13 h-13 text-sm border-rose-400";
    colorClass = "from-red-600 to-rose-600";
    pulseClass = "";
  } else if (count >= 3) {
    sizeClass = "w-11 h-11 text-xs border-orange-300";
    colorClass = "from-orange-500 to-red-500";
  }

  return new L.DivIcon({
    html: `
      <div class="flex flex-col items-center justify-center select-none group cursor-pointer">
        <div class="flex items-center justify-center rounded-full text-white font-black shadow-md border-2 border-white bg-gradient-to-br transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg ${colorClass} ${sizeClass} ${pulseClass}">
          ${count}
        </div>
        <div class="mt-1 bg-slate-900/90 dark:bg-slate-950/90 text-[10px] font-bold text-white px-2 py-0.5 rounded-full shadow border border-white/10 whitespace-nowrap max-w-[110px] truncate text-center group-hover:bg-slate-900 transition-colors">
          ${name}
        </div>
      </div>
    `,
    className: "custom-cluster-icon",
    iconSize: [60, 60],
    iconAnchor: [30, 30],
  });
};

// 임시 제보 핀 아이콘 (파란색 테두리 및 핀)
const createTempReportIcon = () => {
  return new L.DivIcon({
    html: `
      <div class="relative flex items-center justify-center">
        <div class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-sky-400 opacity-75"></div>
        <div class="relative inline-flex rounded-full h-5 w-5 bg-sky-600 border border-white items-center justify-center shadow-lg">
          <span class="text-white text-[10px] font-bold">📍</span>
        </div>
      </div>
    `,
    className: "custom-pin-icon-temp",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// 지도 제어 및 카메라 뷰 핸들러
function MapViewHandler({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, {
      animate: true,
      duration: 0.8,
    });
  }, [center, zoom, map]);
  return null;
}

// 지도 줌 리스너 및 클릭 감지 핸들러 통합
interface MapEventsHandlerProps {
  onZoomChange: (zoom: number) => void;
  onMapClick: (lat: number, lng: number, zoom: number) => void;
}

function MapEventsHandler({ onZoomChange, onMapClick }: MapEventsHandlerProps) {
  const { setMapZoom, setMapCenter } = useScamMapStore();
  const map = useMapEvents({
    zoomend() {
      const z = map.getZoom();
      onZoomChange(z);
      setMapZoom(z);
    },
    moveend() {
      const center = map.getCenter();
      setMapCenter([center.lat, center.lng]);
    },
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng, map.getZoom());
    },
  });
  return null;
}

export default function HogaengnoMap() {
  const { t, lang } = useTranslation();
  const {
    mapCenter,
    mapZoom,
    setSelectedRegionId,
    setSelectedRegion,
    setSelectedCityId,
    setSelectedCountryCode,
    setMapCenter,
    setMapZoom,
    reportCoords,
    isReportMode,
    setReportCoords,
    setReportModalOpen,
    setIsMobileFeedOpen,
    resetFeedSelections,
    setReportType,
  } = useScamMapStore();

  const [currentZoom, setCurrentZoom] = useState(mapZoom);

  // Sync state when store mapZoom updates
  useEffect(() => {
    setCurrentZoom(mapZoom);
  }, [mapZoom]);

  const { data: regions = [] } = useQuery<Region[]>({
    queryKey: ["scam-regions"],
    queryFn: () => scamsApi.getAllRegions(),
  });

  // 1. 국가 레벨 클러스터 연산 (줌 <= 7)
  const countryClusters = Object.values(
    regions.reduce((acc, region) => {
      const code = region.countryCode || "UNKNOWN";
      if (!acc[code]) {
        const rawName = t(`countries_list.${code}`);
        const displayName = rawName.startsWith("countries_list.") ? code : rawName;
        acc[code] = {
          id: `country-${code}`,
          name: displayName,
          countryCode: code,
          latitudeSum: 0,
          longitudeSum: 0,
          scamCount: 0,
          count: 0,
        };
      }
      acc[code].latitudeSum += region.latitude;
      acc[code].longitudeSum += region.longitude;
      acc[code].scamCount += (region.scamCount || 0);
      acc[code].count += 1;
      return acc;
    }, {} as Record<string, any>)
  ).map((c: any) => {
    // 딕셔너리 좌표 우선 참조, 없으면 소속 리전들의 산술 평균 좌표 (폴백)
    let coords = COUNTRY_COORDS[c.countryCode];
    if (!coords) {
      coords = [c.latitudeSum / c.count, c.longitudeSum / c.count];
    }
    return {
      id: c.id,
      name: c.name,
      countryCode: c.countryCode,
      latitude: coords[0],
      longitude: coords[1],
      scamCount: c.scamCount,
    };
  }).filter(c => c.scamCount > 0);

  // 2. 도시 레벨 클러스터 연산 (7 < 줌 <= 11)
  const cityClusters = Object.values(
    regions.reduce((acc, region) => {
      const cityId = region.cityId || "UNKNOWN";
      if (!acc[cityId]) {
        acc[cityId] = {
          id: `city-${cityId}`,
          name: region.cityName ? t(`cities_list.${region.cityName}`, { defaultValue: region.cityName }) : "City",
          cityNameRaw: region.cityName || "", // 딕셔너리 조회를 위한 원본명 보관
          cityId,
          countryCode: region.countryCode,
          latitudeSum: 0,
          longitudeSum: 0,
          scamCount: 0,
          count: 0,
        };
      }
      acc[cityId].latitudeSum += region.latitude;
      acc[cityId].longitudeSum += region.longitude;
      acc[cityId].scamCount += (region.scamCount || 0);
      acc[cityId].count += 1;
      return acc;
    }, {} as Record<string, any>)
  ).map((c: any) => {
    // 도시명 딕셔너리 조회
    let coords = CITY_COORDS[c.cityNameRaw];
    if (!coords) {
      coords = [c.latitudeSum / c.count, c.longitudeSum / c.count];
    }
    return {
      id: c.id,
      name: c.name,
      cityId: c.cityId,
      countryCode: c.countryCode,
      latitude: coords[0],
      longitude: coords[1],
      scamCount: c.scamCount,
    };
  }).filter(c => c.scamCount > 0);

  // 3. 세부 지역 레벨 연산 및 줌 비례형 동적 로컬 클러스터링 (줌 > 11)
  const getLocalClusters = () => {
    const regionMarkers = regions.filter((r) => (r.scamCount || 0) > 0);
    if (currentZoom > 15) {
      return regionMarkers.map(r => ({
        id: r.id,
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        scamCount: r.scamCount || 0,
        isCluster: false,
        regions: [r]
      }));
    }

    // 줌 레벨별 병합 기준 반경 설정 (위경도 단위 차이)
    let threshold = 0.001;
    if (currentZoom === 12) threshold = 0.015;
    else if (currentZoom === 13) threshold = 0.008;
    else if (currentZoom === 14) threshold = 0.004;
    else if (currentZoom === 15) threshold = 0.0015;

    const clusters: any[] = [];
    const visited = new Set<string>();

    for (let i = 0; i < regionMarkers.length; i++) {
      const r1 = regionMarkers[i];
      if (visited.has(r1.id)) continue;

      const group = [r1];
      visited.add(r1.id);

      for (let j = i + 1; j < regionMarkers.length; j++) {
        const r2 = regionMarkers[j];
        if (visited.has(r2.id)) continue;

        const latDiff = Math.abs(r1.latitude - r2.latitude);
        const lngDiff = Math.abs(r1.longitude - r2.longitude);

        if (latDiff < threshold && lngDiff < threshold) {
          group.push(r2);
          visited.add(r2.id);
        }
      }

      if (group.length === 1) {
        clusters.push({
          id: r1.id,
          name: r1.name,
          latitude: r1.latitude,
          longitude: r1.longitude,
          scamCount: r1.scamCount || 0,
          isCluster: false,
          regions: group
        });
      } else {
        const sumLat = group.reduce((sum, r) => sum + r.latitude, 0);
        const sumLng = group.reduce((sum, r) => sum + r.longitude, 0);
        const totalScamCount = group.reduce((sum, r) => sum + (r.scamCount || 0), 0);
        
        const sortedGroup = [...group].sort((a, b) => (b.scamCount || 0) - (a.scamCount || 0));
        const representativeName = sortedGroup[0].name;
        const displayName = `${representativeName} 외 ${group.length - 1}`;

        clusters.push({
          id: `cluster-${r1.id}`,
          name: displayName,
          latitude: sumLat / group.length,
          longitude: sumLng / group.length,
          scamCount: totalScamCount,
          isCluster: true,
          regions: group
        });
      }
    }

    return clusters;
  };

  // 국가 클러스터 클릭 시
  const handleCountryClick = (c: any) => {
    if (isReportMode) {
      setMapCenter([c.latitude, c.longitude]);
      setMapZoom(16);
      toast.info("마커가 세분화될 때까지 지도를 확대했습니다! 📍 상세 마커를 선택해 주세요.");
      return;
    }
    setSelectedCountryCode(c.countryCode);
    setSelectedCityId(null);
    setSelectedRegionId(null);
    setMapCenter([c.latitude, c.longitude]);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsMobileFeedOpen(true);
    }
  };

  // 도시 클러스터 클릭 시
  const handleCityClick = (c: any) => {
    if (isReportMode) {
      setMapCenter([c.latitude, c.longitude]);
      setMapZoom(16);
      toast.info("마커가 세분화될 때까지 지도를 확대했습니다! 📍 상세 마커를 선택해 주세요.");
      return;
    }
    setSelectedCountryCode(c.countryCode);
    setSelectedCityId(c.cityId);
    setSelectedRegionId(null);
    setMapCenter([c.latitude, c.longitude]);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsMobileFeedOpen(true);
    }
  };

  // 개별 지역 마커 클릭 시
  const handleRegionClick = (region: Region) => {
    setSelectedRegionId(region.id);
    setSelectedRegion(region);
    if (region.cityId) setSelectedCityId(region.cityId);
    if (region.countryCode) setSelectedCountryCode(region.countryCode);
    setMapCenter([region.latitude, region.longitude]);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsMobileFeedOpen(true);
    }
  };

  // 로컬 클러스터 마커 클릭 시
  const handleLocalClusterClick = (cluster: any) => {
    if (isReportMode) {
      if (cluster.isCluster) {
        setMapCenter([cluster.latitude, cluster.longitude]);
        setMapZoom(16);
        toast.info("마커가 세분화될 때까지 지도를 확대했습니다! 📍 상세 마커를 선택해 주세요.");
      } else {
        const region = cluster.regions[0];
        const confirmReport = window.confirm(`해당 ${region.name}에 추가로 제보를 등록하시겠습니까?`);
        if (confirmReport) {
          setReportType("existing");
          setReportCoords([region.latitude, region.longitude]);
          setSelectedRegionId(region.id);
          setSelectedRegion(region);
          setReportModalOpen(true);
        }
      }
    } else {
      if (cluster.isCluster) {
        setMapCenter([cluster.latitude, cluster.longitude]);
        setMapZoom(Math.min(currentZoom + 1, 16));
      } else {
        handleRegionClick(cluster.regions[0]);
      }
    }
  };

  // 제보 모드 상태에서의 지도 클릭 핸들러
  const handleMapClick = (lat: number, lng: number, zoomVal: number) => {
    if (isReportMode) {
      if (zoomVal < 18) {
        // 아직 최대 줌(18) 미만인 경우 ➔ 임시 핀포인트를 그리지 않고 1단계씩 점진적 줌인
        setReportCoords(null);
        
        const targetZoom = Math.min(zoomVal + 1, 18);
        setMapCenter([lat, lng]);
        setMapZoom(targetZoom);
        
        if (targetZoom < 18) {
          toast.info(`📍 지도를 확대 중입니다 (현재 줌: ${targetZoom}/18). 정확한 위치를 위해 더 확대해 주세요!`);
        } else {
          toast.info("📍 지도가 최대로 확대되었습니다! 정확한 피해 지점을 최종 클릭해 주세요.");
        }
        return;
      }
      setReportCoords([lat, lng]);
      setReportModalOpen(true);
    } else {
      // 일반 조회 모드인 경우 ➔ 마커 영역 밖 빈 지도 클릭 시 선택 사항 리셋! (지도 중심과 줌은 유지!)
      resetFeedSelections();
    }
  };

  return (
    <div className="h-full w-full relative rounded-2xl overflow-hidden shadow-inner border border-border bg-muted">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        className="h-full w-full z-0"
        zoomControl={true}
        minZoom={3}
        maxBounds={[[-85, -180], [85, 180]]}
        maxBoundsViscosity={1.0}
      >
        <TileLayer
          attribution='&copy; <a href="https://maps.google.com">Google Maps</a>'
          url={`https://mt1.google.com/vt/lyrs=m&hl=${lang}&x={x}&y={y}&z={z}`}
          noWrap={true}
        />
        
        <MapViewHandler center={mapCenter} zoom={mapZoom} />
        
        <MapEventsHandler 
          onZoomChange={(zoom) => setCurrentZoom(zoom)} 
          onMapClick={handleMapClick} 
        />

        {/* 제보 중인 임시 타겟 포인트 */}
        {reportCoords && (
          <Marker position={reportCoords} icon={createTempReportIcon()} />
        )}

        {/* 줌 레벨에 따라 동적 클러스터 렌더링 분기 */}
        {currentZoom <= 7 && (
          // 1단계: 국가 레벨 렌더링
          countryClusters.map((c: any) => (
            <Marker
              key={c.id}
              position={[c.latitude, c.longitude]}
              icon={createClusterIcon(c.scamCount, c.name)}
              eventHandlers={{
                click: () => handleCountryClick(c),
              }}
            />
          ))
        )}

        {currentZoom > 7 && currentZoom <= 11 && (
          // 2단계: 도시 레벨 렌더링
          cityClusters.map((c: any) => (
            <Marker
              key={c.id}
              position={[c.latitude, c.longitude]}
              icon={createClusterIcon(c.scamCount, c.name)}
              eventHandlers={{
                click: () => handleCityClick(c),
              }}
            />
          ))
        )}

        {currentZoom > 11 && (
          // 3단계: 개별 장소 레벨 렌더링 (줌 비례형 동적 로컬 클러스터러 작동)
          getLocalClusters().map((cluster) => (
            <Marker
              key={cluster.id}
              position={[cluster.latitude, cluster.longitude]}
              icon={createClusterIcon(cluster.scamCount, cluster.name)}
              eventHandlers={{
                click: () => handleLocalClusterClick(cluster),
              }}
            >
              {!cluster.isCluster && (
                <Popup className="custom-popup">
                  <div className="p-1 font-sans text-center">
                    <h4 className="font-bold text-slate-800 text-sm">{cluster.name}</h4>
                    <p className="text-xs text-rose-600 font-semibold mt-0.5">
                      ⚠️ {cluster.scamCount}건의 위험 정보
                    </p>
                  </div>
                </Popup>
              )}
            </Marker>
          ))
        )}
      </MapContainer>
    </div>
  );
}
