'use client';

import { useMemo, useCallback } from 'react';
import { useAdminPointPolicies, useUpdatePointPolicy } from '@/hooks/queries/use-admin-queries';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Coins, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  TrendingUp,
  Wallet
} from 'lucide-react';

import { AgGridReact } from 'ag-grid-react';
import { 
  ClientSideRowModelModule, 
  ModuleRegistry, 
  ColDef,
  CellValueChangedEvent,
  CellStyle,
  ValidationModule,
  TextFilterModule,
  NumberFilterModule,
  TextEditorModule,
  NumberEditorModule,
  CellStyleModule
} from 'ag-grid-community';

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

// Register AG Grid modules
ModuleRegistry.registerModules([
  ClientSideRowModelModule, 
  ValidationModule,
  TextFilterModule,
  NumberFilterModule,
  TextEditorModule,
  NumberEditorModule,
  CellStyleModule
]);

// Component for Status Badge
const StatusRenderer = (params: any) => {
  const isActive = params.value;
  return (
    <div className="flex items-center h-full">
      {isActive ? (
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-bold border border-green-200 dark:border-green-800">
          <CheckCircle2 className="h-3 w-3" />
          <span>활성</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-bold border border-border">
          <XCircle className="h-3 w-3" />
          <span>비활성</span>
        </div>
      )}
    </div>
  );
};

// Component for Actions
const ActionsRenderer = (params: any) => {
  const { data, context } = params;
  return (
    <div className="flex items-center gap-2 h-full">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => context.handleToggleActive(data.id, data.isActive)}
        className={`h-7 px-2 text-[11px] font-bold ${data.isActive ? 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20' : 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20'}`}
      >
        {data.isActive ? '비활성화' : '활성화'}
      </Button>
    </div>
  );
};

export default function PointPoliciesPage() {
  const { data: policies, isLoading } = useAdminPointPolicies();
  const updateMutation = useUpdatePointPolicy();

  const handleToggleActive = useCallback(async (id: string, currentStatus: boolean) => {
    try {
      await updateMutation.mutateAsync({ id, data: { isActive: !currentStatus } });
      alert(`정책이 ${!currentStatus ? '활성화' : '비활성화'} 되었습니다.`);
    } catch (error) {
      alert('상태 변경에 실패했습니다.');
    }
  }, [updateMutation]);

  const onCellValueChanged = useCallback(async (event: CellValueChangedEvent) => {
    const { data, colDef, newValue, oldValue } = event;
    if (newValue === oldValue) return;

    try {
      const updateData: any = {};
      if (colDef.field === 'experiencePoints') updateData.experiencePoints = parseInt(newValue, 10);
      if (colDef.field === 'availablePoints') updateData.availablePoints = parseInt(newValue, 10);
      if (colDef.field === 'description') updateData.description = newValue;

      await updateMutation.mutateAsync({ id: data.id, data: updateData });
    } catch (error) {
      alert('수정에 실패했습니다. 다시 시도해주세요.');
    }
  }, [updateMutation]);

  const columnDefs = useMemo<ColDef[]>(() => [
    { 
      field: 'description', 
      headerName: '정책명', 
      flex: 2, 
      editable: true,
      cellStyle: { fontWeight: 'bold' } as CellStyle
    },
    { 
      field: 'actionType', 
      headerName: '코드', 
      flex: 1, 
      cellClass: 'font-mono text-[10px] uppercase text-muted-foreground' 
    },
    { 
      field: 'experiencePoints', 
      headerName: '활동 점수 (EXP)', 
      width: 130, 
      editable: true,
      type: 'numericColumn',
      cellStyle: { color: '#2563eb', fontWeight: 'bold' } as CellStyle,
      valueParser: (params) => {
        const value = parseInt(params.newValue, 10);
        return isNaN(value) ? params.oldValue : value;
      }
    },
    { 
      field: 'availablePoints', 
      headerName: '소모 점수 (P)', 
      width: 120, 
      editable: true,
      type: 'numericColumn',
      cellStyle: { color: '#d97706', fontWeight: 'bold' } as CellStyle,
      valueParser: (params) => {
        const value = parseInt(params.newValue, 10);
        return isNaN(value) ? params.oldValue : value;
      }
    },
    { 
      field: 'isActive', 
      headerName: '상태', 
      width: 100, 
      cellRenderer: StatusRenderer 
    },
    { 
      headerName: '동작', 
      width: 100, 
      cellRenderer: ActionsRenderer,
      sortable: false,
      filter: false
    }
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
  }), []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 flex flex-col h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">포인트 정책 관리</h1>
          <p className="text-muted-foreground mt-1">테이블에서 데이터를 직접 클릭하여 수정할 수 있습니다.</p>
        </div>
       
      </div>

      <div className="flex-1 min-h-[500px] bg-card rounded-xl border shadow-sm overflow-hidden ag-theme-quartz-dark dark:ag-theme-quartz-dark h-full w-full">
        <AgGridReact
          rowData={policies}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onCellValueChanged={onCellValueChanged}
          context={{ handleToggleActive }}
          theme="legacy"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-muted/50 rounded-lg border border-border flex gap-3 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[12px] font-bold">
              <TrendingUp className="h-4 w-4 text-blue-500" />
               <span className="text-blue-600 dark:text-blue-400">활동 점수(EXP):</span> 
               <span className="font-normal text-muted-foreground">레벨업용 (소모 X)</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] font-bold">
              <Wallet className="h-4 w-4 text-amber-500" />
               <span className="text-amber-600 dark:text-amber-400">소모 점수(P):</span> 
               <span className="font-normal text-muted-foreground">실제 사용 가능 재화</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
