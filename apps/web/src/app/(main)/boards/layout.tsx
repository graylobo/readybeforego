import type { Metadata } from 'next';

// 화면은 page.tsx가 그리고, 여기서는 검색 결과에 보일 제목·설명만 정한다 (페이지마다 다른 제목이어야 검색엔진이 구분한다)
export const metadata: Metadata = {
  title: '게시판 목록',
  description: '커뮤니티의 모든 게시판을 한곳에서 찾아보고, 원하는 게시판이 없으면 개설을 신청할 수 있습니다.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
