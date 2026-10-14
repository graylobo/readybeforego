// 상시 가동 서버에서 크롤러 워커를 pm2 로 실행하기 위한 설정
//   pnpm install && pnpm --filter api run build
//   pm2 start ecosystem.crawler.config.js
//
// 환경변수는 apps/api/.env 를 사용한다 (API 서버와 같은 DATABASE_URL / REDIS_URL / LLM / 스토리지 설정 필요).
module.exports = {
  apps: [
    {
      name: 'community-crawler-worker',
      cwd: './apps/api',
      script: 'pnpm',
      args: 'run prod:crawler-worker',
      interpreter: 'none',
      autorestart: true,
      watch: false,
      // 종료 신호 후 진행 중인 수집 단계를 마무리할 시간
      kill_timeout: 30000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
