import sanitizeHtml from 'sanitize-html';

export const sanitizeContent = (content: string): string => {
  return sanitizeHtml(content, {
    allowedTags: [
      'address', 'article', 'aside', 'footer', 'header', 'h1', 'h2', 'h3', 'h4',
      'h5', 'h6', 'hgroup', 'main', 'nav', 'section', 'blockquote', 'dd', 'div',
      'dl', 'dt', 'figcaption', 'figure', 'hr', 'li', 'main', 'ol', 'p', 'pre',
      'ul', 'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn',
      'em', 'i', 'kbd', 'mark', 'q', 'rb', 'rp', 'rt', 'rtc', 'ruby', 's', 'samp',
      'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'caption',
      'col', 'colgroup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'img', 'iframe'
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading'],
      iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'allow'],
      '*': ['class', 'id', 'style', 'data-*']
    },
    allowedIframeHostnames: ['www.youtube.com', 'player.vimeo.com'],
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  });
};
