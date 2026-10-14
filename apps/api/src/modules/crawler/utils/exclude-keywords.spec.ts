import { findExcludeKeyword, parseExcludeKeywords } from '@community/shared-types';

describe('제외 키워드', () => {
  it('쉼표와 줄바꿈으로 나누고, 빈 칸과 중복(대소문자·띄어쓰기 무시)은 뺀다', () => {
    expect(parseExcludeKeywords(' 광고, 홍보\n\n코인 ,AD, ad, 광 고')).toEqual(['광고', '홍보', '코인', 'AD']);
    expect(parseExcludeKeywords(null)).toEqual([]);
    expect(parseExcludeKeywords(' , \n')).toEqual([]);
  });

  it('제목이나 본문에 있으면 그 키워드를 돌려준다', () => {
    const keywords = parseExcludeKeywords('광고, 코인');
    expect(findExcludeKeyword(keywords, '오늘 점심 후기', '코인 얘기 좀 하자')).toBe('코인');
    expect(findExcludeKeyword(keywords, '[광고] 이벤트', '')).toBe('광고');
    expect(findExcludeKeyword(keywords, '오늘 점심 후기', '맛있었다')).toBeNull();
  });

  it('대소문자와 띄어쓰기를 무시한다', () => {
    expect(findExcludeKeyword(['광고'], '광 고 아님')).toBe('광고');
    expect(findExcludeKeyword(['Bit Coin'], 'BITCOIN 시세')).toBe('Bit Coin');
  });

  it('키워드가 없으면 아무 글도 걸리지 않는다', () => {
    expect(findExcludeKeyword([], '광고')).toBeNull();
  });
});
