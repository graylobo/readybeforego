import { cn } from '@/lib/utils/cn';

/**
 * 게시글 본문 읽기 전용 렌더링.
 * 편집기(Tiptap)를 띄우지 않고 저장된 HTML을 그대로 그려, 서버 렌더링 HTML에 본문이 포함되도록 한다.
 * (편집기는 브라우저에서 JS 로드 후에야 본문을 그리므로 LCP가 늦어진다)
 * 본문 HTML은 API에서 저장 시와 상세 응답 시 정화(sanitize)된다.
 */
/**
 * 본문 이미지의 다운로드 순서를 정한다.
 * - 첫 이미지: 먼저 받기(fetchpriority=high). 이미지 글에서는 보통 이 이미지가 LCP 요소다
 * - 나머지: 화면에 가까워지면 받기(loading=lazy). 처음부터 한꺼번에 받으면 첫 이미지와 대역폭을 다툰다
 * 서버와 브라우저가 같은 문자열을 만들므로 하이드레이션 불일치가 없다. 이미 loading이 지정된 이미지는 그대로 둔다.
 */
/** 본문 영역 최대 너비(px): 페이지 1200px에서 좌우 여백을 뺀 값. 이보다 넓게 그려지지 않는다 */
const CONTENT_MAX_WIDTH = 1100;

/**
 * srcset(작은 버전 목록)이 있는 이미지에 sizes(화면에서 차지할 너비)를 붙인다. 없으면 브라우저가 화면 전체 너비로 가정해
 * 작게 보이는 이미지도 원본을 받는다. 표시 너비는 저장된 width(편집기에서 줄인 크기)와 본문 최대 너비 중 작은 값
 */
function withSizes(attrs: string): string {
  if (!/\ssrcset=/i.test(attrs) || /\ssizes=/i.test(attrs)) return attrs;
  const width = Number(attrs.match(/\swidth="(\d+)"/i)?.[1]) || CONTENT_MAX_WIDTH;
  const shown = Math.min(width, CONTENT_MAX_WIDTH);
  const sizes = ` sizes="(max-width: ${shown}px) 100vw, ${shown}px"`;
  return attrs.endsWith('/') ? `${attrs.slice(0, -1)}${sizes} /` : `${attrs}${sizes}`;
}

export function prioritizeContentImages(html: string): string {
  let index = 0;
  return html.replace(/<img\b([^>]*)>/gi, (tag, attrs: string) => {
    const isFirst = index++ === 0;
    attrs = withSizes(attrs);
    if (/\sloading=/i.test(attrs)) return `<img${attrs}>`;
    // 첫 이미지는 decoding=async를 붙이지 않는다: 해석을 뒤로 미루면 도착한 뒤에도 늦게 그려질 수 있다
    const extra = isFirst ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"';
    return attrs.endsWith('/') ? `<img${attrs.slice(0, -1)}${extra} />` : `<img${attrs}${extra}>`;
  });
}

export function PostContent({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn(
        // 기존 TiptapViewer와 같은 여백/최소 높이 유지
        'post-content min-h-[400px] p-4',
        '[&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-lg',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: prioritizeContentImages(html) }}
    />
  );
}
