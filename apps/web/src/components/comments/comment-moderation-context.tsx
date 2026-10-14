'use client';

import { createContext, useContext } from 'react';

/**
 * 댓글 목록 전체에 필요한 게시판 기준 값.
 * canModerate: 게시판 관리자(매니저·부매니저)나 사이트 관리자라 남의 댓글도 지울 수 있음
 * readOnly: 읽기 전용 게시판이라 새 댓글·답글을 받지 않음
 */
export const CommentModerationContext = createContext<{ canModerate: boolean; readOnly: boolean }>({
  canModerate: false,
  readOnly: false,
});

export const useCommentModeration = () => useContext(CommentModerationContext);
