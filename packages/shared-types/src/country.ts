export const ISO_COUNTRY_NAMES_KO: Record<string, string> = {
  KR: '대한민국',
  JP: '일본',
  CN: '중국',
  US: '미국',
  MA: '모로코',
  MX: '멕시코',
  PH: '필리핀',
  TR: '튀르키예',
  TW: '대만',
  TH: '태국',
  VN: '베트남',
  IT: '이탈리아',
  FR: '프랑스',
  ES: '스페인',
  DE: '독일',
  GB: '영국',
  UK: '영국',
  CA: '캐나다',
  AU: '호주',
  SG: '싱가포르',
  ID: '인도네시아',
  MY: '말레이시아',
  IN: '인도',
  EG: '이집트',
  GR: '그리스',
  CZ: '체코',
  AT: '오스트리아',
  CH: '스위스',
  NL: '네덜란드',
  BE: '벨기에',
  PT: '포르투갈',
  AE: '아랍에미리트',
  BR: '브라질',
  AR: '아르헨티나',
  HK: '홍콩',
  MO: '마카오',
};

/**
 * ISO 국가 코드 또는 원본 국가명으로부터 다국어(ko, en 등)에 맞는 직관적인 국가명을 반환합니다.
 */
export function getKoreanCountryName(codeOrName: string | null | undefined, lang: string = 'ko'): string {
  if (!codeOrName) return lang === 'ko' ? '기타 국가' : '';
  const clean = codeOrName.trim();
  if (clean === 'UNKNOWN' || clean === '' || clean === 'ETC') {
    return clean === 'ETC' ? (lang === 'ko' ? '기타 국가' : 'ETC') : '';
  }

  const upper = clean.toUpperCase();

  // 1. 사전형 매핑이 존재하는 경우 우선 적용
  if (lang === 'ko' && ISO_COUNTRY_NAMES_KO[upper]) {
    return ISO_COUNTRY_NAMES_KO[upper];
  }

  // 2. ISO 2글자 알파벳 코드인 경우 Intl.DisplayNames 시도
  if (/^[A-Za-z]{2}$/.test(clean)) {
    try {
      const locale = lang === 'ko' ? 'ko' : 'en';
      const displayNames = new Intl.DisplayNames([locale], { type: 'region' });
      const translated = displayNames.of(upper);
      if (translated) return translated;
    } catch (error) {
      // fallback
    }
  }

  // 3. 이미 한글이거나 변환할 수 없는 경우 원본 반환
  return clean;
}
