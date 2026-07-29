import { useBoards } from '@/hooks/queries/use-board-queries';
import {
  FileText,
  Gift,
  Luggage,
  MessageCircleMore,
  MessageCircleQuestionMark,
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
      id: 'guide',
      label: '여행 가이드',
      icon: <Luggage className="h-5 w-5" />,
      href: '/guide',
    },
    {
      id: 'community',
      label: '라운지',
      icon: <MessageCircleMore className="h-5 w-5" />,
      href: '/board/lounge',
    },
    {
      id: 'inquiry',
      label: '문의하기',
      icon: <MessageCircleQuestionMark className="h-5 w-5" />,
      href: '/board/inquiry',
    },
    {
      id: 'events',
      label: '기타',
      icon: <Gift className="h-5 w-5" />,
      href: '#',
      isExtra: false,
      subMenu: [
        { id: 'emoticon-shop', label: '이모티콘샵', href: '/emoticons', icon: <SmilePlus className="h-4 w-4" /> },
      ]
    },
  ];

  return menuItems;
}
