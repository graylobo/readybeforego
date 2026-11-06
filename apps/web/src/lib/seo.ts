import type { Metadata } from 'next';

/**
 * 검색 결과에 넣지 않을 화면 (검색·글쓰기·내 정보처럼 사람마다 다르거나 내용이 없는 화면).
 * 이런 화면이 색인되면 내용 없는 페이지가 많은 사이트로 보여 다른 페이지 평가에도 좋지 않다. 링크는 따라가게 둔다
 */
export const NO_INDEX_METADATA: Metadata = {
  robots: { index: false, follow: true },
};
