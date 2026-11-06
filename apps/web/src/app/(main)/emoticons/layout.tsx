import type { Metadata } from 'next';

// 화면은 page.tsx가 그리고, 여기서는 검색 결과에 보일 제목·설명만 정한다 (페이지마다 다른 제목이어야 검색엔진이 구분한다)
export const metadata: Metadata = {
  title: '이모티콘샵',
  description: '댓글과 채팅에 쓸 수 있는 이모티콘을 둘러보고 포인트로 구매하세요.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
