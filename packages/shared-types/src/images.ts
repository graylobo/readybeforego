/** 댓글 이미지를 올릴 때 서버가 함께 만드는 작은 버전의 너비 (댓글 칸 최대 220px의 2배, 고해상도 화면용) */
export const COMMENT_IMAGE_THUMBNAIL_WIDTH = 440;

/** 이미지 파일 이름 뒤에 -w{너비} 를 붙인 작은 버전 경로/주소 (예: a.webp → a-w440.webp) */
export function imageVariantPath(pathOrUrl: string, width: number): string {
  return pathOrUrl.replace(/\.webp(?=$|[?#])/, `-w${width}.webp`);
}

/** 서버가 작은 버전을 함께 만든 댓글 이미지인지 (comments 폴더의 원본 webp) */
export function isCommentImagePath(pathOrUrl: string): boolean {
  const path = pathOrUrl.split(/[?#]/)[0];
  return /(^|\/)comments\//.test(path) && path.endsWith('.webp') && !/-w\d+\.webp$/.test(path);
}

/** 댓글 이미지의 작은 버전 주소. 작은 버전이 없는 이미지면 null */
export function commentImageThumbnailUrl(url: string): string | null {
  return isCommentImagePath(url) ? imageVariantPath(url, COMMENT_IMAGE_THUMBNAIL_WIDTH) : null;
}
