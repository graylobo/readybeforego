"use client";

import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useScamMapStore } from "@/lib/stores/scam-map.store";
import { useTranslation } from "@/hooks/use-translation";
import { Region, scamsApi } from "@/lib/api/scams";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getCountryName } from "@/lib/utils/country";
import { Compass, Loader2, Locate } from "lucide-react";
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
  PH: [12.8797, 121.7740], // 필리핀 중심
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

// 사용자 현재 위치 마커 아이콘 (세련된 파란색 도트)
const createUserLocationIcon = () => {
  return new L.DivIcon({
    html: `
      <div class="relative flex items-center justify-center w-6 h-6">
        <div class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-blue-500 opacity-60"></div>
        <div class="relative w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow-md z-10"></div>
      </div>
    `,
    className: "user-location-marker",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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

// 제보 모드 + 최대 확대 시 커서를 핀 모양으로 변경하는 핸들러
function MapCursorHandler({ active }: { active: boolean }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    if (active) {
      container.classList.add("cursor-report-mode");
    } else {
      container.classList.remove("cursor-report-mode");
    }
  }, [active, map]);
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

export default function ReadyBeforeGoMap() {
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
    geoData,
    setGeoData,
    setGeocodeConfirmModalOpen,
    isReportConfirmModalOpen,
    setReportConfirmModalOpen,
  } = useScamMapStore();

  const [currentZoom, setCurrentZoom] = useState(mapZoom);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isMapGeocoding, setIsMapGeocoding] = useState(false);
  
  // 임시 제보 마커 참조 레퍼런스
  const markerRef = useRef<L.Marker>(null);

  // Sync state when store mapZoom updates
  useEffect(() => {
    setCurrentZoom(mapZoom);
  }, [mapZoom]);

  // 주소 매칭 컨펌 모달이 켜지거나 임시 핀 좌표가 잡혔을 때 바로 팝업창을 즉각 강제 오픈 🛡️
  useEffect(() => {
    if (isReportConfirmModalOpen && reportCoords && markerRef.current) {
      const timer = setTimeout(() => {
        markerRef.current?.openPopup();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isReportConfirmModalOpen, reportCoords]);

  const { data: regions = [] } = useQuery<Region[]>({
    queryKey: ["scam-regions"],
    queryFn: () => scamsApi.getAllRegions(),
  });

  // 줌 레벨별 병합 기준 반경 설정 (위경도 단위 차이)
  const getThresholdForZoom = (zoom: number) => {
    if (zoom <= 3) return 15.0;     // 대륙 스케일
    if (zoom === 4) return 6.0;      // 넓은 국가 스케일
    if (zoom === 5) return 2.5;      // 국가 스케일 (서울-부산 320km 분리)
    if (zoom === 6) return 1.0;      // 남한 전체 스케일 (서울-공주 110km 분리)
    if (zoom === 7) return 0.4;      // 광역 경기-충청 스케일 (수원-천안 분리)
    if (zoom === 8) return 0.18;     // 시/도 스케일 (천안-세종 분리)
    if (zoom === 9) return 0.08;     // 세부 시내 스케일 (서울 강북-강남 분리)
    if (zoom === 10) return 0.03;    // 구 스케일
    if (zoom === 11) return 0.012;   // 동 스케일
    if (zoom === 12) return 0.005;   // 세부 구/동 스케일
    if (zoom === 13) return 0.002;
    if (zoom === 14) return 0.001;
    return 0.0003; // zoom >= 15 (정밀 개별 지점 마커)
  };

  // 모든 줌 레벨 통합 동적 클러스터러
  const getDynamicClusters = () => {
    const activeRegions = regions.filter((r) => (r.scamCount || 0) > 0);
    const threshold = getThresholdForZoom(currentZoom);
    
    const clusters: any[] = [];
    const visited = new Set<string>();

    for (let i = 0; i < activeRegions.length; i++) {
      const r1 = activeRegions[i];
      if (visited.has(r1.id)) continue;

      const group = [r1];
      visited.add(r1.id);

      for (let j = i + 1; j < activeRegions.length; j++) {
        const r2 = activeRegions[j];
        if (visited.has(r2.id)) continue;

        const latDiff = Math.abs(r1.latitude - r2.latitude);
        const lngDiff = Math.abs(r1.longitude - r2.longitude);
        const isSameCountry = r1.countryCode === r2.countryCode;

        if (isSameCountry && latDiff < threshold && lngDiff < threshold) {
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
          regions: group,
        });
      } else {
        const sumLat = group.reduce((sum, r) => sum + r.latitude, 0);
        const sumLng = group.reduce((sum, r) => sum + r.longitude, 0);
        const totalScamCount = group.reduce((sum, r) => sum + (r.scamCount || 0), 0);
        
        const sortedGroup = [...group].sort((a, b) => (b.scamCount || 0) - (a.scamCount || 0));
        const representative = sortedGroup[0];
        
        let displayName = "";
        if (currentZoom <= 5) {
          displayName = getCountryName(representative.countryCode, lang) || representative.name;
        } else if (currentZoom <= 9) {
          displayName = representative.cityName || representative.name;
        } else {
          displayName = representative.name;
        }

        if (group.length > 1) {
          displayName = `${displayName} 외 ${group.length - 1}`;
        }

        clusters.push({
          id: `cluster-${r1.id}`,
          name: displayName,
          latitude: sumLat / group.length,
          longitude: sumLng / group.length,
          scamCount: totalScamCount,
          isCluster: true,
          regions: group,
        });
      }
    }

    return clusters;
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

  // 동적 클러스터 마커 클릭 핸들러
  const handleDynamicClusterClick = (cluster: any) => {
    if (isReportMode) {
      if (cluster.isCluster) {
        setMapCenter([cluster.latitude, cluster.longitude]);
        setMapZoom(Math.min(currentZoom + 2, 18));
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
        setMapZoom(Math.min(currentZoom + 2, 18));
      } else {
        handleRegionClick(cluster.regions[0]);
      }
    }
  };

  // 제보 모드 상태에서의 지도 클릭 핸들러
  const handleMapClick = (lat: number, lng: number, zoomVal: number) => {
    if (isReportMode) {
      if (zoomVal < 18) {
        setMapCenter([lat, lng]);
        setMapZoom(Math.min(zoomVal + 2, 18));
        toast.info("📍 정확한 제보를 위해 최대 확대 단계(Zoom 18)로 2단계 확대합니다. 확대된 화면에서 원하는 위치를 한 번 더 클릭해 제보해 주세요!");
        return;
      }

      // [백그라운드 지오코딩 & 우아한 로딩바 🛡️]
      toast.dismiss();
      setIsMapGeocoding(true);
      const toastId = toast.loading("📍 선택하신 위치 정보를 분석하고 있습니다...");

      scamsApi.reverseGeocode(lat, lng)
        .then((data) => {
          if (data && data.address && Object.keys(data.address).length > 0) {
            const addr = data.address;
            const country = addr.country || "기타 국가";
            const countryCodeVal = (addr.country_code || "ETC").toUpperCase();
            const city = addr.city || addr.province || addr.state || addr.region || addr.town || addr.village || addr.city_district || addr.state_district || addr.county || "기타 도시";

            // 성공 시 스토어 데이터 바인딩 후 지도 컨펌 팝업 기동
            setReportCoords([lat, lng]);
            setGeoData(data);
            setReportConfirmModalOpen(true);
            toast.success("위치 분석 완료! 제보할 위치를 확인해 주세요.", { id: toastId });
          } else {
            // 위치 정보 획득 실패 시, 임시 좌표 얹고 주소 수동 검색 확인 모달 기동
            setReportCoords([lat, lng]);
            setGeocodeConfirmModalOpen(true);
            toast.dismiss(toastId);
          }
        })
        .catch((err) => {
          console.error("Map Geocoding Error:", err);
          // 통신 장애 시에도 주소 수동 검색 확인 모달 기동
          setReportCoords([lat, lng]);
          setGeocodeConfirmModalOpen(true);
          toast.dismiss(toastId);
        })
        .finally(() => {
          setIsMapGeocoding(false);
        });
    } else {
      // 일반 조회 모드인 경우 ➔ 마커 영역 밖 빈 지도 클릭 시 선택 사항 리셋! (지도 중심과 줌은 유지!)
      resetFeedSelections();
    }
  };

  // 사용자 현재 위치 GPS 탐색 함수
  const handleLocateUser = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error("이 브라우저에서는 현재 위치 기능을 지원하지 않습니다.");
      return;
    }

    toast.loading("현재 위치를 확인하고 있습니다...", { id: "geolocation" });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        setMapCenter([latitude, longitude]);
        setMapZoom(16);
        toast.success("현재 위치로 이동했습니다! 📍", { id: "geolocation" });
      },
      (error) => {
        console.error("Geolocation Error:", error);
        toast.error("위치 정보 접근 권한이 거부되었거나 위치를 찾을 수 없습니다.", { id: "geolocation" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="h-full w-full relative rounded-2xl overflow-hidden shadow-inner border border-border bg-muted">
      <style>{`
        .cursor-report-mode,
        .cursor-report-mode .leaflet-pane,
        .cursor-report-mode .leaflet-grab,
        .cursor-report-mode .leaflet-interactive,
        .cursor-report-mode .leaflet-marker-icon,
        .cursor-report-mode * {
          cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='%23DC2626' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z'/%3E%3Ccircle cx='12' cy='10' r='3' fill='%23DC2626'/%3E%3C/svg%3E") 16 31, pointer !important;
        }

        @keyframes loaderProgress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 95%; }
        }
        .animate-loader-progress {
          animation: loaderProgress 1.8s ease-in-out infinite alternate;
        }

        /* Leaflet Popup 어두운 테마 오버라이드 🛡️ */
        .leaflet-popup-content-wrapper {
          background: #0f172a !important; /* slate-900 */
          color: #f8fafc !important; /* slate-50 */
          border-radius: 14px !important;
          border: 1px solid #334155 !important; /* slate-700 */
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4) !important;
          padding: 2px !important;
        }
        .leaflet-popup-tip {
          background: #0f172a !important;
          border: 1px solid #334155 !important;
          box-shadow: none !important;
        }
        .leaflet-popup-content {
          margin: 12px 14px !important;
          line-height: inherit !important;
        }

        /* 검색 버튼 아래에 줌 제어 박스 배치 🛡️ */
        .leaflet-top.leaflet-left {
          top: 44px !important;
        }
      `}</style>

      {/* 우아한 백그라운드 지오코딩 로딩 바 오버레이 🛡️ */}
      {isMapGeocoding && (
        <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[3px] z-[9999] flex flex-col items-center justify-center select-none">
          <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 flex flex-col items-center gap-4 text-center transform scale-100 transition-all duration-300">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <span className="absolute w-10 h-10 rounded-full border border-blue-500/20 animate-ping"></span>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">위치 분석 중</h4>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                선택하신 좌표의 상세 주소 정보를<br />안전하게 분석하고 있습니다.
              </p>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full animate-loader-progress"></div>
            </div>
          </div>
        </div>
      )}

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
        <MapCursorHandler active={isReportMode && currentZoom >= 18} />
        
        <MapEventsHandler 
          onZoomChange={(zoom) => setCurrentZoom(zoom)} 
          onMapClick={handleMapClick} 
        />

        {/* 제보 중인 임시 타겟 포인트 */}
        {reportCoords && (
          <Marker 
            ref={markerRef}
            position={reportCoords} 
            icon={createTempReportIcon()}
          >
            {isReportConfirmModalOpen && (
              <Popup
                position={reportCoords}
                closeButton={false}
                autoClose={false}
                closeOnClick={false}
              >
                <div className="p-0.5 space-y-2.5 max-w-[220px] text-slate-100 min-w-0">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-extrabold text-blue-400 flex items-center gap-1">
                      🧭 제보 위치 확인
                    </p>
                    <p className="text-[10.5px] font-bold leading-relaxed text-slate-200">
                      지도 위 선택하신 이 위치에 피해 사례를 제보하시겠습니까?
                    </p>
                    {geoData && (
                      <p className="text-[9.5px] font-medium text-slate-300 bg-slate-950/60 border border-slate-800/80 p-1.5 rounded-md mt-1 truncate block w-full">
                        {geoData.name || geoData.display_name.split(",")[0]}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1.5 pt-1 w-full flex-shrink-0">
                    <button
                      onClick={() => {
                        setGeocodeConfirmModalOpen(false);
                        setReportConfirmModalOpen(false);
                        setReportCoords(null);
                      }}
                      className="flex-1 py-1 px-2 border border-slate-700 text-slate-300 rounded text-[10px] font-semibold hover:bg-slate-800 cursor-pointer text-center bg-transparent transition-colors"
                      type="button"
                    >
                      아니오
                    </button>
                    <button
                      onClick={() => {
                        setReportConfirmModalOpen(false);
                        setReportModalOpen(true);
                      }}
                      className="flex-1 py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold cursor-pointer text-center transition-colors"
                      type="button"
                    >
                      예
                    </button>
                  </div>
                </div>
              </Popup>
            )}
          </Marker>
        )}

        {/* 사용자 현재 위치 마커 */}
        {userLocation && (
          <Marker position={userLocation} icon={createUserLocationIcon()} />
        )}

        {/* 동적 통합 클러스터 렌더링 */}
        {getDynamicClusters().map((cluster) => (
          <Marker
            key={cluster.id}
            position={[cluster.latitude, cluster.longitude]}
            icon={createClusterIcon(cluster.scamCount, cluster.name)}
            eventHandlers={{
              click: () => handleDynamicClusterClick(cluster),
            }}
          />
        ))}
      </MapContainer>

      {/* 현재 위치 이동 플로팅 버튼 */}
      <button
        onClick={handleLocateUser}
        className="absolute top-[10px] left-[10px] z-[1000] w-[34px] h-[34px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[4px] shadow flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 active:scale-95 cursor-pointer transition-all duration-200"
        title="현재 위치로 이동"
      >
        <Locate className="w-4.5 h-4.5" />
      </button>
    </div>
  );
}
