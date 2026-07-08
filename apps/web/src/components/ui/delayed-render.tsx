'use client';

import { useState, useEffect } from 'react';

interface DelayedRenderProps {
  children: React.ReactNode;
  delay?: number;
}

export function DelayedRender({ children, delay = 500 }: DelayedRenderProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!show) return null;

  return <>{children}</>;
}
