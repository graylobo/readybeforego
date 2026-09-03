"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";

interface GoogleAdProps {
  adClient?: string;
  adSlot?: string;
  adFormat?: "auto" | "fluid" | "rectangle" | "horizontal" | "vertical";
  adLayoutKey?: string;
  adLayout?: string;
  /** false면 PC 가로 배너용. 모바일은 뷰포트 폭에 맞춰야 하므로 true 권장 */
  fullWidthResponsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function GoogleAd({
  adClient = process.env.NEXT_PUBLIC_ADSENSE_ID || "ca-pub-6069097671272504",
  adSlot,
  adFormat = "auto",
  adLayoutKey,
  adLayout,
  fullWidthResponsive = true,
  className,
  style,
}: GoogleAdProps) {
  const isPushed = useRef(false);
  const isDev =
    process.env.NODE_ENV === "development" ||
    (typeof window !== "undefined" && window.location.hostname === "localhost");

  useEffect(() => {
    if (isDev) return;
    if (isPushed.current) return;

    try {
      if (typeof window !== "undefined") {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        isPushed.current = true;
      }
    } catch (err) {
      console.error("AdSense push error:", err);
    }
  }, [isDev, adSlot]);

  if (isDev) {
    return (
      <div
        className={cn(
          "w-full py-2 px-3 sm:px-4 bg-gray-50/80 dark:bg-gray-900/40 rounded-xl border border-dashed border-gray-300 dark:border-gray-800 flex items-center justify-between text-center select-none min-h-[50px] max-h-[60px] sm:h-[90px] sm:max-h-[90px] my-1.5 transition-all overflow-hidden",
          className,
        )}
        style={style}
      >
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          <span className="px-1.5 py-0.5 bg-gray-200/80 dark:bg-gray-800 rounded text-[10px] text-gray-500 dark:text-gray-400">
            AD
          </span>
          <span>구글 애드센스 광고 영역 (미리보기)</span>
        </div>
        <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500">
          {adSlot ? `Slot: ${adSlot}` : "adSlot 필요"}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        // max-height로 앱 셸 스크롤 깨짐 방지 + 모바일/PC 각각 적절한 슬롯 높이
        "w-full overflow-hidden overscroll-none my-1.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-center text-center",
        "min-h-[50px] h-[60px] max-h-[60px] sm:h-[90px] sm:max-h-[90px]",
        "[&_iframe]:mx-auto [&_iframe]:block [&_ins]:mx-auto [&_ins]:block",
        className,
      )}
      style={style}
    >
      <ins
        className="adsbygoogle"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          maxHeight: "100%",
          textAlign: "center",
          margin: "0 auto",
          ...style,
        }}
        data-ad-client={adClient}
        data-ad-slot={adSlot}
        data-ad-format={adFormat || "auto"}
        data-ad-layout-key={adLayoutKey}
        data-ad-layout={adLayout}
        data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
      />
    </div>
  );
}
