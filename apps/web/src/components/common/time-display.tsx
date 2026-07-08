'use client';

import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface TimeDisplayProps {
  date: string | Date;
  formattedDate: string; // Default absolute time string formatted outside (e.g. yyyy.MM.dd HH:mm)
  className?: string;
  defaultRelative?: boolean;
}

export function TimeDisplay({ date, formattedDate, className = '', defaultRelative = false }: TimeDisplayProps) {
  const [showRelative, setShowRelative] = useState(defaultRelative);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const toggleDisplay = () => {
    setShowRelative(prev => !prev);
  };

  const getRelativeTime = () => {
    try {
      const parsedDate = typeof date === 'string' ? new Date(date) : date;
      return formatDistanceToNow(parsedDate, { addSuffix: true, locale: ko });
    } catch {
      return formattedDate;
    }
  };

  return (
    <span 
      className={`cursor-pointer hover:underline decoration-muted-foreground/50 transition-colors ${className}`} 
      onClick={toggleDisplay}
      title={showRelative ? formattedDate : getRelativeTime()} // Tooltip to show the alternate time
    >
      {isClient && showRelative ? getRelativeTime() : formattedDate}
    </span>
  );
}
