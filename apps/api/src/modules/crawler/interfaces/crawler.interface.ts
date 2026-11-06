export interface ParsedPostItem {
  sourcePostId: string;
  title: string;
  recommendCount: number;
  url: string;
}

/** 목록 한 페이지: 수집 후보 글과, 그 페이지 모든 글(후보가 아닌 글 포함)의 작성자 아이피 */
export interface ParsedGalleryList {
  items: ParsedPostItem[];
  writerIps: string[];
}

export interface PostDetail {
  sourcePostId: string;
  title: string;
  contentHtml: string;
  imageUrls: string[];
  url: string;
}
