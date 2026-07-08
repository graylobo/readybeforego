# 새 프로젝트 생성 체크리스트

이 보일러플레이트를 기반으로 새 프로젝트를 만들 때 수정해야 할 모든 항목을 정리한 문서입니다.

---

## 1. 프로젝트 메타 정보

### `apps/web/src/lib/constants.ts`
사이트 전반의 브랜딩 정보가 집중되어 있습니다. **가장 먼저 수정해야 할 파일**입니다.

```ts
export const SITE_CONFIG = {
  name: "Community Boilerplate",     // ← 프로젝트 이름
  description: "...",                // ← 서비스 설명
  locale: "ko_KR",                   // ← 언어/지역 설정
  author: "Graylobo",                // ← 운영자/팀 이름
  keywords: ["community", ...],      // ← SEO 키워드
};
```

---

## 2. UI 브랜딩 (화면에 노출되는 텍스트/아이콘)

### `apps/web/src/components/layout/header.tsx`
- 헤더 로고 텍스트: `<span>Community</span>`
- 로고 아이콘: `<Film>` (placeholder) → 프로젝트 로고로 교체

### `apps/web/src/components/sidebar/sidebar.tsx`
- 사이드바 로고 텍스트: `<span>Community</span>`
- 로고 아이콘: `<Film>` (placeholder) → 프로젝트 로고로 교체

### `apps/web/src/components/auth/login-form.tsx`
- 환영 문구 (line 78): `"COMMUNITY에 오신 것을 환영합니다"`
- 서비스 소개 문구 (line 81): 커뮤니티 설명 텍스트 (한국어 하드코딩)

### `apps/web/src/components/common/footer.tsx`
- 고객지원 이메일 (line 7): `"운영팀: help@example.com"`
- 저작권 표시 (line 20): `"© 2026 Community. All rights reserved."`

---

## 3. HTML 메타 / SEO

### `apps/web/src/app/layout.tsx`
- HTML 언어 속성 (line 72): `lang="ko"` → 필요시 변경

### `apps/web/src/app/robots.ts`
- `sitemap` URL이 `SITE_CONFIG.url` 기반으로 자동 생성되므로 `constants.ts` 수정만으로 반영됨

### `apps/web/src/app/sitemap.ts`
- 마찬가지로 `SITE_CONFIG.url` 기반 → `constants.ts` 수정으로 반영됨

---

## 4. 백엔드 API

### `apps/api/src/main.ts`
- Swagger 문서 제목: `"Community Boilerplate API"`
- Swagger 문서 설명

---

## 5. 환경 변수 (`.env` / 시크릿)

루트의 `.env.example`을 기반으로 각 환경에 맞게 새 `.env` 파일을 작성합니다.

### 필수 변경 항목

| 변수명 | 설명 |
|---|---|
| `POSTGRES_DB` | 데이터베이스 이름 (예: `myproject_db`) |
| `DATABASE_URL` | PostgreSQL 연결 URL (DB 이름 포함) |
| `JWT_SECRET` | 랜덤하고 강력한 시크릿 키로 교체 |
| `NEXT_PUBLIC_APP_URL` | 프론트엔드 도메인 |
| `NEXT_PUBLIC_API_URL` | 백엔드 API 도메인 |
| `FRONTEND_URL` | CORS 허용 오리진 (보통 APP_URL과 동일) |
| `FOUNDATION_URL` | 기반 URL |

### 소셜 로그인 OAuth 자격증명

각 플랫폼의 개발자 콘솔에서 새 앱 등록 후 발급:

