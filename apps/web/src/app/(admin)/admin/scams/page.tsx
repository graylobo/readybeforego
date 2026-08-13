'use client';

import { CommonPagination } from '@/components/common/common-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  useAdminBulkImportScams,
  useAdminCreateScam,
  useAdminDeleteScam,
  useAdminDeleteScamsBulk,
  useAdminRestoreScam,
  useAdminScams,
  useAdminUpdateScam
} from '@/hooks/queries/use-admin-queries';
import { usePaginationLimit } from '@/hooks/use-pagination-limit';
import { scamsApi } from '@/lib/api/scams';
import { cn } from '@/lib/utils/cn';
import {
  CATEGORY_MAP,
  OTHER_CATEGORY,
  OTHER_NOTE_MIN_LENGTH,
  hasOtherCategory,
  parseCategories,
  toggleCategorySelection,
} from '@/lib/constants/scam-categories';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AlertTriangle, Edit, FileJson, Plus, RotateCcw, Search, ThumbsDown, ThumbsUp, Trash2, UploadCloud } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useMemo, useState } from 'react';
import { toast } from '@/lib/toast';

import {
  AllCommunityModule,
  ColDef,
  ModuleRegistry,
  RowSelectionModule
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

// Register AG Grid modules
ModuleRegistry.registerModules([
  AllCommunityModule,
  RowSelectionModule
]);

// Scope Badge Renderer
const ScopeRenderer = (params: any) => {
  const scope = params.data.scope;
  switch (scope) {
    case 'spot':
      return <Badge variant="outline" className="border-0 bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-xs font-medium">📍 특정 위치</Badge>;
    case 'region':
      return <Badge variant="outline" className="border-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-xs font-medium">🗺️ 구역 전체</Badge>;
    case 'city':
      return <Badge variant="outline" className="border-0 bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-xs font-medium">🏙️ 도시 전체</Badge>;
    case 'country':
      return <Badge variant="outline" className="border-0 bg-purple-500/15 text-purple-600 dark:text-purple-400 px-2 py-0.5 text-xs font-medium">🇹🇭 국가 전체</Badge>;
    default:
      return <Badge variant="secondary" className="border-0 px-2 py-0.5 text-xs">{scope}</Badge>;
  }
};

// Category Badge Renderer
const CategoryRenderer = (params: any) => {
  const categoryStr = params.data.scamCategory || '';
  const note = params.data.otherCategoryNote || '';
  const categories = categoryStr.split(',').filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1 items-center h-full">
      {categories.map((cat: string) => {
        const label = cat === OTHER_CATEGORY && note
          ? `${CATEGORY_MAP[cat]?.label || '📝 기타'} · ${note}`
          : (CATEGORY_MAP[cat]?.label || cat);
        return (
          <span key={cat} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground border-0">
            {label}
          </span>
        );
      })}
    </div>
  );
};

// Action Buttons Renderer
const ActionsRenderer = (params: any) => {
  const { onEdit, onDelete, onRestore } = params.context;
  const isDeleted = !!params.data?.deletedAt;

  if (isDeleted) {
    return (
      <div className="flex items-center gap-1.5 h-full">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          onClick={() => onRestore(params.data)}
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          복구
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 h-full">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs hover:bg-muted"
        onClick={() => onEdit(params.data)}
      >
        <Edit className="w-3.5 h-3.5 mr-1 text-primary" />
        수정
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => onDelete(params.data)}
      >
        <Trash2 className="w-3.5 h-3.5 mr-1" />
        삭제
      </Button>
    </div>
  );
};

