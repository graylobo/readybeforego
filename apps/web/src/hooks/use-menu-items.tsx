import { useBoards } from '@/hooks/queries/use-board-queries';
import { useSiteSettings } from '@/hooks/queries/use-site-queries';
import type { SidebarInitialData } from '@/lib/sidebar-initial-data';
import {
  FileText,
  LayoutGrid,
  Gift,
  Luggage,
  MessageCircleMore,
  MessageCircleQuestionMark,
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

// 게시판 전체 메뉴(커뮤니티)는 숨김: 라운지/문의하기만 바로가기로 둔다 (다시 보이려면 true)
const COMMUNITY_MENU_ENABLED = false;

export function useMenuItems(initial?: SidebarInitialData) {
  const { data: boards = [], isSuccess: boardsLoaded } = useBoards(initial?.boards);
  // 관리자 사이트 설정에서 끈 메뉴는 숨긴다 (설정을 아직 못 받았으면 보이는 쪽이 기본)
  const { data: settings } = useSiteSettings(initial?.settings);
  const showAllBoard = settings?.showAllBoardMenu ?? true;
  const showDirectory = settings?.showBoardDirectoryMenu ?? true;
  // 사이드바에 넣는 게시판: 공개된 기본 게시판 (신청으로 생긴 게시판(type='user')은 게시판 목록에서 찾는다)
  const sidebarBoards = boards.filter((board) => !board.isPrivate && board.type !== 'user');
  // 보일 게시판이 하나도 없으면 커뮤니티 메뉴를 통째로 숨긴다 (목록을 받기 전에는 보이는 쪽이 기본: 메뉴가 깜빡이지 않게)
  const showCommunity = !boardsLoaded || sidebarBoards.length > 0;

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
    ...(COMMUNITY_MENU_ENABLED && showCommunity ? [{
      id: 'community-boards',
      label: '커뮤니티',
      icon: <MessageSquare className="h-5 w-5" />,
      href: '#',
      // 신청으로 생긴 게시판(type='user')은 수가 많아질 수 있어 사이드바에 넣지 않고 게시판 목록에서 찾는다
      subMenu: [
        ...(showAllBoard ? [{ id: 'board-all', label: '전체 게시판', href: '/board/all', icon: <FileText className="h-4 w-4" /> }] : []),
        ...sidebarBoards
          .map(board => ({
            id: `board-${board.slug}`,
            label: board.name,
            href: `/board/${board.slug}`,
            icon: <FileText className="h-4 w-4" />,
          })),
        ...(showDirectory ? [{ id: 'board-directory', label: '게시판 목록', href: '/boards', icon: <LayoutGrid className="h-4 w-4" /> }] : []),
      ],
    }] : []),
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
