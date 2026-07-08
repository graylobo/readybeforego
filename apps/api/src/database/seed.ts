import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as fs from 'fs';
import * as path from 'path';

// .env 파일 직접 파싱 (의존성 패키지 사용 안 함)
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
  console.warn('⚠️ .env 파일을 파싱하는 데 실패했습니다. 시스템 환경 변수를 사용합니다.');
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  max: 1,
});

const db = drizzle(pool, { schema });

async function main() {
  console.log('🌱 Hogaengno 데이터베이스 초기 뼈대 데이터(Seed Data) 적재 시작...');

  try {
    const countriesData = [
      { code: 'TH', name: '태국', nameEn: 'Thailand' },
      { code: 'VN', name: '베트남', nameEn: 'Vietnam' },
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
    console.log('✅ 국가 데이터 적재 완료');

    const citiesData = [
      {
        id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        countryCode: 'TH',
        name: '방콕',
        nameEn: 'Bangkok',
        latitude: 13.7563,
        longitude: 100.5018,
      },
      {
        id: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
        countryCode: 'TH',
        name: '치앙마이',
        nameEn: 'Chiang Mai',
        latitude: 18.7883,
        longitude: 98.9853,
      },
      {
        id: 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
        countryCode: 'VN',
        name: '다낭',
        nameEn: 'Da Nang',
        latitude: 16.0544,
        longitude: 108.2022,
      },
      {
        id: 'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
        countryCode: 'KR',
        name: '서울',
        nameEn: 'Seoul',
        latitude: 37.5665,
        longitude: 126.9780,
      },
    ];

    for (const city of citiesData) {
      await db.insert(schema.cities)
        .values({
          id: city.id,
          countryCode: city.countryCode,
          name: city.name,
          nameEn: city.nameEn,
          latitude: city.latitude,
          longitude: city.longitude,
        })
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
    console.log('✅ 도시 데이터 적재 완료');

    const regionsData = [
      {
        id: 'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
        cityId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        name: '카오산로드',
        nameEn: 'Khaosan Road',
        latitude: 13.7590,
        longitude: 100.4972,
      },
      {
        id: 'f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c',
        cityId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        name: '왓포 사원',
        nameEn: 'Wat Pho',
        latitude: 13.7465,
        longitude: 100.4933,
      },
      {
        id: 'a7b8c9d0-e1f2-3a4b-5c6d-7e8f9a0b1c2d',
        cityId: 'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
        name: '다낭 국제공항',
        nameEn: 'Da Nang Airport',
        latitude: 16.0439,
        longitude: 108.1994,
      },
      {
        id: 'b8c9d0e1-f2a3-4b5c-6d7e-8f9a0b1c2d3e',
        cityId: 'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
        name: '명동',
        nameEn: 'Myeongdong',
        latitude: 37.5599,
        longitude: 126.9858,
      },
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
    console.log('✅ 지역 데이터 적재 완료');

    const scamInfosData = [
      {
        id: '7c8d9e0f-1a2b-3c4d-5e6f-7a8b9c0d1e2f',
        regionId: 'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
        title: '툭툭 10바트 시티투어 사기',
        description: '카오산로드 주변의 툭툭 기사가 비정상적으로 저렴한 가격(10~20바트)에 사원과 시내를 구경시켜주겠다고 현혹합니다. 탑승하면 중간에 기사와 연계된 가짜 보석가게(Jewelry Shop)나 양복점(Tailor Shop)으로 강제 이동하여 고가의 저품질 물건을 강매당하게 됩니다.',
        avoidanceTip: '비정상적으로 저렴한 요금의 투어 제안은 100% 사기이므로 단호하게 거절하세요. 이동 시에는 Grab 이나 Bolt 같은 인증된 모빌리티 앱을 사용하여 정찰제로 이동해야 안전합니다.',
        scamCategory: 'FORCED_SHOPPING',
        sourceUrl: 'https://www.reddit.com/r/travel/comments/scam_tuktuk_bangkok',
        upvoteCount: 42,
        downvoteCount: 1,
      },
      {
        id: '8d9e0f1a-2b3c-4d5e-6f7a-8b9c0d1e2f3a',
        regionId: 'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
        title: '대마(Cannabis) 성분 혼동 식품 호객 주의',
        description: '태국은 의료용 대마가 합법화되면서 길거리 노점 등에서 대마 성분이 포함된 쿠키, 브라우니, 음료 등을 무분별하게 판매하고 있습니다. 이를 인지하지 못하고 구입하여 취식하는 경우, 한국인 여행객은 귀국 시 국내법(속인주의)에 의해 형사 처벌될 수 있습니다. 대마 표시(단풍잎 모양 혹은 Cannabis/Marijuana 표기)가 있는 제품을 철저히 피해가야 합니다.',
        avoidanceTip: '식당이나 노점 메뉴판에서 단풍잎 기호나 "Organic Leaf", "Cannabis", "THC", "CBD" 표기가 있는지 항상 검수하세요. 잘 모르는 길거리 젤리나 브라우니는 구입하지 마십시오.',
        scamCategory: 'DRUG_HAZARD',
        sourceUrl: '',
        upvoteCount: 38,
        downvoteCount: 0,
      },
      {
        id: '9e0f1a2b-3c4d-5e6f-7a8b-9c0d1e2f3a4b',
        regionId: 'f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c',
        title: '"오늘 사원은 문을 닫았습니다" 거짓 정보 사기',
        description: '왓포 사원이나 왕궁(Grand Palace)으로 가는 길목에서 유창한 영어를 구사하는 태국인이 다가와 "오늘 오전에는 불교 공식 행사(또는 청소)가 있어서 사원에 입장할 수 없다"고 거짓말을 합니다. 이후 호의를 베푸는 척하며 자신이 아는 저렴한 툭툭 투어를 통해 다른 사원을 구경시켜 주겠다고 꼬드겨 쇼핑몰 등으로 낙치 및 강매를 시도합니다.',
        avoidanceTip: '사원이나 왕궁 매표소 입구까지 직접 가서 문이 열려 있는지 눈으로 직접 확인하세요. 입구 주변에서 말을 거는 행인은 안내 직원이 아닙니다.',
        scamCategory: 'LIES_TOURISM',
        sourceUrl: 'https://www.tripadvisor.com/ShowTopic-g293916-i9587-k1028373-Grand_palace_closed_scam-Bangkok.html',
        upvoteCount: 29,
        downvoteCount: 2,
      },
      {
        id: '0f1a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c',
        regionId: 'a7b8c9d0-e1f2-3a4b-5c6d-7e8f9a0b1c2d',
        title: '다낭 공항 가짜 그랩(Grab) 드라이버 사기',
        description: '공항 입국장을 나설 때 스마트폰 화면에 그랩(Grab) 앱 인터페이스처럼 보이는 화면을 보여주며 "내가 지정된 기사다", "그랩 요금 그대로 태워주겠다"고 다가오는 드라이버들이 있습니다. 차량에 타면 미터기를 켜지 않거나 조작하여, 목적지 도착 후 수십 배에 달하는 과도한 톨게이트 비용 및 요금을 강압적으로 청구합니다.',
        avoidanceTip: '반드시 본인의 스마트폰 Grab 앱으로 차량을 직접 호출하고, 호출 완료 화면에 뜨는 차량 번호판(License Plate)과 기사의 얼굴이 실제 차량과 정확히 일치하는지 확인하고 탑승하십시오.',
        scamCategory: 'FAKE_TAXI',
        sourceUrl: '',
        upvoteCount: 55,
        downvoteCount: 0,
      },
      {
        id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
        regionId: 'b8c9d0e1-f2a3-4b5c-6d7e-8f9a0b1c2d3e',
        title: '외국인 대상 명동 노점상 음식 가격 바가지',
        description: '명동 길거리 노점상에서 판매하는 길거리 음식(어묵, 꼬치, 회오리감자 등) 중 일부 노점이 가격표를 명시하지 않고 손님의 국적에 따라 터무니없이 높은 가격(정가의 3~5배)을 청구하는 상행위가 종종 발생합니다. 한글 가격표와 외국어 가격표가 다르게 책정되거나 바가지를 씌우는 식입니다.',
        avoidanceTip: '구매 전 반드시 음식의 가격표를 확인하고, 가격표가 명시되지 않은 노점에서의 구매는 지양하십시오. 불합리한 피해를 입었을 경우 다산콜센터(120)나 관광불편신고센터에 제보할 수 있습니다.',
        scamCategory: 'OVERCHARGING',
        sourceUrl: '',
        upvoteCount: 18,
        downvoteCount: 3,
      },
    ];

    for (const scam of scamInfosData) {
      await db.insert(schema.scamInfos)
        .values({
          id: scam.id,
          regionId: scam.regionId,
          title: scam.title,
          description: scam.description,
          avoidanceTip: scam.avoidanceTip,
          scamCategory: scam.scamCategory,
          sourceUrl: scam.sourceUrl,
          upvoteCount: scam.upvoteCount,
          downvoteCount: scam.downvoteCount,
        })
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
    console.log('✅ 사기 정보 경보 데이터 적재 완료');

    console.log('🎉 Hogaengno 데이터베이스 시딩이 성공적으로 완료되었습니다!');
  } catch (error) {
    console.error('❌ 시딩 중 오류 발생:', error);
  } finally {
    await pool.end();
  }
}

main();
