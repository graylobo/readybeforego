import type { Metadata } from 'next';
import { NO_INDEX_METADATA } from '@/lib/seo';

// 화면은 page.tsx가 그리고, 여기서는 검색엔진용 정보만 정한다 (검색 결과에 넣지 않는 화면)
export const metadata: Metadata = { ...NO_INDEX_METADATA, title: '글 수정' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
