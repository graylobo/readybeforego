"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useScamMapStore } from "@/lib/stores/scam-map.store";
import { MapPin, Search } from "lucide-react";

export default function GeocodeConfirmModal() {
  const {
    isGeocodeConfirmModalOpen,
    setGeocodeConfirmModalOpen,
    setAddressSearchModalOpen,
    setReportCoords,
  } = useScamMapStore();

  const handleConfirm = () => {
    setGeocodeConfirmModalOpen(false);
    setAddressSearchModalOpen(true);
  };

  const handleCancel = () => {
    setGeocodeConfirmModalOpen(false);
    setReportCoords(null);
  };

  return (
    <Dialog open={isGeocodeConfirmModalOpen} onOpenChange={(open) => { if (!open) handleCancel(); }}>
      <DialogContent className="sm:max-w-md p-6 gap-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl">
        <DialogHeader className="flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 flex items-center justify-center text-amber-500 animate-pulse">
            <MapPin className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-base font-extrabold text-slate-800 dark:text-slate-100">
              위치 자동 감지 불가
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-medium leading-relaxed">
              선택하신 좌표의 상세 지역 정보(국가/도시)를 자동 감지하지 못했습니다. 주소 검색을 통해 직접 위치를 찾아 제보를 진행하시겠습니까?
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogFooter className="flex flex-row justify-center sm:justify-end gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="flex-1 sm:flex-initial text-xs cursor-pointer"
          >
            아니오
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            예, 주소 검색할게요
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
