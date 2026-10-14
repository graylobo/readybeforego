"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // 런타임 에러 로깅
    console.error("App Runtime Error:", error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="relative mb-8 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-destructive/10 blur-2xl transform scale-150" />
        <div className="relative rounded-2xl bg-card border border-destructive/20 p-6 shadow-xl">
          <AlertTriangle className="h-16 w-16 text-destructive animate-bounce" />
        </div>
      </div>

      <div className="space-y-3 max-w-md">
        <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-destructive/10 text-destructive border border-destructive/20">
          500 Internal Error
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
          일시적인 오류가 발생했습니다
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
          요청을 처리하는 도중 예상치 못한 문제가 발생했습니다.
          <br />
          잠시 후 다시 시도해 주세요.
        </p>

        {process.env.NODE_ENV === "development" && error.message && (
          <div className="mt-4 p-3 rounded-lg bg-muted/60 text-left border border-border text-xs font-mono break-all text-muted-foreground max-h-32 overflow-y-auto">
            <span className="font-semibold text-destructive">Error: </span>
            {error.message}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xs sm:max-w-none">
        <Button
          variant="outline"
          onClick={() => reset()}
          className="w-full sm:w-auto cursor-pointer gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          다시 시도
        </Button>

        <Button asChild className="w-full sm:w-auto cursor-pointer gap-2">
          <Link href="/">
            <Home className="h-4 w-4" />
            메인으로 이동
          </Link>
        </Button>
      </div>
    </div>
  );
}
