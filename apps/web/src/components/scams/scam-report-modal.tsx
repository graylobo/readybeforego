"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useScamMapStore } from "@/lib/stores/scam-map.store";
import { useTranslation } from "@/hooks/use-translation";
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
  const { t } = useTranslation();
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
      toast.success(t("report_modal.submit") + " " + "성공");
      
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
      const msg = err.response?.data?.message || "Error";
      toast.error(msg);
      setUploading(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      
      if (imageFiles.length + selectedFiles.length > 5) {
        toast.error(t("report_modal.attachments_label"));
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
      toast.error(t("report_modal.city_select"));
      return;
    }
    if (!regionName.trim()) {
      toast.error(t("report_modal.place_name_placeholder"));
      return;
    }
    if (!scamCategory) {
      toast.error(t("report_modal.category_select"));
      return;
    }
    if (!title.trim() || !description.trim()) {
      toast.error("Required fields empty.");
      return;
    }
    if (!reportCoords) {
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
      toast.error("Upload Error");
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
            {t("report_modal.title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            {t("report_modal.desc", {
              lat: reportCoords?.[0].toFixed(5) || 0,
              lng: reportCoords?.[1].toFixed(5) || 0,
            })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("report_modal.country")}</Label>
              <Select value={countryCode} onValueChange={(val) => { setCountryCode(val); setCityId(""); }} disabled={uploading}>
                <SelectTrigger className="w-full text-xs cursor-pointer">
                  <SelectValue placeholder={t("report_modal.country_select")} />
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
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("report_modal.city")}</Label>
              <Select 
                value={cityId} 
                onValueChange={setCityId}
                disabled={!countryCode || isCitiesPending || uploading}
              >
                <SelectTrigger className="w-full text-xs cursor-pointer">
                  <SelectValue placeholder={t("report_modal.city_select")} />
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
            <Label htmlFor="regionName" className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("report_modal.place_name")}</Label>
            <Input
              id="regionName"
              placeholder={t("report_modal.place_name_placeholder")}
              value={regionName}
              onChange={(e) => setRegionName(e.target.value)}
              className="text-xs"
              required
              disabled={uploading}
            />
            <p className="text-[10px] text-muted-foreground">{t("report_modal.place_name_desc")}</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("report_modal.category")}</Label>
            <Select value={scamCategory} onValueChange={setScamCategory} disabled={uploading}>
              <SelectTrigger className="w-full text-xs cursor-pointer">
                <SelectValue placeholder={t("report_modal.category_select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FORCED_SHOPPING" className="cursor-pointer">{t("categories.FORCED_SHOPPING")}</SelectItem>
                <SelectItem value="DRUG_HAZARD" className="cursor-pointer">{t("categories.DRUG_HAZARD")}</SelectItem>
                <SelectItem value="LIES_TOURISM" className="cursor-pointer">{t("categories.LIES_TOURISM")}</SelectItem>
                <SelectItem value="FAKE_TAXI" className="cursor-pointer">{t("categories.FAKE_TAXI")}</SelectItem>
                <SelectItem value="OVERCHARGING" className="cursor-pointer">{t("categories.OVERCHARGING")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("report_modal.attachments_label")}</Label>
            <div className="flex flex-wrap gap-2 items-center pt-1">
              
              {imagePreviews.length < 5 && (
                <label className="w-16 h-16 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 hover:border-slate-400 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 gap-1 text-[10px] text-muted-foreground">
                  <ImageIcon className="w-4 h-4 text-slate-500" />
                  {t("report_modal.add_photo")}
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
              <Label htmlFor="title" className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("report_modal.title_label")}</Label>
              <Input
                id="title"
                placeholder={t("report_modal.title_placeholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xs"
                required
                disabled={uploading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("report_modal.desc_label")}</Label>
              <Textarea
                id="description"
                placeholder={t("report_modal.desc_placeholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs min-h-[90px] resize-none"
                required
                disabled={uploading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="avoidanceTip" className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("report_modal.avoidance_label")}</Label>
              <Textarea
                id="avoidanceTip"
                placeholder={t("report_modal.avoidance_placeholder")}
                value={avoidanceTip}
                onChange={(e) => setAvoidanceTip(e.target.value)}
                className="text-xs min-h-[70px] resize-none"
                disabled={uploading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sourceUrl" className="text-xs font-bold text-slate-700 dark:text-slate-300">{t("report_modal.source_label")}</Label>
              <Input
                id="sourceUrl"
                placeholder={t("report_modal.source_placeholder")}
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="text-xs"
                disabled={uploading}
              />
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2 sm:gap-0 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={handleClose} className="cursor-pointer" disabled={uploading}>
              {t("report_modal.cancel")}
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
                  {t("report_modal.uploading_images")}
                </span>
              ) : createMutation.isPending ? (
                t("report_modal.submitting")
              ) : (
                t("report_modal.submit")
              )}
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}
