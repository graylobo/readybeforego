import { useState, useCallback, useEffect } from 'react';

export function usePaginationLimit(key: string, defaultLimit: number = 40) {
  const [limit, setLimitState] = useState(defaultLimit);

  useEffect(() => {
    const savedLimit = localStorage.getItem(`pagination-limit-${key}`);
    if (savedLimit && !isNaN(Number(savedLimit))) {
      setLimitState(Number(savedLimit));
    }
  }, [key]);

  const setLimit = useCallback((newLimit: number) => {
    setLimitState(newLimit);
    localStorage.setItem(`pagination-limit-${key}`, newLimit.toString());
  }, [key]);

  return [limit, setLimit] as const;
}
