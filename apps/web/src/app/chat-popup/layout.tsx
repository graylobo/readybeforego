import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '실시간 채팅',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ChatPopupLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-dvh overflow-hidden bg-background">{children}</div>;
}
