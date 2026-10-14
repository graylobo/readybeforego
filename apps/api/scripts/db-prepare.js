/**
 * drizzle-kit push 전에 실행: push가 만들 수 없는 것들을 먼저 준비한다 (여러 번 실행해도 안전)
 *
 * 1. pg_trgm 확장: 게시글 검색(부분 일치) 인덱스(gin_trgm_ops)에 필요
 * 2. 중복 반응/스크랩 정리: 고유 인덱스를 만들기 전에 같은 사람의 중복 행을 하나만 남긴다
 */
const { Client } = require('pg');

try {
  process.loadEnvFile('.env');
} catch {
  // .env가 없으면 이미 설정된 환경변수를 사용
}

const DEDUPE_SQL = [
  // 회원: 같은 사람의 같은 글 반응은 가장 최근 것만 남김
  `DELETE FROM post_reactions a USING post_reactions b
     WHERE a.user_id IS NOT NULL AND a.user_id = b.user_id AND a.post_id = b.post_id
       AND (a.created_at, a.id) < (b.created_at, b.id)`,
  // 비회원: 같은 IP의 같은 글 반응
  `DELETE FROM post_reactions a USING post_reactions b
     WHERE a.user_id IS NULL AND b.user_id IS NULL AND a.ip_address = b.ip_address AND a.post_id = b.post_id
       AND (a.created_at, a.id) < (b.created_at, b.id)`,
  `DELETE FROM comment_reactions a USING comment_reactions b
     WHERE a.user_id IS NOT NULL AND a.user_id = b.user_id AND a.comment_id = b.comment_id
       AND (a.created_at, a.id) < (b.created_at, b.id)`,
  `DELETE FROM comment_reactions a USING comment_reactions b
     WHERE a.user_id IS NULL AND b.user_id IS NULL AND a.ip_address = b.ip_address AND a.comment_id = b.comment_id
       AND (a.created_at, a.id) < (b.created_at, b.id)`,
  `DELETE FROM post_scraps a USING post_scraps b
     WHERE a.user_id = b.user_id AND a.post_id = b.post_id
       AND (a.created_at, a.id) < (b.created_at, b.id)`,
];

async function tableExists(client, name) {
  const { rows } = await client.query('SELECT to_regclass($1) AS t', [`public.${name}`]);
  return !!rows[0].t;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL environment variable is required');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    // 처음 만드는 DB면 테이블이 아직 없으므로 정리할 것도 없음
    if (await tableExists(client, 'post_reactions')) {
      for (const sql of DEDUPE_SQL) await client.query(sql);
    }
    console.log('[db-prepare] pg_trgm 확장 확인 및 중복 반응/스크랩 정리 완료');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[db-prepare] 실패:', err.message);
  process.exit(1);
});
