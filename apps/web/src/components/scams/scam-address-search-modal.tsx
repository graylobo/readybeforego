"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useScamMapStore } from "@/lib/stores/scam-map.store";
import { scamsApi } from "@/lib/api/scams";
import { Search, MapPin, Loader2, Compass } from "lucide-react";
import { toast } from "sonner";

export default function AddressSearchModal() {
  const {
    isAddressSearchModalOpen,
    setAddressSearchModalOpen,
    setReportCoords,
    setMapCenter,
    setMapZoom,
    setGeoData,
    setReportConfirmModalOpen,
  } = useScamMapStore();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) {
      toast.error("검색할 주소나 장소명을 입력해 주세요.");
      return;
    }

    setIsSearching(true);
    try {
      const data = await scamsApi.searchAddress(query);
      setResults(data || []);
      if (!data || data.length === 0) {
        toast.info("검색 결과가 없습니다. 지명을 구체적으로 적어보세요 (예: 도쿄 타워, 서울 명동).");
      }
    } catch (err) {
      console.error("Address search error:", err);
      toast.error("주소 검색 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (item: any) => {
    if (!item.lat || !item.lon) {
      toast.error("선택한 주소의 좌표 정보가 유효하지 않습니다.");
      return;
    }

    const lat = Number(item.lat);
    const lng = Number(item.lon);

    // 1. 임시 핀 좌표 세팅
    setReportCoords([lat, lng]);

    // 2. 지도 포커싱 이동
    setMapCenter([lat, lng]);
    setMapZoom(17);

    // 3. 지오데이터 캐싱 및 제보 등록 여부 확인 팝업 기동
    setGeoData(item);
    setAddressSearchModalOpen(false);
    setReportConfirmModalOpen(true);

    toast.success("🗺️ 주소가 성공적으로 매칭되었습니다!");
    
    // 상태 초기화
    setQuery("");
    setResults([]);
  };

  const handleClose = () => {
    setAddressSearchModalOpen(false);
    setQuery("");
    setResults([]);
    setReportCoords(null);
  };

  return (
    <Dialog open={isAddressSearchModalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="w-[92%] sm:max-w-lg p-6 gap-5 rounded-2xl border border-border shadow-2xl bg-card overflow-hidden">
        <DialogHeader className="flex flex-col gap-1.5 min-w-0 w-full">
          <DialogTitle className="text-base font-extrabold text-foreground flex items-center gap-1.5 truncate">
            <Compass className="w-5 h-5 text-blue-600 animate-spin-slow" />
            직접 위치 주소 검색
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-medium leading-normal">
            가짜 위치 방지를 위해 실제 존재하는 건물명이나 도로명 주소로 검색해 주세요. (예: 방콕 시암파라곤, 도쿄 우에노 공원)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSearch} className="space-y-4 w-full min-w-0 overflow-hidden">
          <div className="space-y-1.5 w-full">
            <Label htmlFor="search-query" className="text-xs font-bold text-muted-foreground">
              주소 또는 장소명 검색
            </Label>
            <div className="flex gap-2 w-full min-w-0">
              <div className="relative flex-1 min-w-0">
                <Input
                  id="search-query"
                  placeholder="예: 서울 강남역, 방콕 카오산로드"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-8 text-xs h-9.5 w-full transition-all focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-blue-600 dark:focus-visible:border-blue-500"
                  disabled={isSearching}
                  autoComplete="off"
                />
                <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
              <Button 
                type="submit" 
                size="sm" 
                className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-950 text-white cursor-pointer px-4 text-xs font-semibold h-9.5 flex-shrink-0"
                disabled={isSearching}
              >
                {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "검색"}
              </Button>
            </div>
          </div>
        </form>

        <div className="space-y-2 w-full min-w-0 overflow-hidden">
          <Label className="text-xs font-bold text-muted-foreground">주소 검색 결과</Label>
          <div className="border border-border rounded-xl overflow-hidden bg-muted/40 w-full">
            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 w-full">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <p className="text-[11px] text-muted-foreground font-semibold">전 세계 주소를 탐색하고 있습니다...</p>
              </div>
            ) : results.length > 0 ? (
              <div className="max-h-[200px] overflow-y-auto divide-y divide-border w-full min-w-0">
                {results.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelect(item)}
                    type="button"
                    className="w-full text-left p-3 hover:bg-muted/80 cursor-pointer flex items-start gap-2.5 transition-all group duration-150 min-w-0 overflow-hidden"
                  >
                    <MapPin className="w-4 h-4 text-muted-foreground group-hover:text-blue-500 mt-0.5 flex-shrink-0 transition-colors" />
                    <div className="space-y-0.5 min-w-0 w-full flex-1 overflow-hidden">
                      <p className="text-xs font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate w-full block">
                        {item.name || item.display_name.split(",")[0]}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-medium truncate leading-normal w-full block">
                        {item.display_name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 w-full">
                <p className="text-[11px] text-muted-foreground font-medium">검색 결과가 없습니다. 지명을 구체적으로 다시 검색해 주세요.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3 w-full flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="text-xs cursor-pointer"
            disabled={isSearching}
          >
            취소
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
