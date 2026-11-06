import type { Metadata } from 'next';
import Home from './home-page';

// 홈 화면은 클라이언트 컴포넌트라 metadata를 내보낼 수 없어, 서버 컴포넌트인 이 파일에서 대표 주소를 지정한다
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function Page() {
  return <Home />;
}