| 변수명 | 플랫폼 |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com) |
| `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` | [Kakao Developers](https://developers.kakao.com) |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | [Naver Developers](https://developers.naver.com) |
| `GOOGLE_CALLBACK_URL` | `https://{API_DOMAIN}/auth/google/callback` |
| `KAKAO_CALLBACK_URL` | `https://{API_DOMAIN}/auth/kakao/callback` |
| `NAVER_CALLBACK_URL` | `https://{API_DOMAIN}/auth/naver/callback` |

### 파일 스토리지 (Supabase 사용 시)

| 변수명 | 설명 |
|---|---|
| `STORAGE_TYPE` | `supabase` 또는 로컬(빈값) |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_KEY` | Supabase 서비스 롤 키 |
| `SUPABASE_BUCKET` | 스토리지 버킷 이름 |

### 애널리틱스 (선택)

| 변수명 | 서비스 |
|---|---|
| `NEXT_PUBLIC_GA_ID` | Google Analytics 4 |
| `NEXT_PUBLIC_GOOGLE_CONSOLE_ID` | Google Search Console 인증 |
| `NEXT_PUBLIC_ADSENSE_ID` | Google AdSense |
| `NEXT_PUBLIC_CLARITY_ID` | Microsoft Clarity |

---

## 6. 데이터베이스

### `apps/api/src/database/schema.ts`
- 보통 스키마 자체는 그대로 사용
- 프로젝트 특성에 따라 불필요한 테이블 제거 가능:
  - `emoticon_packs` / `emoticons` / `user_emoticon_packs` — 이모티콘 기능 사용 안 할 경우
  - `point_policies` / `point_history` / `user_points` — 포인트 기능 사용 안 할 경우

### `docker-compose.yml`
- `POSTGRES_DB: community_db` → 새 프로젝트 DB 이름으로 변경

### 마이그레이션 초기화
```bash
# 기존 마이그레이션 삭제 후 새로 생성
rm -rf apps/api/src/database/migrations
pnpm --filter api db:generate
pnpm --filter api db:migrate
```

---

## 7. 패키지/모노레포 이름

### 루트 `package.json`
```json
{
  "name": "community-boilerplate"  // ← 새 프로젝트 이름으로 변경
}
```

### `packages/shared-types/package.json`
```json
{
  "name": "@community/shared-types"  // ← 조직명 변경 시 수정 (예: @myproject/shared-types)
}
```

전체 찾기 -> 전체 수정 이후 pnpm install 을 해야 바뀐 이름이 해당 모듈을 사용하는 쪽에서 에러없이 인식됨
---

## 8. 배포 (CI/CD)

### `.github/workflows/deploy-api.yml`

GCP Cloud Run 기준으로 작성된 워크플로우이며 아래 항목을 수정합니다:

```yaml
env:
  GCP_REGION: asia-northeast3          # ← 배포 리전 (서울)
  SERVICE_NAME: community-api          # ← Cloud Run 서비스 이름
  ARTIFACT_REPO: app-repo              # ← Artifact Registry 레포 이름
  IMAGE_NAME: community-api            # ← Docker 이미지 이름
```

GitHub Repository Secrets에 등록 필요:
- `GCP_PROJECT_ID` — GCP 프로젝트 ID
- `GCP_SA_KEY` — 서비스 계정 JSON 키 (Base64)

워크플로우 트리거 경로 (필요시 수정):
```yaml
on:
  push:
    branches: [main]
    paths:
      - "apps/api/**"
      - "packages/**"
      - "Dockerfile"
```

### `Dockerfile`
- 빌드 ARG `NEXT_PUBLIC_API_URL`이 주입되므로 CI/CD 파이프라인에서 올바른 값 전달 필요
- 이미지 이름/태그 전략은 워크플로우에서 관리

### `.env.production`
- Cloud Run 등 프로덕션 환경의 최소 환경변수 템플릿
- `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `PORT` 등 실제 값으로 교체

---

## 9. Redis (선택)

Redis는 캐싱과 BullMQ 작업 큐에 사용됩니다.

### `apps/api/src/app.module.ts`
- `REDIS_URL` 환경변수가 없으면 캐시/큐 기능이 비활성화됨
- Redis를 사용할 경우: `REDIS_URL=redis://localhost:6379` 설정

### `docker-compose.yml`
- 현재 Redis 서비스 미포함 → 필요 시 서비스 추가:
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
```

---

## 10. 소셜 로그인 사용 여부 결정

현재 Google / Kakao / Naver 3가지가 모두 구현되어 있습니다.  
일부만 사용할 경우 불필요한 전략을 제거할 수 있습니다:

| 파일 | 설명 |
|---|---|
| `apps/api/src/modules/auth/strategies/google.strategy.ts` | Google OAuth 전략 |
| `apps/api/src/modules/auth/strategies/kakao.strategy.ts` | Kakao OAuth 전략 |
| `apps/api/src/modules/auth/strategies/naver.strategy.ts` | Naver OAuth 전략 |
| `apps/web/src/components/auth/login-form.tsx` | 로그인 버튼 UI |

---

## 빠른 시작 순서 요약

```
1. 저장소 fork 또는 clone
2. apps/web/src/lib/constants.ts — SITE_CONFIG 수정
3. header.tsx, sidebar.tsx — 로고 텍스트/아이콘 교체
4. login-form.tsx, footer.tsx — 텍스트 수정
5. apps/api/src/main.ts — Swagger 제목 수정
6. .env.example 복사 → .env 생성 후 전체 값 채우기
   - DB 이름, JWT_SECRET, OAuth credentials, 도메인 URL
7. docker-compose.yml — POSTGRES_DB 이름 변경
8. 마이그레이션 초기화 (위 명령어 참고)
9. .github/workflows/deploy-api.yml — GCP 설정 수정
10. (선택) 불필요한 기능 모듈 제거 (이모티콘, 포인트 등)
```
