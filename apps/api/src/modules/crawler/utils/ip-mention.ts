/**
 * 아이피 언급 글 거르기.
 * 디시는 유동 작성자 닉네임 옆에 아이피 앞 두 자리를 보여줘서(예: "ㅇㅇ(41.63)"), 그 아이피로 특정 사람을 지칭하는 글이 있다.
 * 숫자 패턴만으로는 날짜("10.18")나 소수("19.9억")와 구별할 수 없으므로,
 * 이번 수집에서 목록에 실제로 보인 작성자 아이피만 골라 제목·본문에 그대로 있는지 본다.
 */

// 0~255 숫자 두 개를 점으로 이은 형태
const IP_PREFIX = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/** 목록의 작성자 칸("닉네임(41.63)")에서 아이피. 고정닉처럼 아이피가 없으면 null */
export function parseWriterIp(writerText: string): string | null {
  const match = writerText.trim().match(/\(([\d.]+)\)$/);
  return match && IP_PREFIX.test(match[1]) ? match[1] : null;
}

/**
 * 제목·본문에 들어 있는 첫 아이피. 없으면 null
 * (앞뒤가 숫자나 점으로 이어지면 다른 숫자의 일부라 보지 않는다: "141.633", "1.41.63")
 */
export function findMentionedIp(ips: Iterable<string>, ...texts: string[]): string | null {
  for (const ip of ips) {
    const pattern = new RegExp(`(?<![\\d.])${ip.replace('.', '\\.')}(?!\\.?\\d)`);
    if (texts.some((text) => pattern.test(text))) return ip;
  }
  return null;
}
