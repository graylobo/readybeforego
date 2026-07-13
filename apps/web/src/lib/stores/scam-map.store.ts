import { create } from "zustand";
import { Region } from "../api/scams";

interface ScamMapStore {
  selectedCountryCode: string | null;
  selectedCityId: string | null;
  selectedRegionId: string | null;
  selectedRegion: Region | null;
  mapCenter: [number, number];
  mapZoom: number;
  isReportMode: boolean;
  reportCoords: [number, number] | null;
  isReportModalOpen: boolean;
  
  // Raw geocoded payload object from map click
  geoData: any | null;
  
  // UGC Select Type Modal and Type states
  isSelectTypeModalOpen: boolean;
  reportType: "new" | "existing";

  // 모바일 전용 뷰포트 상태 추가
  isMobileFeedOpen: boolean;
  isFilterModalOpen: boolean;
  
  setSelectedCountryCode: (code: string | null) => void;
  setSelectedCityId: (id: string | null) => void;
  setSelectedRegionId: (id: string | null) => void;
  setSelectedRegion: (region: Region | null) => void;
  setMapCenter: (center: [number, number]) => void;
  setMapZoom: (zoom: number) => void;
  setIsReportMode: (val: boolean) => void;
  setReportCoords: (coords: [number, number] | null) => void;
  setReportModalOpen: (val: boolean) => void;
  setGeoData: (data: any) => void;
  setSelectTypeModalOpen: (val: boolean) => void;
  setReportType: (type: "new" | "existing") => void;
  setIsMobileFeedOpen: (val: boolean) => void;
  setIsFilterModalOpen: (val: boolean) => void;
  resetSelections: () => void;
  resetFeedSelections: () => void;
}

export const useScamMapStore = create<ScamMapStore>((set) => ({
  selectedCountryCode: null,
  selectedCityId: null,
  selectedRegionId: null,
  selectedRegion: null,
  mapCenter: [13.7563, 100.5018],
  mapZoom: 5,
  isReportMode: false,
  reportCoords: null,
  isReportModalOpen: false,
  geoData: null,
  isSelectTypeModalOpen: false,
  reportType: "new",
  isMobileFeedOpen: false,
  isFilterModalOpen: false,
  setSelectedCountryCode: (code) => set({ selectedCountryCode: code }),
  setSelectedCityId: (id) => set({ selectedCityId: id }),
  setSelectedRegionId: (id) => set({ selectedRegionId: id }),
  setSelectedRegion: (region) => set({ selectedRegion: region }),
  setMapCenter: (center) => set({ mapCenter: center }),
  setMapZoom: (zoom) => set({ mapZoom: zoom }),
  setIsReportMode: (val) => set({ isReportMode: val }),
  setReportCoords: (coords) => set({ reportCoords: coords }),
  setReportModalOpen: (val) => set({ isReportModalOpen: val }),
  setGeoData: (data) => set({ geoData: data }),
  setSelectTypeModalOpen: (val) => set({ isSelectTypeModalOpen: val }),
  setReportType: (type) => set({ reportType: type }),
  setIsMobileFeedOpen: (val) => set({ isMobileFeedOpen: val }),
  setIsFilterModalOpen: (val) => set({ isFilterModalOpen: val }),
  resetSelections: () => set({
    selectedCountryCode: null,
    selectedCityId: null,
    selectedRegionId: null,
    selectedRegion: null,
    mapCenter: [13.7563, 100.5018],
    mapZoom: 5,
    isReportMode: false,
    reportCoords: null,
    isReportModalOpen: false,
    geoData: null,
    isSelectTypeModalOpen: false,
    reportType: "new",
    isMobileFeedOpen: false,
    isFilterModalOpen: false,
  }),
  resetFeedSelections: () => set({
    selectedCountryCode: null,
    selectedCityId: null,
    selectedRegionId: null,
    selectedRegion: null,
  }),
}));
