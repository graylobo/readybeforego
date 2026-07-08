"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useScamMapStore } from "@/lib/stores/scam-map.store";
import { useTranslation } from "@/hooks/use-translation";
import { Region, scamsApi } from "@/lib/api/scams";
import { useQuery } from "@tanstack/react-query";
import "leaflet/dist/leaflet.css";

// Webpack marker-icon path fixes for Next.js bundle
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

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
    pulseClass = "animate-pulse";
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
  onMapClick: (lat: number, lng: number) => void;
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
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function HogaengnoMap() {
  const { t } = useTranslation();
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
        acc[code] = {
          id: `country-${code}`,
          name: t(`countries_list.${code}`, { defaultValue: code }),
          countryCode: code,
          latitude: 0,
          longitude: 0,
          scamCount: 0,
          count: 0,
        };
      }
      acc[code].latitude += region.latitude;
      acc[code].longitude += region.longitude;
      acc[code].scamCount += (region.scamCount || 0);
      acc[code].count += 1;
      return acc;
    }, {} as Record<string, any>)
  ).map((c: any) => ({
    ...c,
    latitude: c.latitude / c.count,
    longitude: c.longitude / c.count,
  })).filter(c => c.scamCount > 0);

  // 2. 도시 레벨 클러스터 연산 (7 < 줌 <= 11)
  const cityClusters = Object.values(
    regions.reduce((acc, region) => {
      const cityId = region.cityId || "UNKNOWN";
      if (!acc[cityId]) {
        acc[cityId] = {
          id: `city-${cityId}`,
          name: t(`cities_list.${region.cityName}`, { defaultValue: region.cityName || "City" }),
          cityId,
          countryCode: region.countryCode,
          latitude: 0,
          longitude: 0,
          scamCount: 0,
          count: 0,
        };
      }
      acc[cityId].latitude += region.latitude;
      acc[cityId].longitude += region.longitude;
      acc[cityId].scamCount += (region.scamCount || 0);
      acc[cityId].count += 1;
      return acc;
    }, {} as Record<string, any>)
  ).map((c: any) => ({
    ...c,
    latitude: c.latitude / c.count,
    longitude: c.longitude / c.count,
  })).filter(c => c.scamCount > 0);

  // 3. 세부 지역 레벨 연산 (줌 > 11)
  const regionMarkers = regions.filter((r) => (r.scamCount || 0) > 0);

  // 국가 클러스터 클릭 시
  const handleCountryClick = (c: any) => {
    setSelectedCountryCode(c.countryCode);
    setSelectedCityId(null);
    setSelectedRegionId(null);
    setMapCenter([c.latitude, c.longitude]);
  };

  // 도시 클러스터 클릭 시
  const handleCityClick = (c: any) => {
    setSelectedCountryCode(c.countryCode);
    setSelectedCityId(c.cityId);
    setSelectedRegionId(null);
    setMapCenter([c.latitude, c.longitude]);
  };

  // 개별 지역 마커 클릭 시
  const handleRegionClick = (region: Region) => {
    setSelectedRegionId(region.id);
    setSelectedRegion(region);
    if (region.cityId) setSelectedCityId(region.cityId);
    if (region.countryCode) setSelectedCountryCode(region.countryCode);
    setMapCenter([region.latitude, region.longitude]);
  };

  // 제보 모드 상태에서의 지도 클릭 핸들러
  const handleMapClick = (lat: number, lng: number) => {
    if (isReportMode) {
      setReportCoords([lat, lng]);
      setReportModalOpen(true);
    }
  };

  return (
    <div className="h-full w-full relative rounded-2xl overflow-hidden shadow-inner border border-border bg-muted">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        className="h-full w-full z-0"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
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
          // 3단계: 개별 장소 레벨 렌더링
          regionMarkers.map((region) => (
            <Marker
              key={region.id}
              position={[region.latitude, region.longitude]}
              icon={createClusterIcon(region.scamCount || 0, region.name)}
              eventHandlers={{
                click: () => handleRegionClick(region),
              }}
            >
              <Popup className="custom-popup">
                <div className="p-1 font-sans text-center">
                  <h4 className="font-bold text-slate-800 text-sm">{region.name}</h4>
                  <p className="text-xs text-rose-600 font-semibold mt-0.5">
                    ⚠️ {(region.scamCount || 0)}건의 위험 정보
                  </p>
                </div>
              </Popup>
            </Marker>
          ))
        )}
      </MapContainer>
    </div>
  );
}
