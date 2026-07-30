export const ISO_COUNTRY_NAMES_KO: Record<string, string> = {
  KR: '대한민국',
  JP: '일본',
  CN: '중국',
  US: '미국',
  RU: '러시아',
  MN: '몽골',
  HU: '헝가리',
  HR: '크로아티아',
  GU: '괌',
  MP: '사이판',
  NZ: '뉴질랜드',
  LA: '라오스',
  KH: '캄보디아',
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

// 역방향 한글/영문 국가명 -> ISO 2자 코드 매핑
const REVERSE_COUNTRY_CODE_MAP: Record<string, string> = {
  '대한민국': 'KR', '한국': 'KR', 'KOREA': 'KR', 'SOUTH KOREA': 'KR',
  '일본': 'JP', 'JAPAN': 'JP',
  '중국': 'CN', 'CHINA': 'CN',
  '미국': 'US', 'USA': 'US', 'UNITED STATES': 'US',
  '러시아': 'RU', 'RUSSIA': 'RU',
  '몽골': 'MN', 'MONGOLIA': 'MN',
  '베트남': 'VN', 'VIETNAM': 'VN',
  '태국': 'TH', 'THAILAND': 'TH',
  '대만': 'TW', 'TAIWAN': 'TW',
  '싱가포르': 'SG', 'SINGAPORE': 'SG',
  '필리핀': 'PH', 'PHILIPPINES': 'PH',
  '스페인': 'ES', 'SPAIN': 'ES',
  '프랑스': 'FR', 'FRANCE': 'FR',
  '이탈리아': 'IT', 'ITALY': 'IT',
  '영국': 'GB', 'UK': 'GB', 'UNITED KINGDOM': 'GB',
  '독일': 'DE', 'GERMANY': 'DE',
  '괌': 'GU', 'GUAM': 'GU',
  '라오스': 'LA', 'LAOS': 'LA',
  '캄보디아': 'KH', 'CAMBODIA': 'KH',
};

/**
 * 국가명 또는 입력값으로부터 ISO 2자 코드(예: RU, KR, JP)를 반환합니다.
 */
export function getCountryCode(input: string | null | undefined): string {
  if (!input) return 'ETC';
  const clean = input.trim();
  const upper = clean.toUpperCase();

  if (/^[A-Za-z]{2}$/.test(upper)) {
    return upper;
  }

  if (REVERSE_COUNTRY_CODE_MAP[clean] || REVERSE_COUNTRY_CODE_MAP[upper]) {
    return REVERSE_COUNTRY_CODE_MAP[clean] || REVERSE_COUNTRY_CODE_MAP[upper];
  }

  // ISO_COUNTRY_NAMES_KO의 값으로 역조회
  for (const [code, name] of Object.entries(ISO_COUNTRY_NAMES_KO)) {
    if (name === clean || name.toUpperCase() === upper) {
      return code;
    }
  }

  return clean;
}

/**
 * ISO 2자 코드로부터 100% 유니코드 국기 이모지(예: RU -> 🇷🇺, KR -> 🇰🇷)를 자동 계산합니다.
 */
export function getFlagEmoji(countryCode: string | null | undefined): string {
  const code = getCountryCode(countryCode);
  if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) return '✈️';
  try {
    return String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0)));
  } catch {
    return '✈️';
  }
}

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
