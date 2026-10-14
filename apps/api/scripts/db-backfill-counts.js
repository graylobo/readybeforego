/**
 * drizzle-kit push 후에 실행: 게시글/댓글에 저장해 두는 추천·비추천 수, 이미지 여부를 실제 데이터 기준으로 다시 계산
 * (컬럼을 새로 추가했거나 수치가 어긋났을 때 바로잡는 용도. 여러 번 실행해도 안전)
 */
const { Client } = require('pg');

try {
  process.loadEnvFile('.env');
} catch {
  // .env가 없으면 이미 설정된 환경변수를 사용
}

const BACKFILL_SQL = [
  `UPDATE posts p SET
       like_count = COALESCE(r.likes, 0),
       dislike_count = COALESCE(r.dislikes, 0)
     FROM posts p2
     LEFT JOIN (
       SELECT post_id,
              COUNT(*) FILTER (WHERE type = 'like')::int AS likes,
              COUNT(*) FILTER (WHERE type = 'dislike')::int AS dislikes
       FROM post_reactions GROUP BY post_id
     ) r ON r.post_id = p2.id
     WHERE p.id = p2.id
       AND (p.like_count <> COALESCE(r.likes, 0) OR p.dislike_count <> COALESCE(r.dislikes, 0))`,
  `UPDATE comments c SET
       like_count = COALESCE(r.likes, 0),
       dislike_count = COALESCE(r.dislikes, 0)
     FROM comments c2
     LEFT JOIN (
       SELECT comment_id,
              COUNT(*) FILTER (WHERE type = 'like')::int AS likes,
              COUNT(*) FILTER (WHERE type = 'dislike')::int AS dislikes
       FROM comment_reactions GROUP BY comment_id
     ) r ON r.comment_id = c2.id
     WHERE c.id = c2.id
       AND (c.like_count <> COALESCE(r.likes, 0) OR c.dislike_count <> COALESCE(r.dislikes, 0))`,
  // 서버의 contentHasImage()와 같은 규칙 (HTML img 태그 또는 마크다운 이미지)
  `UPDATE posts SET has_image = (content ~* '<img[^>]+src=[^>]+>' OR content ~ '!\\[[^]]*\\]\\([^)]+\\)')
     WHERE has_image IS DISTINCT FROM (content ~* '<img[^>]+src=[^>]+>' OR content ~ '!\\[[^]]*\\]\\([^)]+\\)')`,
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL environment variable is required');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    for (const sql of BACKFILL_SQL) await client.query(sql);
    console.log('[db-backfill-counts] 추천 수/이미지 여부 재계산 완료');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[db-backfill-counts] 실패:', err.message);
  process.exit(1);
});
