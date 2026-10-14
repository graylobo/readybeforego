'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FileQuestion, Home, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * 없는 게시판/게시글 (page.tsx에서 API 404일 때 notFound() 호출).
 * HTTP 404로 응답되어 검색엔진에 빈 페이지가 수집되지 않는다.
 */
export default function BoardNotFound() {
  const params = useParams<{ slug?: string; postId?: string }>();
  const isPost = !!params?.postId;

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="rounded-2xl bg-card border border-border p-5 shadow-sm mb-6">
        <FileQuestion className="h-12 w-12 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {isPost ? '게시글을 찾을 수 없습니다' : '게시판을 찾을 수 없습니다'}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
        {isPost ? '삭제되었거나 주소가 잘못된 게시글입니다.' : '없거나 더 이상 운영하지 않는 게시판입니다.'}
      </p>
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        {isPost && params?.slug && (
          <Button asChild variant="outline" className="gap-2">
            <Link href={`/board/${params.slug}`}>
              <List className="h-4 w-4" />
              게시판 목록으로
            </Link>
          </Button>
        )}
        <Button asChild className="gap-2">
          <Link href="/">
            <Home className="h-4 w-4" />
            메인으로 이동
          </Link>
        </Button>
      </div>
    </div>
  );
}
