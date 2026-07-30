"use client";

import { useState, useMemo, useCallback } from "react";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  BookOpen, 
  RefreshCw,
  Globe
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import "ag-grid-community/styles/ag-theme-alpine.css";

// AG Grid v35 모듈 등록
ModuleRegistry.registerModules([AllCommunityModule]);

const COUNTRIES = [
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

  const [selectedCountry, setSelectedCountry] = useState<string>("JP");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // 모달 상태
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
    queryFn: () => guidesApi.getGuidesByCountry(selectedCountry),
    enabled: !!selectedCountry,
  });

  const guides = guideData?.guides || [];

  // 생성 Mutation
  const createMutation = useMutation({
    mutationFn: (dto: any) => guidesApi.createGuide(dto),
    onSuccess: () => {
      toast.success("가이드 항목이 생성되었습니다.");
      queryClient.invalidateQueries({ queryKey: ['admin-guides', selectedCountry] });
      queryClient.invalidateQueries({ queryKey: ['guides', 'country', selectedCountry] });
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
      queryClient.invalidateQueries({ queryKey: ['admin-guides', selectedCountry] });
      queryClient.invalidateQueries({ queryKey: ['guides', 'country', selectedCountry] });
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
      queryClient.invalidateQueries({ queryKey: ['admin-guides', selectedCountry] });
      queryClient.invalidateQueries({ queryKey: ['guides', 'country', selectedCountry] });
    },
    onError: () => {
      toast.error("가이드 항목 삭제에 실패했습니다.");
    },
  });

  // 모달 열기 (신규)
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormData({
      countryCode: selectedCountry,
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
    <div className="space-y-6">
      {/* AG Grid v35 공식 CSS 변수 주입 방식 (레이아웃 보존 + 배경/컬러만 다크 세팅) */}
      <style jsx global>{`
        .ag-theme-dark-mode {
          --ag-background-color: #090d16;
          --ag-header-background-color: #111c38;
          --ag-odd-row-background-color: #090d16;
          --ag-even-row-background-color: #0e162b;
          --ag-row-border-color: #1e293b;
          --ag-header-foreground-color: #f8fafc;
          --ag-foreground-color: #f1f5f9;
          --ag-secondary-foreground-color: #94a3b8;
          --ag-selected-row-background-color: #1e293b;
          --ag-row-hover-color: #1e293b;
          --ag-control-panel-background-color: #111c38;
          --ag-border-color: #1e293b;
          --ag-input-focus-border-color: #3b82f6;
          --ag-data-color: #f1f5f9;
          --ag-wrapper-border-radius: 0;
          --ag-modal-overlay-background-color: rgba(0, 0, 0, 0.5);
          --ag-chrome-background-color: #090d16;
          --ag-subheader-background-color: #090d16;
        }

        /* AG Grid 내부 DOM 요소에 직접 배경색 적용 (alpine 테마 기본값 오버라이드) */
        .ag-theme-dark-mode .ag-root-wrapper {
          background-color: #090d16 !important;
          border-color: #1e293b !important;
        }

        .ag-theme-dark-mode .ag-body-viewport,
        .ag-theme-dark-mode .ag-body,
        .ag-theme-dark-mode .ag-center-cols-viewport,
        .ag-theme-dark-mode .ag-center-cols-container {
          background-color: #090d16 !important;
        }

        .ag-theme-dark-mode .ag-header {
          background-color: #111c38 !important;
          border-bottom-color: #1e293b !important;
        }

        .ag-theme-dark-mode .ag-header-cell {
          color: #f8fafc !important;
        }

        .ag-theme-dark-mode .ag-paging-panel {
          background-color: #090d16 !important;
          border-top-color: #1e293b !important;
          color: #94a3b8 !important;
        }

        .ag-theme-dark-mode .ag-paging-button {
          color: #94a3b8 !important;
        }

        .ag-theme-dark-mode .ag-paging-page-size .ag-picker-field-wrapper {
          background-color: #1e293b !important;
          border-color: #334155 !important;
        }

        .ag-theme-dark-mode .ag-overlay-no-rows-wrapper,
        .ag-theme-dark-mode .ag-overlay-loading-wrapper {
          background-color: #090d16 !important;
          color: #94a3b8 !important;
        }

        .ag-theme-dark-mode .ag-pinned-right-cols-container,
        .ag-theme-dark-mode .ag-pinned-left-cols-container {
          background-color: #090d16 !important;
        }

        .ag-theme-dark-mode .ag-row {
          color: #f1f5f9 !important;
        }

        .ag-theme-dark-mode .ag-row-odd {
          background-color: #090d16 !important;
        }

        .ag-theme-dark-mode .ag-row-even {
          background-color: #0e162b !important;
        }

        .ag-theme-dark-mode .ag-row:hover {
          background-color: #1e293b !important;
        }

        .ag-theme-dark-mode select {
          background-color: #1e293b;
          color: #f1f5f9;
          border-color: #334155;
          border-radius: 6px;
          padding: 2px 6px;
        }
      `}</style>

      {/* 🌟 헤더 배너 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl shadow-lg">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-400" />
            <span>국가별 여행 가이드 & 준비물 관리 (AG Grid)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            고성능 AG Grid 데이터 테이블을 통해 국가별 체크리스트와 가이드 항목을 실시간 관리합니다.
          </p>
        </div>

        <Button
          onClick={handleOpenCreateModal}
          className="bg-blue-600 hover:bg-blue-500 font-bold text-xs sm:text-sm gap-1.5 rounded-xl self-start sm:self-center cursor-pointer shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>신규 가이드 항목 추가</span>
        </Button>
      </div>

      {/* 🎛️ 필터 및 검색 컨트롤 */}
      <Card className="border-slate-200/80 dark:border-slate-800">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* 국가 셀렉터 */}
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-400" />
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger className="w-36 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  <SelectValue placeholder="국가 선택" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-white border-slate-800">
                  {COUNTRIES.map(c => (
                    <SelectItem key={c.code} value={c.code} className="cursor-pointer hover:bg-slate-800 font-semibold">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 카테고리 필터 */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-36 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <SelectValue placeholder="카테고리 전체" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 text-white border-slate-800">
                <SelectItem value="all" className="cursor-pointer hover:bg-slate-800">전체 카테고리</SelectItem>
                <SelectItem value="pre_travel" className="cursor-pointer hover:bg-slate-800">🛫 사전 준비</SelectItem>
                <SelectItem value="essentials" className="cursor-pointer hover:bg-slate-800">🎒 필수 준비물</SelectItem>
                <SelectItem value="baggage" className="cursor-pointer hover:bg-slate-800">✈️ 수하물 규정</SelectItem>
                <SelectItem value="tips" className="cursor-pointer hover:bg-slate-800">💡 현지 팁</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* AG Grid 빠른 검색창 */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="테이블 실시간 필터 검색..."
              className="pl-9 text-xs rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          </div>
        </CardContent>
      </Card>

      {/* 📊 AG Grid 테이블 카드 */}
      <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <span>가이드 데이터 목록 ({rowData.length}개)</span>
          </CardTitle>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => refetch()} 
            className="h-7 px-2 text-xs text-slate-500 hover:text-blue-600 gap-1 rounded-md cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>새로고침</span>
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {/* AG Grid 35 CSS 변수 방식: ag-theme-alpine + ag-theme-dark-mode */}
          <div className={`ag-theme-alpine ${isDark ? "ag-theme-dark-mode" : ""} w-full h-[540px]`}>
            <AgGridReact<CountryGuideItem>
              rowData={rowData}
              columnDefs={columnDefs}
              quickFilterText={searchTerm}
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
    </div>
  );
}
