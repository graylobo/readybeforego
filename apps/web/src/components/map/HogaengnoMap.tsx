"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useScamMapStore } from "@/lib/stores/scam-map.store";
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
    iconAnchor: [30, 30], // 아이콘 중심을 핀 포인트에 매핑
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

// 지도 클릭 이벤트를 캡처하여 위경도를 획득하기 위한 핸들러
function MapClickHandler() {
  const { isReportMode, setReportCoords, setReportModalOpen } = useScamMapStore();
  useMapEvents({
    click(e) {
      if (isReportMode) {
        setReportCoords([e.latlng.lat, e.latlng.lng]);
        setReportModalOpen(true);
      }
    },
  });
  return null;
}

export default function HogaengnoMap() {
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
  } = useScamMapStore();

  // 실시간 핀 수량 갱신을 위해 쿼리 호출
  const { data: regions = [] } = useQuery<Region[]>({
    queryKey: ["scam-regions"],
    queryFn: () => scamsApi.getAllRegions(),
  });

  const handleMarkerClick = (region: Region) => {
    setSelectedRegionId(region.id);
    setSelectedRegion(region);
    if (region.cityId) setSelectedCityId(region.cityId);
    if (region.countryCode) setSelectedCountryCode(region.countryCode);
    setMapCenter([region.latitude, region.longitude]);
    setMapZoom(14);
  };

  // 사기가 최소 1건 이상 제보된 지역만 지도에 마커로 표시합니다. (직방 마커 필터링)
  const activeRegions = regions.filter((r) => (r.scamCount || 0) > 0);

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
        <MapClickHandler />

        {/* 제보 중인 임시 타겟 포인트 */}
        {reportCoords && (
          <Marker position={reportCoords} icon={createTempReportIcon()} />
        )}

        {/* 사기 경보 핫스팟 원형 마커들 */}
        {activeRegions.map((region) => {
          const count = region.scamCount || 0;
          return (
            <Marker
              key={region.id}
              position={[region.latitude, region.longitude]}
              icon={createClusterIcon(count, region.name)}
              eventHandlers={{
                click: () => handleMarkerClick(region),
              }}
            >
              <Popup className="custom-popup">
                <div className="p-1 font-sans text-center">
                  <h4 className="font-bold text-slate-800 text-sm">{region.name}</h4>
                  <p className="text-xs text-rose-600 font-semibold mt-0.5">
                    ⚠️ {count}건의 사기 위험 주의 정보
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
