import { useBoards } from '@/hooks/queries/use-board-queries';
import {
  FileText,
  Gift,
  MessageSquare,
  SmilePlus,
} from 'lucide-react';
import React from 'react';

export interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  isHeaderOnly?: boolean;
  isExtra?: boolean;
  subMenu?: {
    id: string;
    label: string;
    href: string;
    icon?: React.ReactNode;
    group?: string;
  }[];
}

export function useMenuItems() {
  const { data: boards = [] } = useBoards();

  const menuItems: MenuItem[] = [
    {
      id: 'community',
      label: '커뮤니티',
      icon: <MessageSquare className="h-5 w-5" />,
      href: '#',
      subMenu: boards
        .filter(board => !board.isPrivate)
        .map(board => ({
          id: `board-${board.slug}`,
          label: board.name,
          href: `/board/${board.slug}`,
          icon: <FileText className="h-4 w-4" />,
        })),
    },
    {
      id: 'events',
      label: '기타',
      icon: <Gift className="h-5 w-5" />,
      href: '#',
      isExtra: false,
      subMenu: [
        { id: 'daily-checkin', label: '출석체크', href: '/event/checkin' },
        { id: 'roulette', label: '포인트 룰렛', href: '/event/roulette' },
        { id: 'emoticon-shop', label: '이모티콘샵', href: '/emoticons', icon: <SmilePlus className="h-4 w-4" /> },
      ]
    },
  ];

  return menuItems;
}
