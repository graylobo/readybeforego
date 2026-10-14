# 🚀 Full-Stack Monorepo Deployment Guide (Cloud Run Edition)

본 문서는 **Turborepo** 기반의 모노레포 프로젝트를 **Docker**로 컨테이너화하여 **Google Cloud Run**에 자동 배포(CI/CD)하는 전 과정을 다룹니다.

---

## 1. 데이터베이스 준비 (Supabase)

1. project 생성
2. Connect 버튼 → 연결 주소 두 가지를 복사해 둡니다 (같은 주소에 포트만 다름)
   - **Transaction pooler (포트 6543)**: API 서버·워커가 쓰는 `DATABASE_URL`
   - **Session pooler (포트 5432)**: 마이그레이션(`db:migrate`)용

> ⚠️ API 서버에 Session pooler(5432)를 쓰지 마세요. Session pooler는 연결 하나가 DB 자리 하나를 계속 차지하고,
> 작은 요금제는 자리가 15개뿐입니다. Cloud Run은 배포 중(예전·새 버전이 잠깐 같이 뜸)이나 트래픽이 늘 때 서버가 여러 대가 되고,
> 서버마다 연결을 최대 10개(`DATABASE_POOL_MAX`)씩 열어 두므로 금방 넘칩니다
> → `max clients reached in session mode` 로 500 오류. 자세한 내용은 [CLOUDRUN_DEPLOY_GUIDE.md](./CLOUDRUN_DEPLOY_GUIDE.md)의 "DB 연결 주소 고르기".
---

## 2. Google Cloud Platform (GCP) 초기 설정

### A. 프로젝트 및 API 활성화
1.  GCP 프로젝트 생성: 하나의 프로젝트만 생성합니다. (예: `community-app`)
2.  필수 API 활성화: (검색이 안 되면 'API 라이브러리'에서 직접 찾기)
    *   Cloud Run API
    *   Artifact Registry API
    *   Cloud Build API

### B. Artifact Registry (컨테이너 저장소) 생성
1.  이름: `app-repo` (GitHub Actions 설정과 일치)
2.  형식: `Docker`
3.  위치(Region): `asia-northeast3 (서울)`

### C. IAM 서비스 계정 및 키 생성
1.  배포 전용 계정 생성: `github-deployer`
2.  권한(Role) 부여 (4가지 필수):
    Cloud Run 관리자 / Artifact Registry 쓰기 / 저장소 관리자 / 서비스 계정 사용자
3.  JSON 키 발급: 계정 클릭 > 키 탭 > JSON 키 만들기 및 다운로드

---

## 3. GitHub Repository 설정

`Settings > Secrets and variables > Actions > Repository secrets`에 등록:
1. `GCP_PROJECT_ID`: 구글 프로젝트 ID
2. `GCP_SA_KEY`: JSON 키 파일 내용 전체 (중괄호 포함)


## 4. API 컨테이너 환경 변수 설정 (Cloud Run)

배포 후 `수정 및 새 버전 출시` 메뉴에서 아래 변수들을 등록합니다.

*   `DATABASE_URL`: Supabase의 **Transaction pooler** 주소, 포트 6543 (필수)
*   `JWT_SECRET`: 로그인 토큰 암호화용 비밀키 (필수)
*   `FRONTEND_URL`: 실제 배포된 Web 서비스 URL (CORS 허용용)
*   `API_URL`: 실제 배포된 API 서비스 URL
*   `NODE_ENV`: `production` 연동
*   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL`: 구글 로그인 연동 시

---
마지막 업데이트: 2026-02-06
장소: Antigravity AI Pair Programming Session
