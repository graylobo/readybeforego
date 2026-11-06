import { findMentionedIp, parseWriterIp } from './ip-mention';

describe('아이피 언급 글', () => {
  it('작성자 칸에서 아이피를 읽는다 (고정닉·잘못된 값은 null)', () => {
    expect(parseWriterIp('인갤러(121.54)')).toBe('121.54');
    expect(parseWriterIp(' ㅇㅇ(1.234) ')).toBe('1.234');
    expect(parseWriterIp('고정닉')).toBeNull();
    expect(parseWriterIp('ㅇㅇ(300.1)')).toBeNull();
    expect(parseWriterIp('ㅇㅇ(41.63.1)')).toBeNull();
  });

  it('제목이나 본문에 목록에서 본 아이피가 있으면 그 아이피를 돌려준다', () => {
    const ips = new Set(['41.63', '121.54']);
    expect(findMentionedIp(ips, '41.63 또 왔네', '')).toBe('41.63');
    expect(findMentionedIp(ips, '오늘 방송', '저 121.54는 뭐냐')).toBe('121.54');
    expect(findMentionedIp(ips, '(41.63) 이새끼', '')).toBe('41.63');
    expect(findMentionedIp(ips, '41.63.', '')).toBe('41.63');
    expect(findMentionedIp(ips, '41.63ㅋㅋ', '')).toBe('41.63');
  });

  it('다른 숫자의 일부이거나 목록에 없던 숫자는 무시한다', () => {
    const ips = ['41.63'];
    expect(findMentionedIp(ips, '141.63', '41.634', '1.41.63', '41.63.2')).toBeNull();
    expect(findMentionedIp(ips, '10.18 방송 19.9억')).toBeNull();
    expect(findMentionedIp([], '41.63')).toBeNull();
  });
});
