"use client";

import { useEffect } from "react";
import "./globals.css";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Global Layout Error:", error);
  }, [error]);

  return (
    <html lang="ko">
      <body className="min-h-screen bg-background text-foreground antialiased flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6 bg-card border border-border p-8 rounded-2xl shadow-2xl">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">시스템 오류가 발생했습니다</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              치명적인 시스템 오류로 인해 애플리케이션을 불러올 수 없습니다.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => reset()}
              className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity cursor-pointer"
            >
              다시 시도
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              className="w-full py-2.5 px-4 rounded-lg bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              홈으로 이동
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
