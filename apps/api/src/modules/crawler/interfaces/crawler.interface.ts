export interface ParsedPostItem {
  sourcePostId: string;
  title: string;
  recommendCount: number;
  url: string;
}

export interface PostDetail {
  sourcePostId: string;
  title: string;
  contentHtml: string;
  imageUrls: string[];
  url: string;
}
