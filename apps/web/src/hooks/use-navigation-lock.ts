import { useEffect, useRef } from 'react';

export function useNavigationLock(isEnabled: boolean, message = '정말로 취소하시겠습니까?') {
  const isExiting = useRef(false);

  useEffect(() => {
    if (!isEnabled) {
      isExiting.current = false;
      return;
    }

    // 1. 브라우저 종료/새로고침 방지 (Hard Exit)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isExiting.current) return;
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    // 2. 브라우저 뒤로가기 방지 (PopState)
    const handlePopState = () => {
      if (isExiting.current) return;

      if (window.confirm(message)) {
        isExiting.current = true;
        window.history.back(); // 실제로 이전 페이지로 이동
      } else {
        // 취소 시 현재 상태 유지 (더미 상태 다시 밀어넣기)
        window.history.pushState(null, '', window.location.href);
      }
    };

    // 현재 상태를 기록하여 뒤로가기 시 튕겨나가지 않게 함 (더미 상태 추가)
    if (!isExiting.current) {
        window.history.pushState(null, '', window.location.href);
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isEnabled, message]);
}
