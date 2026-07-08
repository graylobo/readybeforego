import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground bg-background shrink-0">
      <div className="flex justify-center items-center flex-wrap gap-2 mb-3">
        <span className="font-medium">운영팀: help@example.com</span>
        <span className="text-muted-foreground/30 select-none">|</span>
        <Link href="/terms" className="transition-colors hover:text-foreground hover:underline">이용약관</Link>
        <span className="text-muted-foreground/30 select-none">|</span>
        <Link href="/privacy" className="transition-colors hover:text-foreground hover:underline">개인정보처리방침</Link>
        <span className="text-muted-foreground/30 select-none">|</span>
        <Link href="/youth-policy" className="transition-colors hover:text-foreground hover:underline">청소년보호정책</Link>
        <span className="text-muted-foreground/30 select-none">|</span>
        <Link href="/board/inquiry" className="transition-colors hover:text-foreground hover:underline">문의/신고</Link>
        <span className="text-muted-foreground/30 select-none">|</span>
        <Link href="/report-abuse" className="transition-colors hover:text-foreground hover:underline">게시글 중단 요청</Link>
      </div>
      <div className="opacity-60">
         © 2026 Community. All rights reserved.
      </div>
    </footer>
  );
}
