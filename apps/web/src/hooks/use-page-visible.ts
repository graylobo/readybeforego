import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
};

/**
 * 이 탭이 지금 화면에 보이는지 (다른 탭을 보거나 창을 내리면 false).
 * 실시간 연결(알림·채팅)을 보이는 동안만 열어, 켜 두고 잊은 탭이 서버를 하루 종일 붙잡지 않게 할 때 쓴다
 */
export function usePageVisible() {
  return useSyncExternalStore(
    subscribe,
    () => document.visibilityState === 'visible',
    () => true,
  );
}
