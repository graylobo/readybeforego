'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  useAdminBoards, 
  useCreateBoard, 
  useUpdateBoard, 
  useDeleteBoard 
} from '@/hooks/queries/use-admin-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Check,
  Edit2,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

// Type definitions manually here or imported if shared
interface Board {
    id: string;
    slug: string;
    name: string;
    description: string;
    type: 'system' | 'user';
    isActive: boolean;
    sortOrder: number;
    allowAnonymous: boolean;
    isPrivate: boolean;
    viewMode: 'list' | 'lounge' | 'feed';
}

export default function AdminBoardsPage() {
    const queryClient = useQueryClient();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        slug: '',
        name: '',
        description: '',
        sortOrder: 0,
        allowAnonymous: false,
        isPrivate: false,
        viewMode: 'list' as 'list' | 'lounge' | 'feed',
    });

    // Queries
    const { data: boards = [], isLoading } = useAdminBoards();

    // Mutations
    const createMutation = useCreateBoard();
    const updateMutation = useUpdateBoard();
    const deleteMutation = useDeleteBoard();


    const handleCreate = () => {
        if (!formData.slug || !formData.name) {
            alert('slug와 이름은 필수입니다.');
            return;
        }
        if (!/^[a-z0-9-]+$/.test(formData.slug)) {
            alert('slug는 영문 소문자, 숫자, 하이픈(-)만 사용 가능합니다.');
            return;
        }

        createMutation.mutate({
            ...formData,
        }, {
            onSuccess: () => {
                setShowCreateForm(false);
                setFormData({ slug: '', name: '', description: '', sortOrder: 0, allowAnonymous: false, isPrivate: false, viewMode: 'list' });
            }
        });
    };

    const handleUpdate = (board: Board) => {
        updateMutation.mutate({
            id: board.id,
            data: {
                name: formData.name,
                description: formData.description,
                sortOrder: formData.sortOrder,
                allowAnonymous: formData.allowAnonymous,
                isPrivate: formData.isPrivate,
                viewMode: formData.viewMode,
            },
        }, {
            onSuccess: () => {
                setEditingId(null);
            }
        });
    };

    const handleToggleActive = (board: Board) => {
        updateMutation.mutate({
            id: board.id,
            data: { isActive: !board.isActive },
        });
    };

    const handleDelete = (board: Board) => {
        if (!confirm(`'${board.name}' 게시판을 삭제하시겠습니까?\n(게시판 내 모든 게시글도 함께 삭제됩니다)`)) {
            return;
        }
        deleteMutation.mutate(board.id);
    };

    const startEdit = (board: Board) => {
        setEditingId(board.id);
        setFormData({
            slug: board.slug,
            name: board.name,
            description: board.description,
            sortOrder: board.sortOrder,
            allowAnonymous: board.allowAnonymous,
            isPrivate: board.isPrivate,
            viewMode: board.viewMode || 'list',
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormData({ slug: '', name: '', description: '', sortOrder: 0, allowAnonymous: false, isPrivate: false, viewMode: 'list' });
    };

    if (isLoading) {
        return (
            <div className="p-8">
                <Skeleton className="h-10 w-48 mb-6" />
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 mb-4 rounded-lg" />
                ))}
            </div>
        );
    }

    const sortedBoards = [...(boards as Board[])].sort((a, b) => a.sortOrder - b.sortOrder);

    return (
        <div className="p-8 max-w-[1400px] mx-auto">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">게시판 관리</h1>
                <Button onClick={() => setShowCreateForm(true)} disabled={showCreateForm}>
                    <Plus className="mr-2 h-4 w-4" />
                    게시판 추가
                </Button>
            </div>

            {showCreateForm && (
                <div className="bg-card border border-border rounded-lg p-6 mb-6">
                    <h2 className="mb-4 text-lg font-semibold">새 게시판 추가</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="mb-2">
                            <label className="block text-sm font-medium mb-1">Slug (URL용) <span className="text-destructive">*</span></label>
                            <Input
                                value={formData.slug}
                                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                                placeholder="free, qna, notice 등"
                            />
                            <p className="mt-1 text-xs text-muted-foreground">영문 소문자, 숫자, 하이픈(-)만 사용 가능</p>
                        </div>
                        <div className="mb-2">
                            <label className="block text-sm font-medium mb-1">이름 <span className="text-destructive">*</span></label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="자유게시판"
                            />
                        </div>
                        <div className="mb-2 md:col-span-2">
                            <label className="block text-sm font-medium mb-1">설명</label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="게시판 설명을 입력하세요"
                                rows={2}
                            />
                        </div>
                        <div className="mb-2">
                            <label className="block text-sm font-medium mb-1">정렬 순서</label>
                            <Input
                                type="number"
                                value={formData.sortOrder}
                                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                                placeholder="0"
                            />
                            <p className="mt-1 text-xs text-muted-foreground">숫자가 작을수록 먼저 표시됩니다</p>
                        </div>
                        <div className="mb-2">
                            <label className="block text-sm font-medium mb-1">뷰 레이아웃</label>
                            <select
                                value={formData.viewMode}
                                onChange={(e) => setFormData({ ...formData, viewMode: e.target.value as 'list' | 'lounge' | 'feed' })}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="list">일반 리스트형</option>
                                <option value="lounge">라운지형 (Lounge)</option>
                                <option value="feed">피드형 (Instagram)</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2 pt-6 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.allowAnonymous}
                                onChange={(e) => setFormData({ ...formData, allowAnonymous: e.target.checked })}
                                className="w-4 h-4 rounded border-input"
                            />
                            <span className="text-sm font-medium">익명 작성 허용</span>
                        </div>
                        <div className="flex items-center gap-2 pt-6 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.isPrivate}
                                onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
                                className="w-4 h-4 rounded border-input"
                            />
                            <span className="text-sm font-medium">비공개 게시판 (1:1 문의 등)</span>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                          <Button variant="outline" onClick={() => {
                            setShowCreateForm(false);
                            setFormData({ slug: '', name: '', description: '', sortOrder: 0, allowAnonymous: false, isPrivate: false, viewMode: 'list' });
                        }}>취소</Button>
                        <Button onClick={handleCreate} disabled={createMutation.isPending}>
                            {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            추가
                        </Button>
                    </div>
                </div>
            )}

            <div className="bg-card border border-border rounded-lg overflow-hidden relative">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">순서</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead>이름</TableHead>
                            <TableHead>설명</TableHead>
                            <TableHead className="text-center">타입</TableHead>
                            <TableHead className="text-center">레이아웃</TableHead>
                            <TableHead className="text-center">익명</TableHead>
                            <TableHead className="text-center">비공개</TableHead>
                            <TableHead className="text-center">상태</TableHead>
                            <TableHead className="text-right">작업</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedBoards.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                    등록된 게시판이 없습니다.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedBoards.map((board) => (
                                <TableRow key={board.id} className={!board.isActive ? 'opacity-50' : ''}>
                                    {editingId === board.id ? (
                                        <>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    value={formData.sortOrder}
                                                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                                                    className="w-16"
                                                />
                                            </TableCell>
                                            <TableCell><span className="bg-muted px-2 py-0.5 rounded text-sm font-mono">{board.slug}</span></TableCell>
                                            <TableCell>
                                                <Input className="w-32" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                            </TableCell>
                                            <TableCell>
                                                <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={board.type === 'system' ? 'default' : 'outline'}>{board.type}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <select
                                                    value={formData.viewMode}
                                                    onChange={(e) => setFormData({ ...formData, viewMode: e.target.value as 'list' | 'lounge' | 'feed' })}
                                                    className="flex h-8 w-24 rounded-md border border-input bg-background px-1 py-0.5 text-xs focus-visible:outline-none"
                                                >
                                                    <option value="list">리스트</option>
                                                    <option value="lounge">라운지</option>
                                                    <option value="feed">피드</option>
                                                </select>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.allowAnonymous}
                                                    onChange={(e) => setFormData({ ...formData, allowAnonymous: e.target.checked })}
                                                    className="w-4 h-4"
                                                />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.isPrivate}
                                                    onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
                                                    className="w-4 h-4"
                                                />
                                            </TableCell>
                                            <TableCell className="text-center">-</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-center gap-1">
                                                    <Button size="icon" variant="ghost" onClick={() => handleUpdate(board)}>
                                                        <Check className="h-4 w-4 text-green-600" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" onClick={cancelEdit}>
                                                        <X className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </>
                                    ) : (
                                        <>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                                    {board.sortOrder}
                                                </div>
                                            </TableCell>
                                            <TableCell><span className="bg-muted px-2 py-0.5 rounded text-sm font-mono">{board.slug}</span></TableCell>
                                            <TableCell className="font-medium">{board.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{board.description || '-'}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={board.type === 'system' ? 'secondary' : 'outline'}>
                                                    {board.type === 'system' ? '시스템' : '사용자'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={board.viewMode === 'feed' ? 'default' : board.viewMode === 'lounge' ? 'secondary' : 'outline'}>
                                                    {board.viewMode === 'feed' ? '피드형(인스타)' : board.viewMode === 'lounge' ? '라운지형' : '리스트형'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={board.allowAnonymous ? 'default' : 'outline'}>
                                                    {board.allowAnonymous ? '허용' : '불가'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={board.isPrivate ? 'destructive' : 'outline'}>
                                                    {board.isPrivate ? '비공개' : '공개'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                 <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => handleToggleActive(board)}
                                                    title={board.isActive ? '비활성화' : '활성화'}
                                                >
                                                    {board.isActive ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                                                </Button>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-center gap-1">
                                                    <Button size="icon" variant="ghost" onClick={() => startEdit(board)}>
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" onClick={() => handleDelete(board)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="mt-6 p-4 rounded-lg border border-blue-300 bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:border-blue-900 dark:text-blue-100">
                <h3 className="font-medium mb-2">💡 게시판 사용 안내</h3>
                <ul className="text-sm text-blue-700 dark:text-blue-300 list-none space-y-1">
                    <li>• 게시판 URL: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">/board/[slug]</code></li>
                    <li>• Slug는 생성 후 변경할 수 없습니다.</li>
                    <li>• 비활성화된 게시판은 사이드바에 표시되지 않습니다.</li>
                    <li>• 정렬 순서가 작을수록 사이드바에서 먼저 표시됩니다.</li>
                </ul>
            </div>
        </div>
    );
}
