import { create } from "zustand";
import { Region } from "../api/scams";

interface ScamMapStore {
  selectedCountryCode: string | null;
  selectedCityId: string | null;
  selectedRegionId: string | null;
  selectedRegion: Region | null;
  mapCenter: [number, number];
  mapZoom: number;
  // 제보 모드 상태 추가
  isReportMode: boolean;
  reportCoords: [number, number] | null;
  isReportModalOpen: boolean;
  setSelectedCountryCode: (code: string | null) => void;
  setSelectedCityId: (id: string | null) => void;
  setSelectedRegionId: (id: string | null) => void;
  setSelectedRegion: (region: Region | null) => void;
  setMapCenter: (center: [number, number]) => void;
  setMapZoom: (zoom: number) => void;
  setIsReportMode: (val: boolean) => void;
  setReportCoords: (coords: [number, number] | null) => void;
  setReportModalOpen: (val: boolean) => void;
  resetSelections: () => void;
}

export const useScamMapStore = create<ScamMapStore>((set) => ({
  selectedCountryCode: null,
  selectedCityId: null,
  selectedRegionId: null,
  selectedRegion: null,
  mapCenter: [13.7563, 100.5018], // Default to Bangkok coords
  mapZoom: 5,
  isReportMode: false,
  reportCoords: null,
  isReportModalOpen: false,
  setSelectedCountryCode: (code) => set({ selectedCountryCode: code }),
  setSelectedCityId: (id) => set({ selectedCityId: id }),
  setSelectedRegionId: (id) => set({ selectedRegionId: id }),
  setSelectedRegion: (region) => set({ selectedRegion: region }),
  setMapCenter: (center) => set({ mapCenter: center }),
  setMapZoom: (zoom) => set({ mapZoom: zoom }),
  setIsReportMode: (val) => set({ isReportMode: val }),
  setReportCoords: (coords) => set({ reportCoords: coords }),
  setReportModalOpen: (val) => set({ isReportModalOpen: val }),
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
  }),
}));
