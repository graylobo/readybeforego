'use client';

import { RefObject, useCallback, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLayoutStore } from '@/lib/stores/layout.store';

/**
 * 본문 스크롤 영역(<main>)의 스크롤 위치를 주소별로 기억했다가 뒤로/앞으로 가기 때 되돌린다.
 * 화면 전체가 아니라 <main>이 스크롤되는 구조라 브라우저의 기본 스크롤 복원이 동작하지 않는다.
 */

export const MAIN_SCROLL_ID = 'app-main-scroll';

const STORAGE_KEY = 'main-scroll-positions';
const MAX_ENTRIES = 50;
// 목록 데이터나 이미지가 늦게 그려지면 그만큼 높이가 생길 때까지 다시 시도한다
const RESTORE_TIMEOUT_MS = 2000;

const currentKey = () => window.location.pathname + window.location.search;

function readPositions(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function savePosition(key: string, top: number) {
  try {
    const positions = readPositions();
    delete positions[key];
    positions[key] = Math.round(top);
    // 오래된 주소부터 지워 저장 공간이 계속 늘지 않게 한다 (객체는 넣은 순서를 유지)
    const keys = Object.keys(positions);
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) delete positions[old];
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // 저장소를 못 쓰면(사생활 보호 모드 등) 복원만 안 될 뿐 화면은 그대로 동작
  }
}

/** 본문 영역을 맨 위로 (같은 화면 안에서 페이지 번호만 바꿀 때) */
export function scrollMainToTop() {
  document.getElementById(MAIN_SCROLL_ID)?.scrollTo({ top: 0 });
}

/**
 * 화면에 그리는 것은 없다. useSearchParams를 쓰므로 레이아웃에서 <Suspense>로 감싸서 둔다
 * (감싸지 않으면 정적 페이지가 레이아웃 전체를 서버에서 그리지 못한다)
 */
export function MainScrollRestoration({ mainRef }: { mainRef: RefObject<HTMLElement | null> }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // 뒤로/앞으로 가기로 바뀌어 위치를 되돌려야 하는 주소, 지금 화면이 그려진 주소
  const restoreKey = useRef<string | null>(null);
  const renderedKey = useRef<string | null>(null);
  const stopRestore = useRef<() => void>(() => {});

  const restore = useCallback(
    (key: string) => {
      stopRestore.current();
      const main = mainRef.current;
      const target = readPositions()[key];
      if (!main || !target) return;

      let frame = 0;
      const startedAt = performance.now();
      // 되돌리는 중에 사용자가 직접 스크롤하면 멈춘다
      const stop = () => {
        cancelAnimationFrame(frame);
        main.removeEventListener('wheel', stop);
        main.removeEventListener('touchstart', stop);
        main.removeEventListener('keydown', stop);
      };
      const step = () => {
        main.scrollTop = target;
        if (Math.abs(main.scrollTop - target) <= 1 || performance.now() - startedAt > RESTORE_TIMEOUT_MS) {
          stop();
          return;
        }
        frame = requestAnimationFrame(step);
      };
      main.addEventListener('wheel', stop, { passive: true });
      main.addEventListener('touchstart', stop, { passive: true });
      main.addEventListener('keydown', stop);
      stopRestore.current = stop;
      step();
    },
    [mainRef],
  );

  useEffect(() => {
    // Next는 popstate를 받자마자 새 화면을 그려 버리기도 해서, Next보다 먼저 받도록 capture로 듣는다
    const onPopStateCapture = () => {
      restoreKey.current = currentKey();
    };
    // 그래도 새 화면이 먼저 그려졌다면(아래 effect가 이미 지나감) 여기서 되돌린다
    const onPopState = () => {
      const key = restoreKey.current;
      if (key && renderedKey.current === key) {
        restoreKey.current = null;
        restore(key);
      }
    };
    window.addEventListener('popstate', onPopStateCapture, true);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopStateCapture, true);
      window.removeEventListener('popstate', onPopState);
      stopRestore.current();
    };
  }, [restore]);

  // 스크롤할 때마다 지금 주소의 위치를 저장
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        // 다른 화면으로 이동 중이면(스켈레톤으로 바뀌며 높이가 줄어든 값) 저장하지 않는다
        if (useLayoutStore.getState().pendingPath !== null) return;
        savePosition(currentKey(), main.scrollTop);
      });
    };
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      main.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [mainRef]);

  // 새 화면이 그려지면: 뒤로/앞으로 가기로 온 주소면 저장해 둔 위치로
  useEffect(() => {
    const key = currentKey();
    renderedKey.current = key;
    if (restoreKey.current !== key) {
      stopRestore.current();
      return;
    }
    restoreKey.current = null;
    restore(key);
  }, [pathname, searchParams, restore]);

  return null;
}
