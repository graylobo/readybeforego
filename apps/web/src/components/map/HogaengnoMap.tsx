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

// Custom animated alert warning pin for Hogaengno UI
const createWarningIcon = () => {
  return new L.DivIcon({
    html: `
      <div class="relative flex items-center justify-center">
        <div class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-rose-400 opacity-75"></div>
        <div class="relative inline-flex rounded-full h-5 w-5 bg-rose-600 border border-white items-center justify-center shadow-lg">
          <span class="text-white text-[10px] font-bold">⚠️</span>
        </div>
      </div>
    `,
    className: "custom-pin-icon",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
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

        {reportCoords && (
          <Marker position={reportCoords} icon={createTempReportIcon()} />
        )}

        {regions.map((region) => (
          <Marker
            key={region.id}
            position={[region.latitude, region.longitude]}
            icon={createWarningIcon()}
            eventHandlers={{
              click: () => handleMarkerClick(region),
            }}
          >
            <Popup className="custom-popup">
              <div className="p-1 font-sans">
                <h4 className="font-bold text-slate-800 text-sm">{region.name}</h4>
                <p className="text-xs text-rose-600 font-semibold mt-0.5">⚠️ 주의 필요 지역</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
