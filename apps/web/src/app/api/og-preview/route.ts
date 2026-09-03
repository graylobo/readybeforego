import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrlStr = searchParams.get('url');

  if (!targetUrlStr) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  let normalizedUrl = targetUrlStr.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    const domain = parsedUrl.hostname;

    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json({
        url: normalizedUrl,
        domain,
        title: domain,
        description: '',
        image: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return NextResponse.json({
        url: normalizedUrl,
        domain,
        title: domain,
        description: '',
        image: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
      });
    }

    const html = await response.text();

    const getMetaProperty = (prop: string) => {
      const match =
        html.match(new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i')) ||
        html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${prop}["']`, 'i'));
      return match ? match[1] : null;
    };

    const getMetaName = (name: string) => {
      const match =
        html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i')) ||
        html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["']`, 'i'));
      return match ? match[1] : null;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    let title =
      getMetaProperty('og:title') ||
      getMetaName('twitter:title') ||
      (titleMatch ? titleMatch[1] : null) ||
      domain;

    let description =
      getMetaProperty('og:description') ||
      getMetaName('twitter:description') ||
      getMetaName('description') ||
      '';

    let image = getMetaProperty('og:image') || getMetaName('twitter:image');

    const decodeHtmlEntities = (str: string) =>
      str
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ');

    title = decodeHtmlEntities(title.trim());
    description = decodeHtmlEntities(description.trim());

    if (image) {
      try {
        image = new URL(image, normalizedUrl).href;
      } catch {
        image = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      }
    } else {
      image = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    }

    return NextResponse.json({
      url: normalizedUrl,
      domain,
      title,
      description,
      image,
    });
  } catch {
    let domain = targetUrlStr;
    try {
      domain = new URL(normalizedUrl).hostname;
    } catch {}

    return NextResponse.json({
      url: normalizedUrl,
      domain,
      title: domain,
      description: '',
      image: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    });
  }
}
