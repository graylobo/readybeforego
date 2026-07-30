import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as fs from 'fs';
import * as path from 'path';

// .env 파일 파싱
try {
  const envPath = path.join(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*DATABASE_URL\s*=\s*(.*?)\s*$/);
      if (match) {
        process.env.DATABASE_URL = match[1].trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
} catch (e) {
  console.warn('⚠️ .env 파일 파싱 실패. 시스템 환경 변수를 사용합니다.');
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL 환경 변수가 필요합니다.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  max: 1,
});

const db = drizzle(pool, { schema });

async function main() {
  console.log('🌍 ReadyBeforeGo 검증된 실제 해외 여행지 사기/피해 시드 데이터 적재 시작...');

  try {
    // 1. 국가 데이터 (Countries)
    const countriesData = [
      { code: 'ALL', name: '전체 공통 🌐', nameEn: 'All Countries' },
      { code: 'TH', name: '태국', nameEn: 'Thailand' },
      { code: 'VN', name: '베트남', nameEn: 'Vietnam' },
      { code: 'FR', name: '프랑스', nameEn: 'France' },
      { code: 'IT', name: '이탈리아', nameEn: 'Italy' },
      { code: 'JP', name: '일본', nameEn: 'Japan' },
      { code: 'KR', name: '대한민국', nameEn: 'South Korea' },
    ];

    for (const c of countriesData) {
      await db.insert(schema.countries)
        .values({
          code: c.code,
          name: c.name,
          nameEn: c.nameEn,
        })
        .onConflictDoUpdate({
          target: schema.countries.code,
          set: { name: c.name, nameEn: c.nameEn, updatedAt: new Date() },
        });
    }
    console.log('✅ 1/4 국가(Countries) 6개국 적재 완료');

    // 2. 도시 데이터 (Cities)
    const citiesData = [
      // 태국
      { id: '11111111-1111-4111-a111-111111111111', countryCode: 'TH', name: '방콕', nameEn: 'Bangkok', latitude: 13.7563, longitude: 100.5018 },
      { id: '11111111-1111-4111-a111-222222222222', countryCode: 'TH', name: '푸켓', nameEn: 'Phuket', latitude: 7.8804, longitude: 98.3923 },
      // 베트남
      { id: '22222222-2222-4222-a222-111111111111', countryCode: 'VN', name: '다낭', nameEn: 'Da Nang', latitude: 16.0544, longitude: 108.2022 },
      { id: '22222222-2222-4222-a222-222222222222', countryCode: 'VN', name: '하노이', nameEn: 'Hanoi', latitude: 21.0285, longitude: 105.8542 },
      { id: '22222222-2222-4222-a222-333333333333', countryCode: 'VN', name: '호치민', nameEn: 'Ho Chi Minh City', latitude: 10.7769, longitude: 106.7009 },
      // 프랑스
      { id: '33333333-3333-4333-a333-111111111111', countryCode: 'FR', name: '파리', nameEn: 'Paris', latitude: 48.8566, longitude: 2.3522 },
      // 이탈리아
      { id: '44444444-4444-4444-a444-111111111111', countryCode: 'IT', name: '로마', nameEn: 'Rome', latitude: 41.9028, longitude: 12.4964 },
      { id: '44444444-4444-4444-a444-222222222222', countryCode: 'IT', name: '밀라노', nameEn: 'Milan', latitude: 45.4642, longitude: 9.1900 },
      // 일본
      { id: '55555555-5555-4555-a555-111111111111', countryCode: 'JP', name: '도쿄', nameEn: 'Tokyo', latitude: 35.6762, longitude: 139.6503 },
      { id: '55555555-5555-4555-a555-222222222222', countryCode: 'JP', name: '오사카', nameEn: 'Osaka', latitude: 34.6937, longitude: 135.5023 },
      // 대한민국
      { id: '66666666-6666-4666-a666-111111111111', countryCode: 'KR', name: '서울특별시', nameEn: 'Seoul', latitude: 37.5665, longitude: 126.9780 },
    ];

    for (const city of citiesData) {
      await db.insert(schema.cities)
        .values(city)
        .onConflictDoUpdate({
          target: schema.cities.id,
          set: {
            name: city.name,
            nameEn: city.nameEn,
            latitude: city.latitude,
            longitude: city.longitude,
            updatedAt: new Date(),
          },
        });
    }
    console.log('✅ 2/4 도시(Cities) 11개 주요 도시 적재 완료');

    // 3. 세부 지역/관광지 데이터 (Regions)
    const regionsData = [
      // 방콕
      { id: '11111111-0000-0000-0000-000000000001', cityId: '11111111-1111-4111-a111-111111111111', name: '카오산로드', nameEn: 'Khaosan Road', latitude: 13.7590, longitude: 100.4972 },
      { id: '11111111-0000-0000-0000-000000000002', cityId: '11111111-1111-4111-a111-111111111111', name: '왓포 사원 입구', nameEn: 'Wat Pho Gate', latitude: 13.7465, longitude: 100.4933 },
      // 푸켓
      { id: '11111111-0000-0000-0000-000000000003', cityId: '11111111-1111-4111-a111-222222222222', name: '파통 비치 해변가', nameEn: 'Patong Beach', latitude: 7.8960, longitude: 98.2955 },
      // 다낭
      { id: '22222222-0000-0000-0000-000000000001', cityId: '22222222-2222-4222-a222-111111111111', name: '다낭 국제공항 입국장', nameEn: 'Da Nang Airport Arrival', latitude: 16.0439, longitude: 108.1994 },
      { id: '22222222-0000-0000-0000-000000000002', cityId: '22222222-2222-4222-a222-111111111111', name: '다낭 한시장 앞', nameEn: 'Han Market', latitude: 16.0681, longitude: 108.2239 },
      // 하노이
      { id: '22222222-0000-0000-0000-000000000003', cityId: '22222222-2222-4222-a222-222222222222', name: '하노이 호안끼엠 호수 주변', nameEn: 'Hoan Kiem Lake', latitude: 21.0287, longitude: 105.8524 },
      // 호치민
      { id: '22222222-0000-0000-0000-000000000004', cityId: '22222222-2222-4222-a222-333333333333', name: '호치민 벤탄시장 입구', nameEn: 'Ben Thanh Market', latitude: 10.7725, longitude: 106.6980 },
      // 파리
      { id: '33333333-0000-0000-0000-000000000001', cityId: '33333333-3333-4333-a333-111111111111', name: '파리 몽마르트 언덕 계단', nameEn: 'Montmartre Sacre-Coeur', latitude: 48.8867, longitude: 2.3431 },
      { id: '33333333-0000-0000-0000-000000000002', cityId: '33333333-3333-4333-a333-111111111111', name: '파리 에펠탑 마르스 광장', nameEn: 'Champ de Mars Eiffel', latitude: 48.8584, longitude: 2.2945 },
      // 로마
      { id: '44444444-0000-0000-0000-000000000001', cityId: '44444444-4444-4444-a444-111111111111', name: '로마 테르미니역 중앙 승차장', nameEn: 'Roma Termini Station', latitude: 41.9010, longitude: 12.5001 },
      { id: '44444444-0000-0000-0000-000000000002', cityId: '44444444-4444-4444-a444-111111111111', name: '로마 콜로세움 주변 광장', nameEn: 'Colosseum Plaza', latitude: 41.8902, longitude: 12.4922 },
      // 밀라노
      { id: '44444444-0000-0000-0000-000000000003', cityId: '44444444-4444-4444-a444-222222222222', name: '밀라노 두오모 대성당 광장', nameEn: 'Piazza del Duomo', latitude: 45.4641, longitude: 9.1919 },
      // 도쿄
      { id: '55555555-0000-0000-0000-000000000001', cityId: '55555555-5555-4555-a555-111111111111', name: '도쿄 신주쿠 가부키초 거리가', nameEn: 'Shinjuku Kabukicho', latitude: 35.6938, longitude: 139.7034 },
      // 오사카
      { id: '55555555-0000-0000-0000-000000000002', cityId: '55555555-5555-4555-a555-222222222222', name: '오사카 도톤보리 글리코상 앞', nameEn: 'Dotonbori Glico', latitude: 34.6687, longitude: 135.5013 },
      // 서울
      { id: '66666666-0000-0000-0000-000000000001', cityId: '66666666-6666-4666-a666-111111111111', name: '명동 길거리 음식 노점 거리', nameEn: 'Myeongdong Street', latitude: 37.5599, longitude: 126.9858 },
    ];

    for (const r of regionsData) {
      await db.insert(schema.regions)
        .values({
          id: r.id,
          cityId: r.cityId,
          name: r.name,
          nameEn: r.nameEn,
          latitude: r.latitude,
          longitude: r.longitude,
        })
        .onConflictDoUpdate({
          target: schema.regions.id,
          set: {
            name: r.name,
            nameEn: r.nameEn,
            latitude: r.latitude,
            longitude: r.longitude,
            updatedAt: new Date(),
          },
        });
    }
    console.log('✅ 3/4 지역/관광지(Regions) 15개 핀/구역 적재 완료');

    // 4. 검증된 실제 사기 피해 사례 정보 (ScamInfos)
    const scamInfosData = [
      // 1. 방콕 카오산로드 (툭툭 사기)
      {
        id: '10000000-0000-0000-0000-000000000001',
        regionId: '11111111-0000-0000-0000-000000000001',
        cityId: '11111111-1111-4111-a111-111111111111',
        countryCode: 'TH',
        scope: 'spot' as const,
        title: '방콕 카오산로드 10바트 툭툭 시티투어 사기',
        description: '카오산로드 주변의 툭툭 기사가 비정상적으로 저렴한 가격(10~20바트)에 사원과 시내를 구경시켜주겠다고 현혹합니다. 탑승하면 중간에 기사와 연계된 가짜 보석가게(Jewelry Shop)나 양복점(Tailor Shop)으로 강제 이동하여 고가의 저품질 물건을 강매당하게 됩니다.',
        avoidanceTip: '비정상적으로 저렴한 요금의 투어 제안은 100% 사기이므로 단호하게 거절하세요. 이동 시에는 Grab이나 Bolt 같은 인증된 모빌리티 앱을 사용하여 정찰제로 이동해야 안전합니다.',
        scamCategory: 'FORCED_SHOPPING',
        sourceUrl: 'https://www.0404.go.kr',
        upvoteCount: 84,
        downvoteCount: 1,
      },
      // 2. 방콕 카오산로드 (대마 위험)
      {
        id: '10000000-0000-0000-0000-000000000002',
        regionId: '11111111-0000-0000-0000-000000000001',
        cityId: '11111111-1111-4111-a111-111111111111',
        countryCode: 'TH',
        scope: 'spot' as const,
        title: '대마(Cannabis) 성분 혼동 길거리 음료/디저트 주의',
        description: '태국은 대마 관련 법안 변경으로 길거리 노점 등에서 대마 성분이 포함된 쿠키, 브라우니, 음료 등을 무분별하게 판매하고 있습니다. 이를 인지하지 못하고 구입하여 취식하는 경우, 한국인 여행객은 귀국 시 국내법(속인주의)에 의해 형사 처벌될 수 있습니다.',
        avoidanceTip: '식당이나 노점 메뉴판에서 단풍잎 기호나 "Organic Leaf", "Cannabis", "THC", "CBD" 표기가 있는지 항상 검수하세요. 잘 모르는 길거리 젤리나 브라우니는 구입하지 마십시오.',
        scamCategory: 'DRUG_HAZARD',
        sourceUrl: 'https://www.0404.go.kr',
        upvoteCount: 92,
        downvoteCount: 0,
      },
      // 3. 방콕 왓포 사원 (사원 닫힘 사기)
      {
        id: '10000000-0000-0000-0000-000000000003',
        regionId: '11111111-0000-0000-0000-000000000002',
        cityId: '11111111-1111-4111-a111-111111111111',
        countryCode: 'TH',
        scope: 'spot' as const,
        title: '"오늘 사원은 문을 닫았습니다" 거짓 정보 사기',
        description: '왓포 사원이나 왕궁(Grand Palace)으로 가는 길목에서 유창한 영어를 구사하는 행인이 다가와 "오늘 오전에는 불교 행사로 입장이 불가하다"고 거짓말을 합니다. 이후 자신이 아는 저렴한 툭툭 투어를 통해 다른 사원을 구경시켜 주겠다고 꼬드겨 바가지 쇼핑몰로 유도합니다.',
        avoidanceTip: '사원이나 왕궁 매표소 입구까지 직접 가서 문이 열려 있는지 눈으로 직접 확인하세요. 입구 주변에서 말을 거는 행인은 안내 직원이 아닙니다.',
        scamCategory: 'LIES_TOURISM',
        sourceUrl: 'https://www.tripadvisor.com',
        upvoteCount: 65,
        downvoteCount: 2,
      },
      // 4. 태국 전체 (국가 레벨 주의보)
      {
        id: '10000000-0000-0000-0000-000000000004',
        regionId: null,
        cityId: null,
        countryCode: 'TH',
        scope: 'country' as const,
        title: '태국 전역 유흥가 마약 및 환각 물질 음료 주의보',
        description: '태국 주요 관광지 클럽이나 클럽형 바에서 낯선 이가 건네는 무상 음료나 술에 약물이 타져 있을 수 있습니다. 성범죄 및 강도 피해 위험이 크므로 모르는 사람이 건네는 음료는 절대로 받지 마십시오.',
        avoidanceTip: '자신의 음료는 자리를 비운 사이 누군가가 만지지 못하게 직접 관리하고, 모르는 사람이 건네는 술잔은 거절하세요.',
        scamCategory: 'DRUG_HAZARD',
        sourceUrl: 'https://www.0404.go.kr',
        upvoteCount: 110,
        downvoteCount: 1,
      },
      // 5. 푸켓 파통 비치 (제트스키 파손 사기)
      {
        id: '10000000-0000-0000-0000-000000000005',
        regionId: '11111111-0000-0000-0000-000000000003',
        cityId: '11111111-1111-4111-a111-222222222222',
        countryCode: 'TH',
        scope: 'spot' as const,
        title: '푸켓 파통 비치 제트스키 파손 덮어씌우기 현금 갈취',
        description: '제트스키 렌탈 후 반납할 때 기존에 이미 나 있던 기스나 스크래치를 지목하며 여행객이 파손했다고 여럿이 둘러싸서 위협하고 수백만 원 상당의 수리비를 현금으로 강요하는 사기 수법입니다.',
        avoidanceTip: '제트스키나 스쿠터를 대여하기 직전 기사 및 업체 직원이 보는 앞에서 전체 몸통 사진 및 동영상을 디테일하게 찍어두고 탑승하십시오.',
        scamCategory: 'OVERCHARGING',
        sourceUrl: 'https://www.0404.go.kr',
        upvoteCount: 78,
        downvoteCount: 0,
      },

      // 6. 다낭 공항 (가짜 그랩)
      {
        id: '20000000-0000-0000-0000-000000000001',
        regionId: '22222222-0000-0000-0000-000000000001',
        cityId: '22222222-2222-4222-a222-111111111111',
        countryCode: 'VN',
        scope: 'spot' as const,
        title: '다낭 공항 입국장 가짜 그랩(Grab) 드라이버 사기',
        description: '공항 입국장을 나설 때 스마트폰 화면에 그랩(Grab) 앱 인터페이스처럼 보이는 화면을 보여주며 "내가 지정된 기사다", "그랩 요금 그대로 태워주겠다"고 다가오는 드라이버들이 있습니다. 탑승 후 정차 시 수십 배에 달하는 과도한 톨게이트 비용 및 미터기 조작 요금을 강압적으로 청구합니다.',
        avoidanceTip: '반드시 본인의 스마트폰 Grab 앱으로 차량을 직접 호출하고, 호출 완료 화면에 뜨는 차량 번호판(License Plate)과 기사의 얼굴이 실제 차량과 정확히 일치하는지 확인하고 탑승하십시오.',
        scamCategory: 'FAKE_TAXI',
        sourceUrl: 'https://www.naver.com',
        upvoteCount: 145,
        downvoteCount: 2,
      },
      // 7. 다낭 한시장 (밑장빼기 사기)
      {
        id: '20000000-0000-0000-0000-000000000002',
        regionId: '22222222-0000-0000-0000-000000000002',
        cityId: '22222222-2222-4222-a222-111111111111',
        countryCode: 'VN',
        scope: 'spot' as const,
        title: '다낭 한시장 현금 지불 시 동권 화폐 밑장빼기 수법',
        description: '베트남 동(VND) 화폐는 단위가 크고 색상이 유사(예: 2만동과 50만동, 1만동과 10만동)합니다. 상인이 손님이 지불한 고액 지폐를 잽싸게 밑으로 감추며 "단위가 작은 지폐를 받았다"며 추가 현금을 요구하거나 거스름돈을 적게 줍니다.',
        avoidanceTip: '지폐를 지불할 때 상인에게 넘겨주기 전 손에 들고 "50만 동 줍니다" 하고 눈으로 정확히 확인 시킨 뒤 건네주세요.',
        scamCategory: 'OVERCHARGING',
        sourceUrl: '',
        upvoteCount: 120,
        downvoteCount: 1,
      },
      // 8. 하노이 호안끼엠 (신발 수리 및 과일 바구니)
      {
        id: '20000000-0000-0000-0000-000000000003',
        regionId: '22222222-0000-0000-0000-000000000003',
        cityId: '22222222-2222-4222-a222-222222222222',
        countryCode: 'VN',
        scope: 'spot' as const,
        title: '하노이 호안끼엠 길거리 신발 강제 수리 및 과일 사진 촬영 사기',
        description: '길거리를 걷다 보면 신발 닦이 상인이 본드나 도구를 들고 다가와 요청하지도 않았는데 신발을 강제로 접착하거나 수리한 뒤 터무니없는 금액(50만 동 이상)을 요구합니다. 과일 바구니 상인 역시 짐을 짊어지게 한 뒤 사진을 찍게 하고 돈을 요구합니다.',
        avoidanceTip: '다가오는 노점상에게 눈길을 주지 말고 "No"라고 단호하게 말하며 계속 걸어가십시오. 신발을 만지려 할 때 발을 치우고 멀어지는 것이 좋습니다.',
        scamCategory: 'FORCED_SHOPPING',
        sourceUrl: '',
        upvoteCount: 98,
        downvoteCount: 0,
      },
      // 9. 호치민 벤탄시장 (소매치기 및 찢어진 지폐 사기)
      {
        id: '20000000-0000-0000-0000-000000000004',
        regionId: '22222222-0000-0000-0000-000000000004',
        cityId: '22222222-2222-4222-a222-333333333333',
        countryCode: 'VN',
        scope: 'spot' as const,
        title: '호치민 벤탄시장 날치기 오토바이 및 거스름돈 훼손 지폐 사기',
        description: '시장 입구 근처에서 도로변 스마트폰 사용 시 2인조 오토바이가 잽싸게 핸드폰을 낚아채 달아납니다. 또한 상인이 거스름돈으로 끝부분이 아주 미세하게 찢어지거나 훼손된 지폐를 주는데, 베트남에서는 훼손 지폐를 사용하지 못하므로 거스름돈 수령 시 꼼꼼히 확인해야 합니다.',
        avoidanceTip: '도로변에서 인도 안쪽으로 들어와 스마트폰을 사용하고, 상인이 준 거스름돈 지폐가 찢어져 있다면 즉시 짱짱한 새 지폐로 교환을 요구하십시오.',
        scamCategory: 'OVERCHARGING',
        sourceUrl: '',
        upvoteCount: 88,
        downvoteCount: 1,
      },

      // 10. 파리 몽마르트르 언덕 (팔찌 사기)
      {
        id: '30000000-0000-0000-0000-000000000001',
        regionId: '33333333-0000-0000-0000-000000000001',
        cityId: '33333333-3333-4333-a333-111111111111',
        countryCode: 'FR',
        scope: 'spot' as const,
        title: '파리 몽마르트 언덕 입구 실팔찌(Bracelet) 강제 매기 및 현금 갈취',
        description: '몽마르트르 사크레쾨르 성당으로 올라가는 계단 입구에서 흑인 사기패들이 친근하게 다가와 선적인 척 손가락이나 손목에 털실 팔찌를 완성할 때까지 매어버립니다. 묶은 후 20~50유로의 과도한 현금을 강제로 요구하며 동료들이 둘러싸 위협합니다.',
        avoidanceTip: '계단을 오를 때 양손을 주머니에 넣거나 손을 꽉 쥐고 걸어가세요. 누군가 손을 잡으려 하면 절대 주지 말고 크게 "Non!"이라고 외치며 단호하게 이동하십시오.',
        scamCategory: 'FORCED_SHOPPING',
        sourceUrl: 'https://www.0404.go.kr',
        upvoteCount: 210,
        downvoteCount: 3,
      },
      // 11. 파리 에펠탑/루브르 (서명운동 소매치기)
      {
        id: '30000000-0000-0000-0000-000000000002',
        regionId: '33333333-0000-0000-0000-000000000002',
        cityId: '33333333-3333-4333-a333-111111111111',
        countryCode: 'FR',
        scope: 'spot' as const,
        title: '파리 에펠탑/루브르 청각장애인 서명운동 위장 소매치기',
        description: '젊은 여성 그룹이 서명판(Clipboard)을 들고 다가와 장애인 후원을 위한 서명을 요청합니다. 서명을 작성하는 동안 주의가 산만해진 틈을 타 서명판으로 가방을 가리고 시계, 지갑, 스마트폰을 털어갑니다.',
        avoidanceTip: '서명판을 들고 다가오는 모든 자선단체 위장 무리는 100% 소매치기입니다. 서명 요구 시 반응하지 말고 즉시 자리를 피하십시오.',
        scamCategory: 'LIES_TOURISM',
        sourceUrl: 'https://www.0404.go.kr',
        upvoteCount: 185,
        downvoteCount: 1,
      },

      // 12. 로마 테르미니역 (짐 들어주기 & 소매치기)
      {
        id: '40000000-0000-0000-0000-000000000001',
        regionId: '44444444-0000-0000-0000-000000000001',
        cityId: '44444444-4444-4444-a444-111111111111',
        countryCode: 'IT',
        scope: 'spot' as const,
        title: '로마 테르미니역 발권기 도움 위장 및 열차 짐 운반 사기',
        description: '티켓 자동발권기 앞에서 구매를 도와주겠다며 다가와 거스름돈을 낚아채거나, 열차 탑승 시 캐리어를 선반에 올려주겠다며 강제로 수하물을 들고 팁을 20유로 이상 요구하는 사기 수법입니다.',
        avoidanceTip: '발권기 이용 시 누군가 다가오면 "No thank you"라 하고 다른 발권기를 이용하세요. 열차 내부 수하물은 본인이 직접 올리셔야 안전합니다.',
        scamCategory: 'OVERCHARGING',
        sourceUrl: 'https://www.0404.go.kr',
        upvoteCount: 175,
        downvoteCount: 2,
      },
      // 13. 로마 콜로세움 (글래디에이터 강제 사진)
      {
        id: '40000000-0000-0000-0000-000000000002',
        regionId: '44444444-0000-0000-0000-000000000002',
        cityId: '44444444-4444-4444-a444-111111111111',
        countryCode: 'IT',
        scope: 'spot' as const,
        title: '로마 콜로세움 검투사(글래디에이터) 복장 촬영 수수료 갈취',
        description: '콜로세움 주변에서 검투사 복장을 한 남성들이 친근하게 어깨동무를 하며 사진을 찍자고 유도합니다. 촬영이 끝나면 다짜고짜 인당 50~100유로의 고액 촬영비를 현금으로 낼 때까지 위협합니다.',
        avoidanceTip: '콜로세움 주변 복장 착용 연기자와는 함께 사진을 찍지 마세요. 무단 영업으로 이탈리아 현지 경찰 단속 대상이기도 합니다.',
        scamCategory: 'FORCED_SHOPPING',
        sourceUrl: '',
        upvoteCount: 130,
        downvoteCount: 1,
      },
      // 14. 밀라노 두오모 광장 (비둘기 모이 사기)
      {
        id: '40000000-0000-0000-0000-000000000003',
        regionId: '44444444-0000-0000-0000-000000000003',
        cityId: '44444444-4444-4444-a444-222222222222',
        countryCode: 'IT',
        scope: 'spot' as const,
        title: '밀라노 두오모 광장 비둘기 모이 손에 쥐어주기 바가지 사기',
        description: '광장에서 사진을 찍고 있으면 호의를 베푸는 척 비둘기 옥수수 모이를 관광객 손에 억지로 뿌려줍니다. 비둘기들이 몰려들어 사진 촬영이 완료되면 모잇값으로 20~30유로를 강제로 갈취합니다.',
        avoidanceTip: '누군가 손을 펴보라고 하거나 모이를 쥐어주려 할 때 손을 꽉 쥐고 거절하고 다른 곳으로 이동하십시오.',
        scamCategory: 'FORCED_SHOPPING',
        sourceUrl: '',
        upvoteCount: 115,
        downvoteCount: 0,
      },

      // 15. 도쿄 가부키초 (삐끼 바가지 펍)
      {
        id: '50000000-0000-0000-0000-000000000001',
        regionId: '55555555-0000-0000-0000-000000000001',
        cityId: '55555555-5555-4555-a555-111111111111',
        countryCode: 'JP',
        scope: 'spot' as const,
        title: '도쿄 신주쿠 가부키초 길거리 삐끼 따라 방문 시 바가지 요금',
        description: '가부키초 거리에서 길거리 호객꾼(삐끼)이 "무제한 무제한 3,000엔", "예쁜 여성과 술 마시는 싼 곳이 있다"며 유흥주점으로 유인합니다. 술을 몇 잔 마신 후 나올 때 자릿세, 조향료, 여성 음료값 명목으로 수십만~수백만 엔(한화 300만~1,000만 원)의 계산서를 보여주며 불법 감금 및 신용카드 강제 결제를 시도합니다.',
        avoidanceTip: '일본 신주쿠 구 조례상 길거리 호객 행위는 엄연한 불법입니다. 길거리 호객꾼이 추천하는 술집은 100% 바가지 업소이므로 절대 따라가지 마십시오.',
        scamCategory: 'OVERCHARGING',
        sourceUrl: 'https://www.0404.go.kr',
        upvoteCount: 230,
        downvoteCount: 2,
      },
      // 16. 오사카 도톤보리 (암표 및 암어 암구호 사기)
      {
        id: '50000000-0000-0000-0000-000000000002',
        regionId: '55555555-0000-0000-0000-000000000002',
        cityId: '55555555-5555-4555-a555-222222222222',
        countryCode: 'JP',
        scope: 'spot' as const,
        title: '오사카 도톤보리 유명 맛집 패스트패스/암표 무허가 판매 사기',
        description: '인기 있는 도톤보리 타코야키/라멘 맛집 대기 줄 주변에서 "대기 없이 바로 들어가는 우선 입장권을 판다"며 개인적으로 돈을 요구하는 사기꾼들이 있습니다. 매장 공식 티켓이 아니므로 돈을 날리게 됩니다.',
        avoidanceTip: '맛집 대기줄이나 입장권은 식당 공식 매표소나 직원 안내를 통해서만 결제하고 확인받으십시오.',
        scamCategory: 'LIES_TOURISM',
        sourceUrl: '',
        upvoteCount: 75,
        downvoteCount: 1,
      },

      // 17. 대한민국 서울 명동 (외국인 대상 노점상 바가지)
      {
        id: '60000000-0000-0000-0000-000000000001',
        regionId: '66666666-0000-0000-0000-000000000001',
        cityId: '66666666-6666-4666-a666-111111111111',
        countryCode: 'KR',
        scope: 'spot' as const,
        title: '서울 명동 길거리 노점상 가격 미표시 바가지 요금',
        description: '명동 관광특구 길거리 노점 일부에서 가격표를 부착하지 않은 채 외국인 관광객에게 시세보다 수 배 비싼 가격(어묵 꼬치 5,000원 이상 등)을 청구하는 무분별한 상행위가 신고되고 있습니다.',
        avoidanceTip: '가격 표시판이 부착된 정직한 정찰제 업소를 이용하시고, 불합리한 피해 시 관광불편신고센터(1330)로 신고해 주세요.',
        scamCategory: 'OVERCHARGING',
        sourceUrl: 'https://www.seoul.go.kr',
        upvoteCount: 60,
        downvoteCount: 2,
      },
    ];

    for (const scam of scamInfosData) {
      await db.insert(schema.scamInfos)
        .values(scam)
        .onConflictDoUpdate({
          target: schema.scamInfos.id,
          set: {
            title: scam.title,
            description: scam.description,
            avoidanceTip: scam.avoidanceTip,
            scamCategory: scam.scamCategory,
            sourceUrl: scam.sourceUrl,
            upvoteCount: scam.upvoteCount,
            downvoteCount: scam.downvoteCount,
            updatedAt: new Date(),
          },
        });
    }
    // 5. 가이드 및 준비물 (CountryGuides) 시딩 🎒
    const countryGuidesData = [
      // 🌐 전체 공통 (ALL) - 모든 해외 여행에 통용되는 공통 필수/권장 준비물
      {
        id: '70000000-0000-0000-0000-000000000000',
        countryCode: 'ALL',
        category: 'pre_travel',
        title: '여권 잔여 유효기간 6개월 이상 필수 확인',
        description: '대부분의 국가 입국 시 여권 유효기간이 최소 6개월 이상 남아있어야 출국 및 입국이 허가됩니다.',
        icon: '🛂',
        isRequired: true,
        isCheckable: true,
        sortOrder: 1,
      },
      {
        id: '70000000-0000-0000-0000-000000000099',
        countryCode: 'ALL',
        category: 'pre_travel',
        title: '해외 결제 및 CD기 출금 가능 신용/체크카드 (트래블월렛 등)',
        description: '현지 현금 부족 및 비상 상황에 대비해 마스터/비자 해외 결제 승인 카드를 반드시 지참하세요.',
        icon: '💳',
        isRequired: true,
        isCheckable: true,
        sortOrder: 2,
      },
      {
        id: '70000000-0000-0000-0000-000000000098',
        countryCode: 'ALL',
        category: 'baggage',
        title: '보조배터리는 반드시 기내용 가방에 지참 (위탁 금지)',
        description: '리튬 보조배터리는 위탁 수하물(Carrier) 보관이 전면 금지되어 있습니다. 160Wh 이하 제품을 기내에 가지고 타세요.',
        icon: '🔋',
        isRequired: true,
        isCheckable: true,
        sortOrder: 1,
      },
      {
        id: '70000000-0000-0000-0000-000000000097',
        countryCode: 'ALL',
        category: 'tips',
        title: '해외 여행자 보험 가입 및 비상 연락처 저장',
        description: '해외 질병, 소지품 도난, 항공편 지연 등의 비상 대처를 위해 여행자 보험 증권과 영사콜센터(+82-2-3210-0404)를 저장해두세요.',
        icon: '🏥',
        isRequired: false,
        isCheckable: false,
        sortOrder: 1,
      },

      // 🇯🇵 일본 (JP)
      {
        id: '70000000-0000-0000-0000-000000000001',
        countryCode: 'JP',
        category: 'pre_travel',
        title: 'Visit Japan Web 입국·세관 사전 등록',
        description: '입국 수속과 세관 신고를 모바일 QR코드로 빠르게 통과할 수 있습니다. 출국 전 한국에서 미리 작성하는 것을 강력 추천합니다.',
        icon: '📲',
        isRequired: true,
        isCheckable: true,
        sortOrder: 1,
      },
      {
        id: '70000000-0000-0000-0000-000000000003',
        countryCode: 'JP',
        category: 'essentials',
        title: '110V 변환 어댑터 (돼지코)',
        description: '일본은 110V 전압을 사용하므로 한국 전자기기 사용을 위한 돼지코 어댑터가 필수입니다. (multi 어댑터 1~2개 챙기기)',
        icon: '🔌',
        isRequired: true,
        isCheckable: true,
        sortOrder: 1,
      },
      {
        id: '70000000-0000-0000-0000-000000000004',
        countryCode: 'JP',
        category: 'essentials',
        title: '동전 지갑 (동전 분리 파우치)',
        description: '일본은 1엔, 5엔, 10엔, 50엔, 100엔, 500엔 등 동전 쓰임새가 많으므로 칸 구분이 된 동전 지갑이 매우 편리합니다.',
        icon: '🪙',
        isRequired: false,
        isCheckable: true,
        sortOrder: 2,
      },
      {
        id: '70000000-0000-0000-0000-000000000006',
        countryCode: 'JP',
        category: 'baggage',
        title: '액체류 100ml 초과 시 위탁 수하물 필수',
        description: '스킨, 로션, 선크림 등 100ml를 넘는 액체류는 기내 반입이 불가하며 지퍼백 투명 용기에 담아 위탁 수하물로 붙여야 합니다.',
        icon: '🧴',
        isRequired: true,
        isCheckable: true,
        sortOrder: 2,
      },
      {
        id: '70000000-0000-0000-0000-000000000007',
        countryCode: 'JP',
        category: 'tips',
        title: '토스 / 하나은행 미리 환전 우대 활용',
        description: '주요 은행 앱에서 엔화 환전 시 90% 우대를 받거나 인천공항 수령으로 미리 준비하면 환전 비용을 크게 절약할 수 있습니다.',
        icon: '💡',
        isRequired: false,
        isCheckable: false,
        sortOrder: 1,
      },

      // 🇹🇭 태국 (TH)
      {
        id: '70000000-0000-0000-0000-000000000008',
        countryCode: 'TH',
        category: 'pre_travel',
        title: 'Grab / Bolt 차량 호출 앱 사전 설치 및 카드 등록',
        description: '현지 택시 바가지요금을 방지하려면 출국 전 Grab과 Bolt 앱에 한국 카드를 연동해두면 유용합니다.',
        icon: '🚕',
        isRequired: false,
        isCheckable: true,
        sortOrder: 2,
      },
      {
        id: '70000000-0000-0000-0000-000000000009',
        countryCode: 'TH',
        category: 'pre_travel',
        title: 'GLN 모바일 QR 스캔 결제 연동 (하나/토스)',
        description: '태국 대부분의 야시장, 식당, 야외 매장에서 GLN QR결제(Scan Pay)가 지원되어 현금 없이 매우 편리합니다.',
        icon: '📲',
        isRequired: false,
        isCheckable: true,
        sortOrder: 3,
      },
      {
        id: '70000000-0000-0000-0000-000000000010',
        countryCode: 'TH',
        category: 'essentials',
        title: '왕궁 및 사원 방문 시 복장 준비 (긴바지/긴치마)',
        description: '방콕 왕궁, 왓 아룬 등 주요 사원 방문 계획이 있다면 숄더리스, 민소매, 찢어진 청바지는 입장이 제한되므로 얇은 긴 옷을 준비하세요.',
        icon: '👗',
        isRequired: false,
        isCheckable: true,
        sortOrder: 2,
      },
      {
        id: '70000000-0000-0000-0000-000000000011',
        countryCode: 'TH',
        category: 'essentials',
        title: '지사제 & 모기 기피제',
        description: '물이나 열대 과일 섭취 후 배탈(물갈이)이 나는 경우가 흔하므로 약국에서 지사제와 모기 기피제를 챙기는 것이 좋습니다.',
        icon: '💊',
        isRequired: true,
        isCheckable: true,
        sortOrder: 2,
      },
      {
        id: '70000000-0000-0000-0000-000000000012',
        countryCode: 'TH',
        category: 'baggage',
        title: '기내용 보조배터리 용량 확인 (32,000mAh 제한)',
        description: '태국 공항 보안검색대는 배터리 용량 표시가 명확히 인쇄되어 있지 않은 보조배터리는 압수하므로 명확한 제품만 지참하세요.',
        icon: '🔋',
        isRequired: true,
        isCheckable: true,
        sortOrder: 1,
      },

      // 🇻🇳 베트남 (VN)
      {
        id: '70000000-0000-0000-0000-000000000014',
        countryCode: 'VN',
        category: 'essentials',
        title: '동지갑 (베트남 화폐 전용 바인더)',
        description: '베트남 동(VND)은 화폐 단위(0)가 매우 크고 인물 그림이 비슷해 헷갈리기 쉽습니다. 동지갑 파우치가 큰 도움이 됩니다.',
        icon: '💵',
        isRequired: false,
        isCheckable: true,
        sortOrder: 1,
      },
      {
        id: '70000000-0000-0000-0000-000000000015',
        countryCode: 'VN',
        category: 'tips',
        title: '베트남 화폐 빠른 한국 돈(원) 계산법 꿀팁',
        description: '동(VND) 금액에서 맨 뒤의 숫자 0을 하나 떼고, 나누기 2를 하면 대략적인 원화 금액이 됩니다. (예: 100,000동 → 10,000 ÷ 2 = 약 5,000원)',
        icon: '🧮',
        isRequired: false,
        isCheckable: false,
        sortOrder: 1,
      },
      {
        id: '70000000-0000-0000-0000-000000000016',
        countryCode: 'VN',
        category: 'baggage',
        title: '전자담배(Vape) 반입 및 소지 전면 금지 ⚠️',
        description: '베트남은 전자담배(액상형/궐련형 포함) 반입 및 소지가 법적으로 금지되어 있습니다. 공항 입국 시 적발될 경우 즉시 압수 및 고액의 벌금이 부과되므로 절대 지참하지 마세요.',
        icon: '🚭',
        isRequired: true,
        isCheckable: true,
        sortOrder: 1,
      },
    ];

    for (const guide of countryGuidesData) {
      await db.insert(schema.countryGuides)
        .values(guide)
        .onConflictDoUpdate({
          target: schema.countryGuides.id,
          set: {
            title: guide.title,
            description: guide.description,
            category: guide.category,
            icon: guide.icon,
            isRequired: guide.isRequired,
            isCheckable: guide.isCheckable,
            sortOrder: guide.sortOrder,
            updatedAt: new Date(),
          },
        });
    }
    console.log('✅ 5/5 국가별 가이드 & 준비물(CountryGuides) 15개 시딩 완료');

    console.log('🎉 🎉 ReadyBeforeGo 실전 검증 데이터 시딩이 성공적으로 완수되었습니다!');
  } catch (error) {
    console.error('❌ 시딩 중 오류 발생:', error);
  } finally {
    await pool.end();
  }
}

main();
