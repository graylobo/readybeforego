"use client";

import { useState, useMemo, useCallback } from "react";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Globe, 
  RefreshCw,
  Zap,
  ShieldCheck,
  Coins
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { countriesApi, CountryItem } from "@/lib/api/countries";
import { toast } from "@/lib/toast";

// AG Grid v35
import { AgGridReact } from "ag-grid-react";
import { ColDef, ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

ModuleRegistry.registerModules([AllCommunityModule]);

export default function AdminCountriesPage() {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CountryItem | null>(null);

  const [formData, setFormData] = useState<CountryItem>({
    code: "",
    name: "",
    nameEn: "",
    emoji: "✈️",
    plug: "",
    visa: "",
    currency: "",
    currencyCode: "",
  });

  // 국가 목록 조회
  const { data: countries = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-countries', searchTerm],
    queryFn: () => countriesApi.getAllCountries(searchTerm),
  });

  // 생성 Mutation
  const createMutation = useMutation({
    mutationFn: (dto: Partial<CountryItem>) => countriesApi.createCountry(dto),
    onSuccess: () => {
      toast.success("국가 마스터 데이터가 추가되었습니다. 🎉");
      queryClient.invalidateQueries({ queryKey: ['admin-countries'] });
      queryClient.invalidateQueries({ queryKey: ['guides', 'countries'] });
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "국가 추가에 실패했습니다.");
    },
  });

  // 수정 Mutation
  const updateMutation = useMutation({
    mutationFn: ({ code, dto }: { code: string; dto: Partial<CountryItem> }) =>
      countriesApi.updateCountry(code, dto),
    onSuccess: () => {
      toast.success("국가 정보가 수정되었습니다. ✏️");
      queryClient.invalidateQueries({ queryKey: ['admin-countries'] });
      queryClient.invalidateQueries({ queryKey: ['guides', 'countries'] });
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "국가 정보 수정에 실패했습니다.");
    },
  });

  // 삭제 Mutation
  const deleteMutation = useMutation({
    mutationFn: (code: string) => countriesApi.deleteCountry(code),
    onSuccess: (res: any) => {
      toast.success(res.message || "국가가 삭제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ['admin-countries'] });
      queryClient.invalidateQueries({ queryKey: ['guides', 'countries'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "국가 삭제 실패");
    },
  });

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      code: "",
      name: "",
      nameEn: "",
      emoji: "✈️",
      plug: "220V / 240V",
      visa: "무비자 90일",
      currency: "현지 통화",
      currencyCode: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = useCallback((item: CountryItem) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  }, []);

  const handleDelete = useCallback((code: string, name: string) => {
    if (confirm(`'${name} (${code})' 국가 마스터 데이터를 정말 삭제하시겠습니까?\n관련된 가이드북 데이터의 링크가 영향을 받을 수 있습니다.`)) {
      deleteMutation.mutate(code);
    }
  }, [deleteMutation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("국가 코드와 한국어 명칭은 필수 입력입니다.");
      return;
    }

    const { createdAt, updatedAt, ...purePayload } = formData;

    if (editingItem) {
      updateMutation.mutate({ code: editingItem.code, dto: purePayload });
    } else {
      createMutation.mutate(purePayload);
    }
  };

  const columnDefs: ColDef<CountryItem>[] = useMemo(() => [
    {
      headerName: "이모지",
      field: "emoji",
      width: 90,
      cellRenderer: (params: any) => (
        <span className="text-xl flex justify-center items-center h-full">
          {params.value || "✈️"}
        </span>
      ),
    },
    {
      headerName: "국가 코드",
      field: "code",
      width: 110,
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => (
        <Badge variant="outline" className="font-mono text-xs font-bold bg-slate-100 dark:bg-slate-800">
          {params.value}
        </Badge>
      ),
    },
    {
      headerName: "국가명 (한글)",
      field: "name",
      width: 140,
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => (
        <span className="font-bold text-xs flex items-center h-full">
          {params.value}
        </span>
      ),
    },
    {
      headerName: "국가명 (영문)",
      field: "nameEn",
      width: 150,
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => (
        <span className="text-xs text-muted-foreground flex items-center h-full">
          {params.value}
        </span>
      ),
    },
    {
      headerName: "전압 / 플러그",
      field: "plug",
      width: 150,
      cellRenderer: (params: any) => (
        <span className="text-xs flex items-center h-full text-amber-600 dark:text-amber-400 font-semibold">
          {params.value || "-"}
        </span>
      ),
    },
    {
      headerName: "비자 조건",
      field: "visa",
      width: 150,
      cellRenderer: (params: any) => (
        <span className="text-xs flex items-center h-full text-blue-600 dark:text-blue-400 font-semibold">
          {params.value || "-"}
        </span>
      ),
    },
    {
      headerName: "통화 (ISO)",
      field: "currency",
      flex: 1,
      minWidth: 160,
      cellRenderer: (params: any) => (
        <span className="text-xs flex items-center h-full text-emerald-600 dark:text-emerald-400 font-semibold">
          {params.value ? `${params.value} (${params.data.currencyCode || ''})` : "-"}
        </span>
      ),
    },
    {
      headerName: "관리",
      width: 110,
      pinned: "right",
      cellRenderer: (params: any) => {
        const item = params.data as CountryItem;
        if (!item) return null;
        return (
          <div className="flex items-center gap-1 h-full justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenEditModal(item)}
              className="h-7 w-7 p-0 rounded-md cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800"
              title="수정"
            >
              <Edit className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(item.code, item.name)}
              className="h-7 w-7 p-0 rounded-md cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800"
              title="삭제"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400" />
            </Button>
          </div>
        );
      },
    },
  ], [handleOpenEditModal, handleDelete]);

  return (
    <div className="space-y-4">
      {/* 상단 액션 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="w-6 h-6 text-emerald-500" />
            <span>국가 마스터 데이터 관리 (Countries Master)</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            해외 여행 가이드북 및 호갱노노 서비스에서 참조하는 국가 마스터(이모지, 전압, 비자, 통화)를 직접 등록/수정합니다.
          </p>
        </div>

        <Button
          onClick={handleOpenCreateModal}
          className="bg-emerald-600 hover:bg-emerald-500 font-bold text-xs sm:text-sm gap-1.5 rounded-xl cursor-pointer shadow-sm self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>신규 국가 마스터 등록</span>
        </Button>
      </div>

      {/* 검색 및 필터 */}
      <div className="shrink-0 flex items-center justify-between gap-3 bg-card p-3 rounded-xl border shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="국가코드, 한글명, 영문명 검색..."
            className="pl-9 h-9 text-xs rounded-lg bg-background"
          />
        </div>

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => refetch()} 
          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-md cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>새로고침</span>
        </Button>
      </div>

      {/* AG Grid 테이블 카드 */}
      <Card className="border-border shadow-sm overflow-hidden bg-card">
        <CardHeader className="p-3 sm:px-4 py-3 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <span>국가 마스터 데이터 목록 ({countries.length}개)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className={`w-full h-[550px] ${isDark ? "ag-theme-alpine-dark" : "ag-theme-alpine"}`}>
            <AgGridReact
              theme="legacy"
              rowData={countries}
              columnDefs={columnDefs}
              defaultColDef={{
                resizable: true,
                sortable: true,
              }}
              rowHeight={46}
              headerHeight={40}
              overlayLoadingTemplate={`<span class="ag-overlay-loading-center text-xs">국가 데이터를 불러오는 중...</span>`}
              overlayNoRowsTemplate={`<span class="ag-overlay-loading-center text-xs">등록된 국가 마스터가 없습니다.</span>`}
            />
          </div>
        </CardContent>
      </Card>

      {/* 등록/수정 모달 */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Globe className="w-5 h-5" />
              <span>{editingItem ? "국가 마스터 정보 수정" : "신규 국가 마스터 등록"}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3.5 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold mb-1 block">국가 코드 (ISO 2자) *</Label>
                <Input
                  disabled={!!editingItem}
                  placeholder="예: SG, TW, ES"
                  value={formData.code}
                  onChange={(e) => {
                    const newCode = e.target.value.toUpperCase();
                    let autoEmoji = formData.emoji;
                    if (newCode.length === 2) {
                      try {
                        autoEmoji = String.fromCodePoint(...[...newCode].map(c => 127397 + c.charCodeAt(0)));
                      } catch {
                        // ignore
                      }
                    }
                    setFormData({ ...formData, code: newCode, emoji: autoEmoji });
                  }}
                  className="font-mono text-xs rounded-xl"
                  maxLength={5}
                />
              </div>
              <div>
                <Label className="text-xs font-bold mb-1 block">국기 이모지 (자동 채움 지원)</Label>
                <Input
                  placeholder="예: 🇸🇬, 🇹🇼"
                  value={formData.emoji || ""}
                  onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                  className="text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold mb-1 block">국가명 (한글) *</Label>
                <Input
                  placeholder="예: 싱가포르"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="text-xs rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-bold mb-1 block">국가명 (영문)</Label>
                <Input
                  placeholder="예: Singapore"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  className="text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold mb-1 block flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>전압 / 플러그 정보</span>
                </Label>
                <Input
                  placeholder="예: 230V / 멀티 어댑터"
                  value={formData.plug || ""}
                  onChange={(e) => setFormData({ ...formData, plug: e.target.value })}
                  className="text-xs rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-bold mb-1 block flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                  <span>비자 조건</span>
                </Label>
                <Input
                  placeholder="예: 무비자 90일"
                  value={formData.visa || ""}
                  onChange={(e) => setFormData({ ...formData, visa: e.target.value })}
                  className="text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold mb-1 block flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-emerald-500" />
                  <span>통화 명칭</span>
                </Label>
                <Input
                  placeholder="예: 싱가포르 달러 (SGD)"
                  value={formData.currency || ""}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="text-xs rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-bold mb-1 block">통화 코드 (ISO 3자)</Label>
                <Input
                  placeholder="예: SGD, TWD"
                  value={formData.currencyCode || ""}
                  onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value.toUpperCase() })}
                  className="font-mono text-xs rounded-xl"
                  maxLength={5}
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl text-xs font-bold">
                취소
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                {editingItem ? "정보 저장" : "신규 국가 추가"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
