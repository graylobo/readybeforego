"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="relative mb-8 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl transform scale-150" />
        <div className="relative rounded-2xl bg-card border border-border p-6 shadow-xl">
          <FileQuestion className="h-16 w-16 text-primary animate-pulse" />
        </div>
      </div>

      <div className="space-y-3 max-w-md">
        <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-destructive/10 text-destructive border border-destructive/20">
          404 Not Found
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
          요청하신 페이지가 존재하지 않거나, 이동되었을 수 있습니다.
          <br />
          입력하신 주소가 올바른지 다시 한번 확인해 주세요.
        </p>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xs sm:max-w-none">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="w-full sm:w-auto cursor-pointer gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          이전 페이지로
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
