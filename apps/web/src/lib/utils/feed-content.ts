import { ContentImage, contentImageTag, extractContentImages, removeContentImages } from './content-images';

/**
 * 피드형 게시글(글쓰기/수정 창이 입력칸 + 이미지 첨부인 게시판)의 본문 형식.
 * 한 줄을 <p> 문단 하나로, 이미지는 그 뒤에 붙여 저장한다. 상세 화면(HTML)과 목록 미리보기(글자)
 * 양쪽에서 줄바꿈이 유지되고, 수정 창에서는 다시 줄 단위 글자로 되돌린다.
 */
const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const decodeHtml = (text: string) =>
  text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

/** HTML을 줄바꿈이 살아 있는 글자로 바꾼다 (문단·줄바꿈·제목·목록 끝을 줄바꿈으로). 목록 미리보기에도 쓴다 */
export function htmlToPlainText(html: string | undefined): string {
  if (!html) return '';
  const text = html
    .replace(/<p[^>]*>\s*<br\s*\/?>\s*<\/p>/gi, '\n') // 빈 줄 문단
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return decodeHtml(text).replace(/\n+$/, '').trim();
}

/**
 * 목록 미리보기 글자. 수집한 글처럼 글 사이에 이미지가 많은 본문은 이미지를 뺀 자리마다 빈 줄이 쌓이므로
 * 연속된 빈 줄을 한 줄로 줄인다 (수정 창에 넣는 글자는 htmlToPlainText 그대로 써서 빈 줄을 보존)
 */
export function htmlToPreviewText(html: string | undefined): string {
  return htmlToPlainText(html)
    .replace(/[^\S\n]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

export function buildFeedContent(text: string, images: ContentImage[]): string {
  // 빈 줄은 <p><br /></p>로 저장해야 상세 화면에서 높이가 0이 되지 않고 빈 줄로 보인다
  const paragraphs = !text
    ? ''
    : text.split('\n').map((line) => `<p>${line ? escapeHtml(line) : '<br />'}</p>`).join('');
  const imageHtml = images.map((image) => `<p>${contentImageTag(image)}</p>`).join('');
  return `${paragraphs}${imageHtml}`;
}

export function parseFeedContent(html: string | undefined): { text: string; images: ContentImage[] } {
  if (!html) return { text: '', images: [] };
  return { text: htmlToPlainText(removeContentImages(html)), images: extractContentImages(html) };
}

const FEED_IMAGE_ATTRS = new Set(['src', 'srcset', 'width', 'height']);

/**
 * 피드형 수정 창(입력칸 + 이미지)으로 고쳐도 잃는 것이 없는 본문인지.
 * buildFeedContent가 만드는 모양(글자만 있는 <p> 문단들 + 그 뒤의 이미지 문단)이면 true.
 * 일반 편집기로 쓴 글이나 수집한 글(서식, 링크, 글 사이 이미지)은 false라서 일반 편집기로 고쳐야 한다.
 * 브라우저에서만 호출한다 (DOMParser)
 */
export function isFeedEditableContent(html: string | undefined): boolean {
  if (!html?.trim()) return true;
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  let seenImage = false;
  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent?.trim()) return false;
      continue;
    }
    if (!(node instanceof HTMLParagraphElement) || node.attributes.length > 0) return false;
    const children = Array.from(node.childNodes);
    const onlyChild = children.length === 1 ? children[0] : null;
    if (onlyChild instanceof HTMLImageElement) {
      if (!Array.from(onlyChild.attributes).every((attr) => FEED_IMAGE_ATTRS.has(attr.name))) return false;
      seenImage = true;
      continue;
    }
    // 이미지는 글 뒤에만 붙으므로, 이미지 다음에 글 문단이 오면 다른 편집기로 쓴 글
    if (seenImage) return false;
    const isBlankLine = onlyChild instanceof HTMLBRElement;
    if (!isBlankLine && !children.every((child) => child.nodeType === Node.TEXT_NODE)) return false;
  }
  return true;
}