export default function AdminScamsPage() {
  const { resolvedTheme } = useTheme();
  const gridThemeClass = resolvedTheme === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz';

  const CATEGORY_OPTIONS = useMemo(() => [
    { value: 'FORCED_SHOPPING', label: '🛍️ 호객/강매' },
    { value: 'OVERCHARGING', label: '💸 바가지 요금' },
    { value: 'FAKE_TAXI', label: '🚕 가짜 택시' },
    { value: 'DRUG_HAZARD', label: '💊 약물 위험' },
    { value: 'LIES_TOURISM', label: '🗣️ 가짜 정보' },
    { value: 'ADVANCE_BOOKING', label: '🎒 사전 예약/패스' },
    { value: 'PHOTO_SPOT', label: '📸 촬영 포인트' },
    { value: 'HIDDEN_GEM', label: '🗺️ 숨은 명소' },
    { value: 'FOOD_RECOMMENDATION', label: '🍜 맛집 추천' },
    { value: 'MONEY_TIP', label: '💰 환전/결제 팁' },
    { value: 'TRANSPORT_TIP', label: '🚆 교통/이동 팁' },
    { value: 'FACILITY_INFO', label: '📦 짐보관/편의시설' },
    { value: OTHER_CATEGORY, label: '📝 기타' },
  ], []);

  const [page, setPage] = usePaginationLimit('admin-scams-page', 1);
  const [limit, setLimit] = usePaginationLimit('admin-scams-limit', 10);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingScam, setEditingScam] = useState<any | null>(null);
  const [deletingScam, setDeletingScam] = useState<any | null>(null);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  const deleteScamsBulkMutation = useAdminDeleteScamsBulk();
  const bulkImportMutation = useAdminBulkImportScams();

  const parsedJsonItems = useMemo(() => {
    if (!jsonInput.trim()) return null;
    try {
      const parsed = JSON.parse(jsonInput);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      return items;
    } catch {
      return null;
    }
  }, [jsonInput]);

  const handleBulkImportScams = async () => {
    if (!parsedJsonItems || parsedJsonItems.length === 0) {
      toast.error('올바른 JSON 포맷 배열 데이터를 입력해 주세요.');
      return;
    }
    try {
      const res = await bulkImportMutation.mutateAsync(parsedJsonItems);
      if (res.skippedCount > 0) {
        toast.success(`신규 제보 ${res.importedCount}개 등록 완료 (중복 제보 ${res.skippedCount}개 제외됨)`);
      } else {
        toast.success(`총 ${res.importedCount}개의 제보 데이터가 성공적으로 일괄 등록되었습니다.`);
      }
      setJsonInput('');
      setIsBulkImportModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'JSON 일괄 등록 처리 중 오류가 발생했습니다.');
    }
  };

  const handleSelectionChanged = (event: any) => {
    const selectedNodes = event.api.getSelectedNodes();
    const selectedData = selectedNodes.map((node: any) => node.data);
    setSelectedRows(selectedData);
  };

  const handleBulkDeleteScams = async () => {
    if (selectedRows.length === 0) return;
    try {
      const ids = selectedRows.map((r) => r.id);
      await deleteScamsBulkMutation.mutateAsync(ids);
      toast.success(`선택한 ${ids.length}개의 제보 데이터가 성공적으로 삭제되었습니다.`);
      setSelectedRows([]);
      setIsBulkDeleteModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || '삭제 중 오류가 발생했습니다.');
    }
  };

  // Form States for Create/Edit
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    avoidanceTip: '',
    scamCategory: 'OVERCHARGING',
    otherCategoryNote: '',
    scope: 'spot',
    countryCode: 'TH',
    cityId: '',
    regionId: '',
    sourceUrl: '',
  });

  const { data: countries } = useQuery({
    queryKey: ['countries'],
    queryFn: () => scamsApi.getCountries(),
  });
  const { data: cities } = useQuery({
    queryKey: ['cities', formData.countryCode],
    queryFn: () => scamsApi.getCities(formData.countryCode),
    enabled: !!formData.countryCode,
  });

  const { data, isLoading } = useAdminScams({
    page,
    limit,
    search: search.trim() || undefined,
    scope: scopeFilter !== 'all' ? scopeFilter : undefined,
    countryCode: countryFilter !== 'all' ? countryFilter : undefined,
    scamCategory: categoryFilter !== 'all' ? categoryFilter : undefined,
  });

  const createScamMutation = useAdminCreateScam();
  const updateScamMutation = useAdminUpdateScam();
  const deleteScamMutation = useAdminDeleteScam();
  const restoreScamMutation = useAdminRestoreScam();

  const handleRestoreScam = async (scam: any) => {
    if (confirm(`'${scam.title}' 제보 항목을 복구하시겠습니까?`)) {
      try {
        await restoreScamMutation.mutateAsync(scam.id);
        toast.success(`'${scam.title}' 사기 제보가 성공적으로 복구되었습니다. 🟢`);
      } catch (err: any) {
        toast.error(err.message || '복구 중 오류가 발생했습니다.');
      }
    }
  };

  const totalItems = data?.total ?? 0;
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalItems / limit));
  }, [totalItems, limit]);

  const toggleCategory = (value: string) => {
    const current = parseCategories(formData.scamCategory);
    const { next } = toggleCategorySelection(current, value);
    setFormData({
      ...formData,
      scamCategory: next.join(','),
      otherCategoryNote: next.includes(OTHER_CATEGORY) ? formData.otherCategoryNote : '',
    });
  };

  const handleOpenEdit = (scam: any) => {
    setEditingScam(scam);
    setFormData({
      title: scam.title || '',
      description: scam.description || '',
      avoidanceTip: scam.avoidanceTip || '',
      scamCategory: scam.scamCategory || 'OVERCHARGING',
      otherCategoryNote: scam.otherCategoryNote || '',
      scope: scam.scope || 'spot',
      countryCode: scam.countryCode || 'TH',
      cityId: scam.cityId || '',
      regionId: scam.regionId || '',
      sourceUrl: scam.sourceUrl || '',
    });
  };

  const handleOpenCreate = () => {
    setEditingScam(null);
    setFormData({
      title: '',
      description: '',
      avoidanceTip: '',
      scamCategory: 'OVERCHARGING',
      otherCategoryNote: '',
      scope: 'spot',
      countryCode: 'TH',
      cityId: '',
      regionId: '',
      sourceUrl: '',
    });
    setIsCreateModalOpen(true);
  };

  const handleSaveScam = async () => {
    if (!formData.title.trim()) {
      toast.error('제보 제목을 입력해 주세요.');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('피해 내용을 입력해 주세요.');
      return;
    }
    if (!formData.scamCategory || !formData.scamCategory.trim()) {
      toast.error('사기 카테고리를 최소 1개 이상 선택해 주세요.');
      return;
    }
    if (hasOtherCategory(formData.scamCategory) && formData.otherCategoryNote.trim().length < OTHER_NOTE_MIN_LENGTH) {
      toast.error('기타를 고르면 어떤 내용인지 한 줄로 알려 주세요.');
      return;
    }

    const otherNote = hasOtherCategory(formData.scamCategory) ? formData.otherCategoryNote.trim() : null;

    try {
      if (editingScam) {
        await updateScamMutation.mutateAsync({
          id: editingScam.id,
          data: {
            title: formData.title,
            description: formData.description,
            avoidanceTip: formData.avoidanceTip,
            scamCategory: formData.scamCategory,
            otherCategoryNote: otherNote,
            scope: formData.scope,
            sourceUrl: formData.sourceUrl,
          },
        });
        toast.success('사기 제보가 성공적으로 수정되었습니다.');
        setEditingScam(null);
      } else {
        await createScamMutation.mutateAsync({
          title: formData.title,
          description: formData.description,
          avoidanceTip: formData.avoidanceTip,
          scamCategory: formData.scamCategory,
          otherCategoryNote: otherNote,
          scope: formData.scope,
          countryCode: formData.countryCode,
          cityId: formData.cityId || undefined,
          regionId: formData.regionId || undefined,
          sourceUrl: formData.sourceUrl,
        });
        toast.success('신규 사기 제보가 추가되었습니다.');
        setIsCreateModalOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || '저장 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteScam = async () => {
    if (!deletingScam) return;
    try {
      await deleteScamMutation.mutateAsync(deletingScam.id);
      toast.success('제보 정보가 삭제되었습니다.');
      setDeletingScam(null);
    } catch (err: any) {
      toast.error(err.message || '삭제 중 오류가 발생했습니다.');
    }
  };

  // AG Grid Column Definitions
  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerCheckboxSelection: true,
      checkboxSelection: true,
      width: 50,
      pinned: 'left',
      resizable: false,
      sortable: false,
      filter: false,
    },
    {
      headerName: '상태',
      field: 'deletedAt',
      width: 90,
      cellRenderer: (params: any) => {
        const isDeleted = !!params.value;
        return isDeleted ? (
          <Badge variant="outline" className="border-0 bg-rose-500/15 text-rose-600 dark:text-rose-400 px-2 py-0.5 text-xs font-medium">
            삭제됨 🔴
          </Badge>
        ) : (
          <Badge variant="outline" className="border-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-xs font-medium">
            정상 🟢
          </Badge>
        );
      },
    },
    {
      headerName: '범위',
      field: 'scope',
      width: 110,
      cellRenderer: ScopeRenderer,
    },
    {
      headerName: '국가 / 도시',
      field: 'country.name',
      width: 150,
      valueGetter: (params) => {
        const countryName = params.data.country?.name || params.data.countryCode || '';
        const cityName = params.data.city?.name || params.data.region?.name || '';
        return cityName ? `${countryName} (${cityName})` : countryName;
      },
    },
    {
      headerName: '카테고리',
      field: 'scamCategory',
      width: 140,
      cellRenderer: CategoryRenderer,
    },
    {
      headerName: '사기 제보 제목',
      field: 'title',
      flex: 1,
      minWidth: 260,
      cellRenderer: (params: any) => (
        <div className="flex flex-col justify-center py-1">
          <span className="font-semibold text-sm text-foreground truncate">{params.data.title}</span>
          <span className="text-xs text-muted-foreground truncate">{params.data.description}</span>
        </div>
      ),
    },
    {
      headerName: '반응',
      field: 'upvoteCount',
      width: 110,
      cellRenderer: (params: any) => (
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-0.5 text-emerald-500">
            <ThumbsUp className="w-3 h-3" /> {params.data.upvoteCount}
          </span>
          <span className="flex items-center gap-0.5 text-rose-500">
            <ThumbsDown className="w-3 h-3" /> {params.data.downvoteCount}
          </span>
        </div>
      ),
    },
    {
      headerName: '등록일',
      field: 'createdAt',
      width: 130,
      valueFormatter: (params) => {
        if (!params.value) return '';
        return format(new Date(params.value), 'yyyy-MM-dd HH:mm', { locale: ko });
      },
    },
    {
      headerName: '관리',
      field: 'id',
      width: 140,
      pinned: 'right',
      cellRenderer: ActionsRenderer,
    },
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  return (
    <div className="p-4 max-w-[1600px] mx-auto flex flex-col h-[calc(100vh-100px)] gap-3 overflow-hidden">
      {/* Top Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            사기 제보 데이터 관리
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            전 세계 사기 경고 제보 목록을 AG Grid 테이블에서 검색, 수정, 삭제 및 등록 관리할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedRows.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="flex items-center gap-1.5 shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              선택 삭제 ({selectedRows.length}개)
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setIsBulkImportModalOpen(true)}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <FileJson className="w-4 h-4 text-emerald-500" />
            JSON 일괄 등록
          </Button>
          <Button onClick={handleOpenCreate} className="bg-primary text-primary-foreground flex items-center gap-1.5 shadow-sm">
            <Plus className="w-4 h-4" />
            신규 제보 등록
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-xl border shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="제보 제목 또는 내용 검색..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Filter */}
          <Select value={scopeFilter} onValueChange={(v) => { setScopeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="범위 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 범위</SelectItem>
              <SelectItem value="spot">📍 특정 위치</SelectItem>
              <SelectItem value="region">🗺️ 구역 전체</SelectItem>
              <SelectItem value="city">🏙️ 도시 전체</SelectItem>
              <SelectItem value="country">🇹🇭 국가 전체</SelectItem>
            </SelectContent>
          </Select>

          {/* Country Filter */}
          <Select value={countryFilter} onValueChange={(v) => { setCountryFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="국가 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 국가</SelectItem>
              {countries?.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="카테고리 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 카테고리</SelectItem>
              <SelectItem value="FORCED_SHOPPING">🛍️ 호객/강매</SelectItem>
              <SelectItem value="OVERCHARGING">💸 바가지 요금</SelectItem>
              <SelectItem value="FAKE_TAXI">🚕 가짜 택시</SelectItem>
              <SelectItem value="DRUG_HAZARD">💊 약물 위험</SelectItem>
              <SelectItem value="LIES_TOURISM">🗣️ 가짜 정보</SelectItem>
              <SelectItem value="OTHER">📝 기타</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* AG Grid Table Container (뷰포트 맞춤 100% 확장 flex-1 min-h-0) */}
      <div className={`flex-1 min-h-0 bg-card rounded-xl border shadow-sm overflow-hidden ${gridThemeClass} w-full`}>
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <AgGridReact
            theme="legacy"
            rowData={data?.items || []}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowSelection="multiple"
            onSelectionChanged={handleSelectionChanged}
            context={{
              onEdit: handleOpenEdit,
              onDelete: (scam: any) => setDeletingScam(scam),
              onRestore: handleRestoreScam,
            }}
            rowHeight={40}
            headerHeight={38}
            overlayNoRowsTemplate="<span class='text-muted-foreground text-sm'>조건에 일치하는 사기 제보 데이터가 없습니다.</span>"
          />
        )}
      </div>

      {/* Server Pagination (하단 밀착 고정) */}
      <div className="shrink-0 bg-card p-2.5 rounded-xl border shadow-sm flex items-center justify-between">
        <CommonPagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={(p) => setPage(p)}
          itemsPerPage={limit}
          onItemsPerPageChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
          itemsPerPageOptions={[10, 20, 50, 100]}
        />
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={isCreateModalOpen || !!editingScam} onOpenChange={(open) => {
        if (!open) {
          setIsCreateModalOpen(false);
          setEditingScam(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {editingScam ? '사기 제보 데이터 수정' : '신규 사기 제보 데이터 등록'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!editingScam && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>국가 선택</Label>
                  <Select value={formData.countryCode} onValueChange={(v) => setFormData({ ...formData, countryCode: v, cityId: '', regionId: '' })}>
                    <SelectTrigger><SelectValue placeholder="국가 선택" /></SelectTrigger>
                    <SelectContent>
                      {countries?.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>도시 선택 (선택사항)</Label>
                  <Select value={formData.cityId || 'none'} onValueChange={(v) => setFormData({ ...formData, cityId: v === 'none' ? '' : v, regionId: '' })}>
                    <SelectTrigger><SelectValue placeholder="도시 선택" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">선택 안 함</SelectItem>
                      {cities?.map((city) => (
                        <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>제보 범위 (Scope)</Label>
              <Select value={formData.scope} onValueChange={(v) => setFormData({ ...formData, scope: v })}>
                <SelectTrigger><SelectValue placeholder="범위" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="spot">📍 특정 위치 (Spot)</SelectItem>
                  <SelectItem value="region">🗺️ 구역 전체 (Region)</SelectItem>
                  <SelectItem value="city">🏙️ 도시 전체 (City)</SelectItem>
                  <SelectItem value="country">🇹🇭 국가 전체 (Country)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>사기 카테고리 (복수 선택 가능)</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {CATEGORY_OPTIONS.map((cat) => {
                  const selectedList = formData.scamCategory ? formData.scamCategory.split(',').filter(Boolean) : [];
                  const isSelected = selectedList.includes(cat.value);
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => toggleCategory(cat.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <span>{cat.label}</span>
                      {isSelected && <span className="text-[10px] font-bold">✓</span>}
                    </button>
                  );
                })}
              </div>
              {hasOtherCategory(formData.scamCategory) && (
                <Input
                  className="mt-2 text-xs"
                  maxLength={40}
                  placeholder="기타 성격 한 줄 (예: 소매치기)"
                  value={formData.otherCategoryNote}
                  onChange={(e) => setFormData({ ...formData, otherCategoryNote: e.target.value })}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>제보 제목</Label>
              <Input
                placeholder="예: 방콕 카오산로드 10바트 툭툭 시티투어 사기"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>피해 상세 수법 설명</Label>
              <Textarea
                rows={4}
                placeholder="관광객이 겪게 되는 상세 사기 수법 및 상황을 서술해 주세요..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>대처 및 예방법 (Avoidance Tip)</Label>
              <Textarea
                rows={2}
                placeholder="예: 비정상적으로 저렴한 요금은 거절하고 그랩 앱을 사용하세요..."
                value={formData.avoidanceTip}
                onChange={(e) => setFormData({ ...formData, avoidanceTip: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>출처 URL (선택사항)</Label>
              <Input
                placeholder="https://www.0404.go.kr..."
                value={formData.sourceUrl}
                onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setIsCreateModalOpen(false); setEditingScam(null); }}>
              취소
            </Button>
            <Button onClick={handleSaveScam} disabled={createScamMutation.isPending || updateScamMutation.isPending}>
              {editingScam ? '수정 저장' : '등록 완료'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingScam} onOpenChange={(open) => !open && setDeletingScam(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              사기 제보 데이터 삭제
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground space-y-2">
            <p>정말로 다음 제보 데이터를 삭제하시겠습니까?</p>
            <div className="p-3 bg-muted rounded-lg font-medium text-foreground text-xs">
              {deletingScam?.title}
            </div>
            <p className="text-xs text-rose-500 font-semibold">삭제된 제보 데이터는 지도 및 피드 목록에서 즉시 숨김 처리됩니다.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeletingScam(null)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDeleteScam} disabled={deleteScamMutation.isPending}>
              강제 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={isBulkDeleteModalOpen} onOpenChange={setIsBulkDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              선택한 사기 제보 일괄 삭제
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground space-y-2">
            <p>선택하신 <strong className="text-foreground font-bold">{selectedRows.length}개</strong>의 사기 제보 데이터를 정말로 일괄 삭제하시겠습니까?</p>
            <div className="p-3 bg-muted rounded-lg space-y-1 max-h-36 overflow-y-auto border text-xs">
              {selectedRows.map((r, idx) => (
                <div key={r.id || idx} className="truncate text-foreground">
                  • {r.title}
                </div>
              ))}
            </div>
            <p className="text-xs text-rose-500 font-semibold">삭제된 제보 데이터는 지도 및 피드 목록에서 즉시 숨김 처리됩니다.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsBulkDeleteModalOpen(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleBulkDeleteScams} disabled={deleteScamsBulkMutation.isPending}>
              일괄 삭제 ({selectedRows.length}개)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={isBulkImportModalOpen} onOpenChange={setIsBulkImportModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="w-5 h-5 text-emerald-500" />
              AI 수집 JSON 제보 데이터 일괄 등록
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-xs text-muted-foreground">
              ChatGPT, Claude 등 AI로 수집한 제보 데이터 JSON 배열(<code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-[11px]">[&#123;...&#125;]</code>)을 아래에 그대로 붙여넣으세요. 백엔드가 국가, 도시, 세부 장소를 자동 연결하여 1초 만에 일괄 적재합니다.
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
    "countryCode": "TH",
    "cityName": "방콕",
    "regionName": "카오산로드",
    "scope": "spot",
    "scamCategory": "FAKE_TAXI",
    "title": "방콕 카오산로드 입구 가짜 뚝뚝 사기",
    "description": "피해 내용 설명...",
    "avoidanceTip": "대처법 팁...",
    "latitude": 13.7590,
    "longitude": 100.4972
  }
]`}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="font-mono text-xs h-64 leading-relaxed resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setIsBulkImportModalOpen(false); setJsonInput(''); }}>
              취소
            </Button>
            <Button
              onClick={handleBulkImportScams}
              disabled={!parsedJsonItems || parsedJsonItems.length === 0 || bulkImportMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
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
