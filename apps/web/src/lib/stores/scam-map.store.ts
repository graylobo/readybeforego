import { create } from "zustand";
import { Region } from "../api/scams";

interface ScamMapStore {
  selectedCountryCode: string | null;
  selectedCityId: string | null;
  selectedRegionId: string | null;
  selectedRegion: Region | null;
  mapCenter: [number, number];
  mapZoom: number;
  setSelectedCountryCode: (code: string | null) => void;
  setSelectedCityId: (id: string | null) => void;
  setSelectedRegionId: (id: string | null) => void;
  setSelectedRegion: (region: Region | null) => void;
  setMapCenter: (center: [number, number]) => void;
  setMapZoom: (zoom: number) => void;
  resetSelections: () => void;
}

export const useScamMapStore = create<ScamMapStore>((set) => ({
  selectedCountryCode: null,
  selectedCityId: null,
  selectedRegionId: null,
  selectedRegion: null,
  mapCenter: [13.7563, 100.5018], // Default to Bangkok coords
  mapZoom: 5,
  setSelectedCountryCode: (code) => set({ selectedCountryCode: code }),
  setSelectedCityId: (id) => set({ selectedCityId: id }),
  setSelectedRegionId: (id) => set({ selectedRegionId: id }),
  setSelectedRegion: (region) => set({ selectedRegion: region }),
  setMapCenter: (center) => set({ mapCenter: center }),
  setMapZoom: (zoom) => set({ mapZoom: zoom }),
  resetSelections: () => set({
    selectedCountryCode: null,
    selectedCityId: null,
    selectedRegionId: null,
    selectedRegion: null,
    mapCenter: [13.7563, 100.5018],
    mapZoom: 5,
  }),
}));
