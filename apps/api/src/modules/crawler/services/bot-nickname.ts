/**
 * 수집 카드에 작성자 키워드가 없을 때 쓰는 봇 닉네임. 앞말 × 뒷말 조합(약 1,600가지)으로 만들어
 * 몇 개의 이름이 목록에 계속 반복되지 않게 한다.
 */
const NICKNAME_PREFIXES = [
  '졸린', '배고픈', '달리는', '행복한', '수상한', '조용한', '용감한', '느긋한', '심심한', '반짝이는',
  '엉뚱한', '귀여운', '친절한', '게으른', '부지런한', '신나는', '씩씩한', '당당한', '소심한', '촉촉한',
  '바삭한', '따뜻한', '시원한', '매콤한', '달콤한', '고소한', '새벽의', '퇴근한', '출근한', '방구석',
  '동네', '지나가던', '떠도는', '야식먹는', '겜하는', '산책하는', '노래하는', '춤추는', '꿈꾸는', '멍때리는',
];

const NICKNAME_SUFFIXES = [
  '토끼', '고양이', '강아지', '너구리', '펭귄', '다람쥐', '햄스터', '수달', '판다', '여우',
  '곰돌이', '오리', '거북이', '고래', '참새', '부엉이', '감자', '고구마', '만두', '붕어빵',
  '호떡', '떡볶이', '라면', '김밥', '초코', '마카롱', '쿠키', '두부', '옥수수', '단무지',
  '개발자', '학생', '직장인', '백수', '시청자', '구경꾼', '나그네', '아저씨', '언니', '형님',
];

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** 기본 봇 닉네임 하나 (예: 졸린펭귄) */
export function randomBotNickname(): string {
  return `${pick(NICKNAME_PREFIXES)}${pick(NICKNAME_SUFFIXES)}`;
}

/**
 * 이미 쓴 이름(avoid)과 겹치지 않는 닉네임을 고른다. generate를 여러 번 불러 보고,
 * 후보가 적어(예: 카드 키워드가 2개뿐) 끝내 겹치면 마지막 후보를 그대로 쓴다
 */
export function pickUnusedNickname(generate: () => string, avoid: ReadonlySet<string>, attempts = 30): string {
  let candidate = generate();
  for (let i = 1; i < attempts && avoid.has(candidate); i++) {
    candidate = generate();
  }
  return candidate;
}
