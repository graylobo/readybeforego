/**
 * 피드형 게시글 본문의 이미지(<img>)를 읽고 쓰는 도우미.
 * 업로드 때 받은 작은 버전 목록(srcset)과 가로·세로 크기를 태그에 함께 넣어 두어야
 * 화면 크기에 맞는 이미지를 받고(용량 절약), 이미지가 늦게 떠도 아래 글이 밀리지 않는다.
 */
export interface ContentImage {
  src: string;
  srcset?: string;
  width?: number;
  height?: number;
}

const IMG_TAG_REGEX = /<img\b[^>]*>/gi;

const decodeAttr = (value: string) => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const encodeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function readAttr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, 'i'));
  const value = match?.[1] ?? match?.[2];
  return value === undefined ? undefined : decodeAttr(value);
}

/** 본문 HTML의 <img> 태그들을 순서대로 읽는다 (같은 주소는 한 번만) */
export function extractContentImages(html: string | undefined): ContentImage[] {
  if (!html) return [];
  const images: ContentImage[] = [];
  const seen = new Set<string>();
  for (const [tag] of html.matchAll(IMG_TAG_REGEX)) {
    const src = readAttr(tag, 'src');
    if (!src || seen.has(src)) continue;
    seen.add(src);
    const width = Number(readAttr(tag, 'width')) || undefined;
    const height = Number(readAttr(tag, 'height')) || undefined;
    images.push({ src, srcset: readAttr(tag, 'srcset') || undefined, width, height });
  }
  return images;
}

/** 본문 HTML에서 <img> 태그를 뺀 나머지 */
export function removeContentImages(html: string): string {
  return html.replace(IMG_TAG_REGEX, '');
}

export function contentImageTag({ src, srcset, width, height }: ContentImage): string {
  const attrs = [`src="${encodeAttr(src)}"`];
  if (srcset) attrs.push(`srcset="${encodeAttr(srcset)}"`);
  if (width && height) attrs.push(`width="${width}"`, `height="${height}"`);
  return `<img ${attrs.join(' ')} />`;
}
