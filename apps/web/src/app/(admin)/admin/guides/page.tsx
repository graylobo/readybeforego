"use client";

import { useState, useMemo, useCallback } from "react";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  BookOpen, 
  RefreshCw,
  Globe,
  FileJson,
  UploadCloud
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { guidesApi, CountryGuideItem } from "@/lib/api/guides";
import { toast } from "sonner";

// AG Grid 커뮤니티 v35 및 스타일
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule, ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

// AG Grid v35 모듈 등록
ModuleRegistry.registerModules([AllCommunityModule]);

const COUNTRIES = [
  { code: "ALL_TOTAL", name: "전체 국가 보기 🌍" },
  { code: "ALL", name: "전체 공통 🌐" },
  { code: "JP", name: "일본 🇯🇵" },
  { code: "TH", name: "태국 🇹🇭" },
  { code: "VN", name: "베트남 🇻🇳" },
  { code: "PH", name: "필리핀 🇵🇭" },
  { code: "US", name: "미국 🇺🇸" },
  { code: "KR", name: "대한민국 🇰🇷" },
];

const CATEGORY_MAP: Record<string, { label: string; badgeClass: string }> = {
  pre_travel: { label: "🛫 사전 준비", badgeClass: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800" },
  essentials: { label: "🎒 필수 준비물", badgeClass: "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800" },
  baggage: { label: "✈️ 수하물 규정", badgeClass: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" },
  tips: { label: "💡 현지 팁", badgeClass: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" },
};

export default function AdminGuidesPage() {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [selectedCountry, setSelectedCountry] = useState<string>("ALL_TOTAL");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // JSON 일괄 등록 모달 상태
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  // JSON 파싱 및 유효성 검사
  const parsedJsonItems = useMemo(() => {
    if (!jsonInput.trim()) return null;
    try {
      const parsed = JSON.parse(jsonInput);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }, [jsonInput]);

  // JSON 일괄 등록 Mutation
  const bulkImportMutation = useMutation({
    mutationFn: (items: any[]) => guidesApi.bulkImportAdminGuides(items),
    onSuccess: (res: any) => {
      toast.success(`${res.count || 0}개의 가이드 항목이 일괄 적재되었습니다! 🎉`);
      setJsonInput('');
      setIsBulkImportModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-guides'] });
    },
    onError: (err: any) => {
      console.error(err);
      toast.error('JSON 일괄 등록 중 오류가 발생했습니다. 포맷을 확인해 주세요.');
    },
  });

  const handleBulkImport = () => {
    if (!parsedJsonItems || parsedJsonItems.length === 0) return;
    bulkImportMutation.mutate(parsedJsonItems);
  };

  // 모달 상태 (신규/수정)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CountryGuideItem | null>(null);

  // 폼 상태
  const [formData, setFormData] = useState<{
    countryCode: string;
    category: 'pre_travel' | 'essentials' | 'baggage' | 'tips';
    title: string;
    description: string;
    icon: string;
    isRequired: boolean;
    isCheckable: boolean;
    sortOrder: number;
  }>({
    countryCode: "JP",
    category: "pre_travel",
    title: "",
    description: "",
    icon: "📌",
    isRequired: false,
    isCheckable: true,
    sortOrder: 1,
  });

  // 해당 국가 가이드 항목 조회
  const { data: guideData, isLoading, refetch } = useQuery({
    queryKey: ['admin-guides', selectedCountry],
    queryFn: () => guidesApi.getGuidesByCountry(selectedCountry, false),
    enabled: !!selectedCountry,
  });

  const guides = guideData?.guides || [];

  // 생성 Mutation
  const createMutation = useMutation({
    mutationFn: (dto: any) => guidesApi.createGuide(dto),
    onSuccess: () => {
      toast.success("가이드 항목이 생성되었습니다.");
      queryClient.invalidateQueries({ queryKey: ['admin-guides'] });
      setIsModalOpen(false);
    },
    onError: () => {
      toast.error("가이드 항목 생성에 실패했습니다.");
    },
  });

  // 수정 Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => guidesApi.updateGuide(id, dto),
    onSuccess: () => {
      toast.success("가이드 항목이 수정되었습니다.");
      queryClient.invalidateQueries({ queryKey: ['admin-guides'] });
      setIsModalOpen(false);
    },
    onError: () => {
      toast.error("가이드 항목 수정에 실패했습니다.");
    },
  });

  // 삭제 Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => guidesApi.deleteGuide(id),
    onSuccess: () => {
      toast.success("가이드 항목이 삭제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ['admin-guides'] });
    },
    onError: () => {
      toast.error("가이드 항목 삭제에 실패했습니다.");
    },
  });

  // 다중 삭제 Mutation
  const deleteBulkMutation = useMutation({
    mutationFn: (ids: string[]) => guidesApi.deleteGuides(ids),
    onSuccess: (res: any) => {
      toast.success(`${res.count || selectedIds.length}개 항목이 삭제되었습니다.`);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['admin-guides'] });
    },
    onError: () => {
      toast.error("항목 삭제 중 오류가 발생했습니다.");
    },
  });

  const handleSelectionChanged = useCallback((event: any) => {
    const selectedNodes = event.api.getSelectedNodes();
    const ids = selectedNodes.map((node: any) => node.data?.id).filter(Boolean);
    setSelectedIds(ids);
  }, []);

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`선택한 ${selectedIds.length}개 항목을 삭제하시겠습니까?`)) {
      deleteBulkMutation.mutate(selectedIds);
    }
  };

  // 모달 열기 (신규)
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      countryCode: selectedCountry === "ALL_TOTAL" || selectedCountry === "ALL" ? "JP" : selectedCountry,
      category: "pre_travel",
      title: "",
      description: "",
      icon: "📌",
      isRequired: false,
      isCheckable: true,
      sortOrder: (guides.length || 0) + 1,
    });
    setIsModalOpen(true);
  };

  // 모달 열기 (수정)
  const handleOpenEditModal = useCallback((item: CountryGuideItem) => {
    setEditingItem(item);
    setFormData({
      countryCode: item.countryCode,
      category: item.category,
      title: item.title,
      description: item.description,
      icon: item.icon || "📌",
      isRequired: item.isRequired,
      isCheckable: item.isCheckable,
      sortOrder: item.sortOrder || 1,
    });
    setIsModalOpen(true);
  }, []);

  // 삭제 핸들러
  const handleDelete = useCallback((id: string, title: string) => {
    if (confirm(`'${title}' 항목을 삭제하시겠습니까?`)) {
      deleteMutation.mutate(id);
    }
  }, [deleteMutation]);

  // 폼 제출
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error("제목과 설명을 입력해 주세요.");
      return;
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, dto: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // AG Grid 필터링 데이터
  const rowData = useMemo(() => {
    return guides.filter(g => selectedCategory === "all" || g.category === selectedCategory);
  }, [guides, selectedCategory]);

  // AG Grid 컬럼 정의 (ColDef)
  const columnDefs: ColDef<CountryGuideItem>[] = useMemo(() => [
    {
      headerCheckboxSelection: true,
      checkboxSelection: true,
      width: 48,
      pinned: "left",
      lockPosition: "left",
      suppressMenu: true,
      resizable: false,
    },
    {
      headerName: "순서",
      field: "sortOrder",
      width: 80,
      sortable: true,
      cellClass: "font-bold text-center text-xs flex items-center justify-center",
    },
    {
      headerName: "아이콘",
      field: "icon",
      width: 80,
      cellRenderer: (params: any) => (
        <span className="text-lg flex justify-center items-center h-full">
          {params.value || "📌"}
        </span>
      ),
    },
    {
      headerName: "카테고리",
      field: "category",
      width: 140,
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => {
        const cat = CATEGORY_MAP[params.value] || { label: params.value, badgeClass: "bg-slate-100 text-slate-600" };
        return (
          <div className="flex items-center h-full">
            <Badge variant="outline" className={`text-[11px] font-bold px-2 py-0.5 ${cat.badgeClass}`}>
              {cat.label}
            </Badge>
          </div>
        );
      },
    },
    {
      headerName: "항목 제목",
      field: "title",
      width: 230,
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => (
        <span className="font-bold text-xs flex items-center h-full truncate">
          {params.value}
        </span>
      ),
    },
    {
      headerName: "상세 설명",
      field: "description",
      flex: 1,
      minWidth: 250,
      filter: true,
      cellRenderer: (params: any) => (
        <span className="text-xs flex items-center h-full truncate" title={params.value}>
          {params.value}
        </span>
      ),
    },
    {
      headerName: "필수 여부",
      field: "isRequired",
      width: 100,
      sortable: true,
      cellRenderer: (params: any) => (
        <div className="flex items-center h-full">
          {params.value ? (
            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800 text-[10px] font-bold">
              필수
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-[10px]">
              일반
            </Badge>
          )}
        </div>
      ),
    },
    {
      headerName: "체크 가능",
      field: "isCheckable",
      width: 110,
      sortable: true,
      cellRenderer: (params: any) => (
        <div className="flex items-center h-full">
          {params.value ? (
            <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 text-[10px]">
              체크가능
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 text-[10px]">
              안내전용
            </Badge>
          )}
        </div>
      ),
    },
    {
      headerName: "관리",
      width: 110,
      pinned: "right",
      cellRenderer: (params: any) => {
        const item = params.data as CountryGuideItem;
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
              onClick={() => handleDelete(item.id, item.title)}
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
      {/* 🌟 상단 타이틀 & 액션 툴바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-500" />
            <span>국가별 여행 가이드 & 준비물 관리</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            국가별 체크리스트와 가이드 항목을 실시간 검색, 수정, 삭제 및 등록 관리합니다.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            variant="outline"
            onClick={() => setIsBulkImportModalOpen(true)}
            className="font-bold text-xs sm:text-sm gap-1.5 rounded-xl cursor-pointer shadow-sm border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
          >
            <FileJson className="w-4 h-4 text-emerald-500" />
            <span>JSON 일괄 등록</span>
          </Button>

          <Button
            onClick={handleOpenCreateModal}
            className="bg-blue-600 hover:bg-blue-500 font-bold text-xs sm:text-sm gap-1.5 rounded-xl cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>신규 가이드 항목 추가</span>
          </Button>
        </div>
      </div>

      {/* 🎛️ 필터 및 검색 컨트롤 툴바 (슬림 컴팩트 바) */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-xl border shadow-sm">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 국가 셀렉터 */}
          <div className="flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
              <SelectTrigger className="w-40 h-9 text-xs font-bold rounded-lg bg-background">
                <SelectValue placeholder="국가 선택" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {COUNTRIES.map(c => (
                  <SelectItem key={c.code} value={c.code} className="cursor-pointer font-semibold text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 카테고리 필터 */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-36 h-9 text-xs font-bold rounded-lg bg-background">
              <SelectValue placeholder="카테고리 전체" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-xs">
              <SelectItem value="all" className="cursor-pointer">전체 카테고리</SelectItem>
              <SelectItem value="pre_travel" className="cursor-pointer">🛫 사전 준비</SelectItem>
              <SelectItem value="essentials" className="cursor-pointer">🎒 필수 준비물</SelectItem>
              <SelectItem value="baggage" className="cursor-pointer">✈️ 수하물 규정</SelectItem>
              <SelectItem value="tips" className="cursor-pointer">💡 현지 팁</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* AG Grid 빠른 검색창 */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="테이블 실시간 필터 검색..."
            className="pl-9 h-9 text-xs rounded-lg bg-background"
          />
        </div>
      </div>

      {/* 📊 AG Grid 테이블 카드 */}
      <Card className="border-border shadow-sm overflow-hidden bg-card">
        <CardHeader className="p-3 sm:px-4 py-3 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <span>가이드 데이터 목록 ({rowData.length}개)</span>
          </CardTitle>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={deleteBulkMutation.isPending}
                className="h-7 px-2.5 text-xs font-bold gap-1 rounded-md cursor-pointer animate-in fade-in"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>선택 삭제 ({selectedIds.length})</span>
              </Button>
            )}

            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => refetch()} 
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 rounded-md cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>새로고침</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* AG Grid 35 CSS 변수 방식: ag-theme-alpine + ag-theme-dark-mode */}
          <div className={`${isDark ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'} w-full h-[540px]`}>
            <AgGridReact<CountryGuideItem>
              theme="legacy"
              rowData={rowData}
              columnDefs={columnDefs}
              quickFilterText={searchTerm}
              rowSelection="multiple"
              onSelectionChanged={handleSelectionChanged}
              pagination={true}
              paginationPageSize={15}
              paginationPageSizeSelector={[10, 15, 25, 50]}
              rowHeight={52}
              headerHeight={44}
              overlayLoadingTemplate={'<span class="ag-overlay-loading-center">데이터를 불러오는 중입니다...</span>'}
              overlayNoRowsTemplate={'<span class="ag-overlay-loading-center">등록된 가이드 항목이 없습니다.</span>'}
            />
          </div>
        </CardContent>
      </Card>

      {/* ✏️ 추가 / 수정 모달 Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md p-6 rounded-2xl">
          <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-base font-bold">
              {editingItem ? "가이드 항목 수정" : "신규 가이드 항목 추가"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                  국가 선택
                </label>
                <Select 
                  value={formData.countryCode} 
                  onValueChange={(val) => setFormData({ ...formData, countryCode: val })}
                >
                  <SelectTrigger className="text-xs font-bold rounded-xl">
                    <SelectValue placeholder="국가 선택" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 text-white border-slate-800">
                    {COUNTRIES.map(c => (
                      <SelectItem key={c.code} value={c.code} className="cursor-pointer hover:bg-slate-800">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                  카테고리
                </label>
                <Select 
                  value={formData.category} 
                  onValueChange={(val: any) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger className="text-xs font-bold rounded-xl">
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 text-white border-slate-800">
                    <SelectItem value="pre_travel" className="cursor-pointer hover:bg-slate-800">🛫 사전 준비</SelectItem>
                    <SelectItem value="essentials" className="cursor-pointer hover:bg-slate-800">🎒 필수 준비물</SelectItem>
                    <SelectItem value="baggage" className="cursor-pointer hover:bg-slate-800">✈️ 수하물 규정</SelectItem>
                    <SelectItem value="tips" className="cursor-pointer hover:bg-slate-800">💡 현지 팁</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                  아이콘
                </label>
                <Input
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="🔌"
                  className="text-center text-sm font-bold rounded-xl"
                />
              </div>

              <div className="col-span-3">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                  항목 제목
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="예: 110V 변환 어댑터 (돼지코)"
                  className="text-xs font-bold rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                상세 설명
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="항목에 대한 구체적인 조언이나 주의사항을 적어주세요."
                rows={3}
                className="text-xs rounded-xl resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.isRequired}
                  onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span>필수 항목 [필수]</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 col-span-2">
                <input
                  type="checkbox"
                  checked={formData.isCheckable}
                  onChange={(e) => setFormData({ ...formData, isCheckable: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span>체크박스 체크 가능</span>
              </label>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                정렬 순서 (숫자가 작을수록 상단)
              </label>
              <Input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="text-xs font-bold rounded-xl">
                취소
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-blue-600 hover:bg-blue-500 font-bold text-xs rounded-xl cursor-pointer"
              >
                {editingItem ? "수정 완료" : "생성하기"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 📦 JSON 일괄 등록 모달 Dialog */}
      <Dialog open={isBulkImportModalOpen} onOpenChange={setIsBulkImportModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FileJson className="w-5 h-5 text-emerald-500" />
              <span>가이드 & 준비물 JSON 데이터 일괄 등록</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              ChatGPT, Claude 등 AI 또는 준비물 목록 JSON 배열(<code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">[&#123;...&#125;]</code>)을 아래에 그대로 붙여넣으세요. 백엔드가 국가, 카테고리, 필수여부 등을 판별하여 즉시 일괄 적재합니다.
            </p>
            
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <Label htmlFor="jsonTextarea">JSON 데이터 입력</Label>
                {parsedJsonItems ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[11px] font-bold">
                    ✓ {parsedJsonItems.length}개 항목 감지됨 (파싱 성공)
                  </Badge>
                ) : jsonInput.trim() ? (
                  <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/20 text-[11px] font-bold">
                    ✕ 올바르지 않은 JSON 포맷
                  </Badge>
                ) : null}
              </div>
              <Textarea
                id="jsonTextarea"
                placeholder={`[
  {
    "countryCode": "JP",
    "category": "pre_travel",
    "title": "Visit Japan Web 사전 등록",
    "description": "입국 수속과 세관 신고를 모바일 QR코드로 사전 작성...",
    "icon": "📲",
    "isRequired": true,
    "isCheckable": true,
    "sortOrder": 1
  }
]`}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="font-mono text-xs h-64 leading-relaxed resize-none rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setIsBulkImportModalOpen(false); setJsonInput(''); }} className="rounded-xl text-xs font-bold">
              취소
            </Button>
            <Button
              onClick={handleBulkImport}
              disabled={!parsedJsonItems || parsedJsonItems.length === 0 || bulkImportMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              {bulkImportMutation.isPending ? '일괄 등록 중...' : `일괄 등록 시작 (${parsedJsonItems?.length ?? 0}개)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
