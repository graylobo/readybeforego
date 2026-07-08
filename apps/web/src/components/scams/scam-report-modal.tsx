"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useScamMapStore } from "@/lib/stores/scam-map.store";
import { scamsApi } from "@/lib/api/scams";
import { uploadsApi } from "@/lib/api/uploads";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PlusCircle, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ScamReportModal() {
  const queryClient = useQueryClient();
  const {
    selectedCountryCode,
    selectedCityId,
    reportCoords,
    isReportModalOpen,
    setReportModalOpen,
    setReportCoords,
    setIsReportMode,
    setSelectedRegionId,
    setMapCenter,
    setMapZoom,
  } = useScamMapStore();

  const [countryCode, setCountryCode] = useState("");
  const [cityId, setCityId] = useState("");
  const [regionName, setRegionName] = useState("");
  const [scamCategory, setScamCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [avoidanceTip, setAvoidanceTip] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  // 이미지 첨부 관련 상태
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isReportModalOpen) {
      setCountryCode(selectedCountryCode || "");
      setCityId(selectedCityId || "");
      setRegionName("");
      setScamCategory("");
      setTitle("");
      setDescription("");
      setAvoidanceTip("");
      setSourceUrl("");
      setImageFiles([]);
      setImagePreviews([]);
      setUploading(false);
    }
  }, [isReportModalOpen, selectedCountryCode, selectedCityId]);

  useEffect(() => {
    // 메모리 누수 방지를 위한 Cleanup
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  const { data: countries = [] } = useQuery({
    queryKey: ["countries"],
    queryFn: () => scamsApi.getCountries(),
    enabled: isReportModalOpen,
  });

  const { data: cities = [], isPending: isCitiesPending } = useQuery({
    queryKey: ["cities", countryCode],
    queryFn: () => scamsApi.getCities(countryCode),
    enabled: isReportModalOpen && !!countryCode,
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof scamsApi.createScam>[0]) => scamsApi.createScam(data),
    onSuccess: (newScam) => {
      toast.success("사기 제보가 성공적으로 등록되었습니다!");
      
      queryClient.invalidateQueries({ queryKey: ["scam-regions"] });
      if (cityId) {
        queryClient.invalidateQueries({ queryKey: ["regions", cityId] });
      }

      setReportModalOpen(false);
      setReportCoords(null);
      setIsReportMode(false);
      setImageFiles([]);
      setImagePreviews([]);
      setUploading(false);

      if (newScam.regionId) {
        setSelectedRegionId(newScam.regionId);
        if (reportCoords) {
          setMapCenter(reportCoords);
          setMapZoom(15);
        }
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || "제보 등록에 실패했습니다.";
      toast.error(msg);
      setUploading(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      
      if (imageFiles.length + selectedFiles.length > 5) {
        toast.error("이미지는 최대 5장까지 첨부할 수 있습니다.");
        return;
      }

      setImageFiles((prev) => [...prev, ...selectedFiles]);
      const newPreviews = selectedFiles.map((file) => URL.createObjectURL(file));
      setImagePreviews((prev) => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(imagePreviews[index]);
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityId) {
      toast.error("도시를 선택해 주세요.");
      return;
    }
    if (!regionName.trim()) {
      toast.error("세부 장소/지역명을 입력해 주세요.");
      return;
    }
    if (!scamCategory) {
      toast.error("사기 카테고리를 선택해 주세요.");
      return;
    }
    if (!title.trim() || !description.trim()) {
      toast.error("제목과 상세 내용은 필수입니다.");
      return;
    }
    if (!reportCoords) {
      toast.error("지도에서 좌표를 획득하지 못했습니다.");
      return;
    }

    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of imageFiles) {
        const url = await uploadsApi.uploadImage(file, { compress: true, folder: "scams" });
        urls.push(url);
      }

      createMutation.mutate({
        cityId,
        regionName: regionName.trim(),
        latitude: reportCoords[0],
        longitude: reportCoords[1],
        scamCategory,
        title: title.trim(),
        description: description.trim(),
        avoidanceTip: avoidanceTip.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        imageUrls: urls,
      });
    } catch (error) {
      toast.error("이미지 업로드 중 오류가 발생했습니다.");
      setUploading(false);
    }
  };

  const handleClose = () => {
    setReportModalOpen(false);
    setReportCoords(null);
  };

  return (
    <Dialog open={isReportModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[550px] p-6 rounded-2xl bg-card max-h-[95vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-red-600" />
            실시간 사기/위험 제보하기
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            지도에서 선택하신 좌표 ({reportCoords?.[0].toFixed(5)}, {reportCoords?.[1].toFixed(5)}) 에 새로운 위험 장소 정보와 피해 사례를 제보합니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">국가</Label>
              <Select value={countryCode} onValueChange={(val) => { setCountryCode(val); setCityId(""); }} disabled={uploading}>
                <SelectTrigger className="w-full text-xs cursor-pointer">
                  <SelectValue placeholder="국가 선택" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="cursor-pointer">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">도시</Label>
              <Select 
                value={cityId} 
                onValueChange={setCityId}
                disabled={!countryCode || isCitiesPending || uploading}
              >
                <SelectTrigger className="w-full text-xs cursor-pointer">
                  <SelectValue placeholder="도시 선택" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id} className="cursor-pointer">
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="regionName" className="text-xs font-bold text-slate-700 dark:text-slate-300">세부 장소/지역명</Label>
            <Input
              id="regionName"
              placeholder="예: 카오산로드 스타벅스 맞은편 노점"
              value={regionName}
              onChange={(e) => setRegionName(e.target.value)}
              className="text-xs"
              required
              disabled={uploading}
            />
            <p className="text-[10px] text-muted-foreground">지도에 핀 마커의 이름으로 등록되며 다른 제보들과 공유됩니다.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">사기 유형 카테고리</Label>
            <Select value={scamCategory} onValueChange={setScamCategory} disabled={uploading}>
              <SelectTrigger className="w-full text-xs cursor-pointer">
                <SelectValue placeholder="카테고리 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FORCED_SHOPPING" className="cursor-pointer">🛍️ 호객 행위 및 구매 강요</SelectItem>
                <SelectItem value="DRUG_HAZARD" className="cursor-pointer">💊 마약 및 유해물질 위험</SelectItem>
                <SelectItem value="LIES_TOURISM" className="cursor-pointer">🗣️ 가짜 정보/사칭 사기</SelectItem>
                <SelectItem value="FAKE_TAXI" className="cursor-pointer">🚕 가짜 택시/바가지 요금</SelectItem>
                <SelectItem value="OVERCHARGING" className="cursor-pointer">💸 바가지 및 과다 청구</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 이미지 업로드 컨트롤 추가 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">증거 사진 첨부 (영수증, 간판, 현장 등 - 최대 5장)</Label>
            <div className="flex flex-wrap gap-2 items-center pt-1">
              
              {imagePreviews.length < 5 && (
                <label className="w-16 h-16 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 hover:border-slate-400 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 gap-1 text-[10px] text-muted-foreground">
                  <ImageIcon className="w-4 h-4 text-slate-500" />
                  사진 추가
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                </label>
              )}

              {imagePreviews.map((url, index) => (
                <div key={index} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border group">
                  <img src={url} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 w-4.5 h-4.5 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    disabled={uploading}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-border my-4" />

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-bold text-slate-700 dark:text-slate-300">제보 제목</Label>
              <Input
                id="title"
                placeholder="예: 툭툭 10바트 투어 사기"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xs"
                required
                disabled={uploading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-bold text-slate-700 dark:text-slate-300">상세 피해 내용</Label>
              <Textarea
                id="description"
                placeholder="구체적으로 어떤 상황에서 호객을 당했는지, 피해 금액과 장소 특성 등을 자세히 설명해 주세요. (최소 10자)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs min-h-[90px] resize-none"
                required
                disabled={uploading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="avoidanceTip" className="text-xs font-bold text-slate-700 dark:text-slate-300">대처 및 예방법 (선택)</Label>
              <Textarea
                id="avoidanceTip"
                placeholder="다른 여행자들에게 도움이 될 만한 거절 요령, 대체 교통수단 팁 등을 적어주세요."
                value={avoidanceTip}
                onChange={(e) => setAvoidanceTip(e.target.value)}
                className="text-xs min-h-[70px] resize-none"
                disabled={uploading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sourceUrl" className="text-xs font-bold text-slate-700 dark:text-slate-300">관련 참고 출처 링크 (선택)</Label>
              <Input
                id="sourceUrl"
                placeholder="예: https://..."
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="text-xs"
                disabled={uploading}
              />
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2 sm:gap-0 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={handleClose} className="cursor-pointer" disabled={uploading}>
              취소
            </Button>
            <Button 
              type="submit" 
              size="sm" 
              className="bg-red-600 hover:bg-red-700 text-white cursor-pointer ml-0 sm:ml-2"
              disabled={createMutation.isPending || uploading}
            >
              {uploading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  사진 전송 중...
                </span>
              ) : createMutation.isPending ? (
                "제보 등록 중..."
              ) : (
                "제보 완료"
              )}
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}
