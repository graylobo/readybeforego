'use client';

import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';

export function ResponsiveToaster() {
  const [position, setPosition] = useState<'top-center' | 'bottom-center'>('top-center');

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setPosition('bottom-center');
      } else {
        setPosition('top-center');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <Toaster richColors position={position} />;
}
