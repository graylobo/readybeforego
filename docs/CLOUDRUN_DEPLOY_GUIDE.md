# Cloud Run 배포 파이프라인 구축 가이드 (Secret Manager 버전)

`apps/api` (NestJS) → Google Cloud Run, GitHub Actions CI/CD 기준  
민감한 값은 Secret Manager, 나머지는 Cloud Run 콘솔에서 직접 관리

> `{값}` 형태로 표시된 부분은 프로젝트마다 직접 수정해야 합니다.

---

## 환경변수 관리 전략

| 저장 위치 | 저장할 값 | 이유 |
|---|---|---|
| **GitHub Secrets** | `GCP_PROJECT_ID`, `GCP_SA_KEY` | 배포 인증 전용 |
| **Secret Manager** | `DATABASE_URL`, `JWT_SECRET`, OAuth Secret, Supabase Key | 콘솔에서 값이 보이지 않음, 접근 감사 로그 |
| **Cloud Run 콘솔** | 나머지 비민감 환경변수 | 간편하게 직접 입력 |

워크플로우는 **이미지 교체만** 담당하고, 환경변수는 건드리지 않습니다.

---

## PHASE 1 — GCP API 활성화 및 Artifact Registry 생성

```bash
# Google Cloud SDK 설치 (macOS)
brew install google-cloud-sdk

# 로그인 및 프로젝트 설정
gcloud auth login
gcloud config set project {gcp-project-id}

# 필요한 GCP API 활성화
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com

# Docker 이미지 저장소 생성
gcloud artifacts repositories create {artifact-repo-name} \
  --repository-format=docker \
  --location={region} \
  --description="{설명}"
```

| 변수 | 예시 |
|---|---|
| `{gcp-project-id}` | `my-project-123` |
| `{artifact-repo-name}` | `app-repo` (워크플로우 `REPO_NAME`과 일치시킬 것) |
| `{region}` | `asia-northeast3` (서울) |

---

## PHASE 2 — 서비스 계정 생성 및 권한 부여

```bash
# 서비스 계정 생성
gcloud iam service-accounts create {sa-name} \
  --display-name="{표시 이름}"

# 변수 세팅 (현재 터미널 세션에서만 유효한 임시 변수)
export PROJECT_ID={gcp-project-id}
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
export SA_EMAIL={sa-name}@${PROJECT_ID}.iam.gserviceaccount.com

# Artifact Registry 이미지 푸시 권한
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/artifactregistry.writer"

# Cloud Run 서비스 배포 권한
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/run.admin"

# Secret Manager 접근 권한
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor"

# Cloud Run 실행 계정 위임 권한
# 주의: Compute 서비스 계정은 프로젝트 ID가 아닌 프로젝트 번호를 사용합니다
gcloud iam service-accounts add-iam-policy-binding \
  ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/iam.serviceAccountUser"

# JSON 키 발급 (홈 디렉토리에 생성됨)
gcloud iam service-accounts keys create ~/gcp-key.json \
  --iam-account=$SA_EMAIL
```

| 변수 | 예시 |
|---|---|
| `{sa-name}` | `github-actions-sa` |
| `{표시 이름}` | `GitHub Actions Service Account` |

---

## PHASE 3 — Secret Manager에 민감한 환경변수 등록

```bash
# 필수
echo -n "{db-connection-string}" | gcloud secrets create DATABASE_URL --data-file=-
echo -n "{jwt-secret-key}"       | gcloud secrets create JWT_SECRET --data-file=-

# Google OAuth
echo -n "{google-client-secret}" | gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=-

# Kakao OAuth
echo -n "{kakao-client-secret}"  | gcloud secrets create KAKAO_CLIENT_SECRET --data-file=-

# Naver OAuth
echo -n "{naver-client-secret}"  | gcloud secrets create NAVER_CLIENT_SECRET --data-file=-

# Supabase (파일 스토리지 사용 시)
echo -n "{supabase-service-key}" | gcloud secrets create SUPABASE_SERVICE_KEY --data-file=-

# 등록 확인
gcloud secrets list
```

| 변수 | 설명 |
|---|---|
| `{db-connection-string}` | `postgresql://user:pass@host:5432/dbname` |
| `{jwt-secret-key}` | 랜덤 문자열 (최소 32자 이상 권장) |
| `{google-client-secret}` | Google Cloud Console에서 발급 |
| `{kakao-client-secret}` | Kakao Developers에서 발급 |
| `{naver-client-secret}` | Naver Developers에서 발급 |
| `{supabase-service-key}` | Supabase 대시보드 → Settings → API |

---

## PHASE 4 — GitHub Secrets 등록

GitHub 레포 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

배포 인증에 필요한 값 **2개만** 등록합니다.

| Secret 이름 | 값 |
|---|---|
| `GCP_PROJECT_ID` | `{gcp-project-id}` |
| `GCP_SA_KEY` | `~/gcp-key.json` 파일 전체 내용 붙여넣기 |

등록 후 로컬 키 파일 삭제:

```bash
rm ~/gcp-key.json
```

---

## PHASE 5 — 워크플로우 파일 수정

`.github/workflows/deploy-api.yml`의 `env` 섹션만 수정합니다.  
환경변수는 Cloud Run 콘솔에서 관리하므로 `env_vars` / `secrets` 블록은 없습니다.

```yaml
name: Deploy API to Cloud Run

on:
  push:
    branches: [ main ]
    paths:
      - 'apps/api/**'
      - 'packages/**'
      - 'Dockerfile'
      - 'entrypoint.sh'
      - '.github/workflows/deploy-api.yml'

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  REGION: {region}
  SERVICE_NAME: {service-name}
  REPO_NAME: {artifact-repo-name}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Google Auth
        uses: 'google-github-actions/auth@v2'
        with:
          credentials_json: '${{ secrets.GCP_SA_KEY }}'

      - name: Set up Cloud SDK
        uses: 'google-github-actions/setup-gcloud@v2'

      - name: Authorize Docker
        run: gcloud auth configure-docker {region}-docker.pkg.dev

      - name: Build and Push Container
        run: |-
          docker build \
            --target api \
            -t "{region}-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$SERVICE_NAME:$GITHUB_SHA" \
            .
          docker push "{region}-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$SERVICE_NAME:$GITHUB_SHA"

      - name: Deploy to Cloud Run
        uses: 'google-github-actions/deploy-cloudrun@v2'
        with:
          service: ${{ env.SERVICE_NAME }}
          region: ${{ env.REGION }}
          image: "{region}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO_NAME }}/${{ env.SERVICE_NAME }}:${{ github.sha }}"
          flags: "--allow-unauthenticated --port=4000"
          # env_vars / secrets 없음 → 콘솔에서 설정한 값 그대로 유지됨
```

---

## PHASE 6 — 최초 수동 배포 (Cloud Run 서비스 초기화)

GitHub Actions를 처음 실행하기 전, 서비스를 한 번 수동으로 생성합니다.  
**이 단계의 목적은 Cloud Run URL을 발급받는 것입니다.**

```bash
# Docker 인증
gcloud auth configure-docker {region}-docker.pkg.dev

# 이미지 빌드
docker build --platform linux/amd64 --target api \
  -t {region}-docker.pkg.dev/{gcp-project-id}/{artifact-repo-name}/{service-name}:init .

# 이미지 푸시
docker push {region}-docker.pkg.dev/{gcp-project-id}/{artifact-repo-name}/{service-name}:init

# Cloud Run 서비스 최초 생성 (환경변수 없이 우선 생성)
gcloud run deploy {service-name} \
  --image={region}-docker.pkg.dev/{gcp-project-id}/{artifact-repo-name}/{service-name}:init \
  --region={region} \
  --platform=managed \
  --allow-unauthenticated \
  --port=4000 \
  --memory={memory} \
  --cpu={cpu} \
  --min-instances={min-instances} \
  --max-instances={max-instances}
```

| 변수 | 설명 | 권장값 |
|---|---|---|
| `{service-name}` | Cloud Run 서비스 이름 | `community-api` |
| `{memory}` | 인스턴스 메모리 | `512Mi` / `1Gi` |
| `{cpu}` | CPU | `1` |
| `{min-instances}` | 최소 인스턴스 (0이면 콜드스타트 발생) | `0` |
| `{max-instances}` | 최대 인스턴스 | `10` |

배포 후 URL 확인:

```bash
gcloud run services describe {service-name} \
  --region={region} \
  --format="value(status.url)"
# 출력 예: https://community-api-xxxxxxxxxx-an.a.run.app
```

---

## PHASE 7 — Cloud Run 콘솔에서 환경변수 설정

GCP 콘솔 → Cloud Run → `{service-name}` → **새 리비전 수정** → **변수 및 보안 비밀** 탭

PHASE 6에서 확인한 `{api-url}`을 아래 표의 값에 채워서 입력합니다.

### 콘솔에서 직접 입력 (비민감 값)

| 이름 | 값 |
|---|---|
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `{web-frontend-url}` |
| `API_URL` | `{api-url}` |
| `GOOGLE_CLIENT_ID` | Google Cloud Console에서 발급 |
| `GOOGLE_CALLBACK_URL` | `{api-url}/auth/google/callback` |
| `KAKAO_CLIENT_ID` | Kakao Developers에서 발급 |
| `KAKAO_CALLBACK_URL` | `{api-url}/auth/kakao/callback` |
| `NAVER_CLIENT_ID` | Naver Developers에서 발급 |
| `NAVER_CALLBACK_URL` | `{api-url}/auth/naver/callback` |
| `STORAGE_TYPE` | `supabase` 또는 빈값(로컬 디스크) |
| `SUPABASE_URL` | Supabase 대시보드 → Settings → API |
| `SUPABASE_BUCKET` | `images` |
| `REDIS_URL` | Redis 연결 URL (사용 시) |

### Secret Manager 참조로 연결 (민감 값)

같은 탭 하단 **보안 비밀** 섹션에서 추가합니다.

| 환경변수 이름 | Secret Manager 시크릿 |
|---|---|
| `DATABASE_URL` | `DATABASE_URL` (최신 버전) |
| `JWT_SECRET` | `JWT_SECRET` (최신 버전) |
| `GOOGLE_CLIENT_SECRET` | `GOOGLE_CLIENT_SECRET` (최신 버전) |
| `KAKAO_CLIENT_SECRET` | `KAKAO_CLIENT_SECRET` (최신 버전) |
| `NAVER_CLIENT_SECRET` | `NAVER_CLIENT_SECRET` (최신 버전) |
| `SUPABASE_SERVICE_KEY` | `SUPABASE_SERVICE_KEY` (최신 버전) |

> 입력 후 **배포** 버튼을 눌러 새 리비전을 적용합니다.  
> 이후 워크플로우 배포 시 이 값들은 그대로 유지됩니다.

---

## PHASE 8 — 소셜 로그인 플랫폼 Callback URL 등록

| 플랫폼 | 등록 위치 | 등록할 URL |
|---|---|---|
| Google | [Google Cloud Console](https://console.cloud.google.com) → API 및 서비스 → 사용자 인증 정보 | `{api-url}/auth/google/callback` |
| Kakao | [Kakao Developers](https://developers.kakao.com) → 앱 → 카카오 로그인 → Redirect URI | `{api-url}/auth/kakao/callback` |
| Naver | [Naver Developers](https://developers.naver.com) → 애플리케이션 → API 설정 | `{api-url}/auth/naver/callback` |

---

## PHASE 9 — 워크플로우 push → 자동 배포 확인

```bash
git add .github/workflows/deploy-api.yml
git commit -m "chore: configure cloud run deployment"
git push origin main
```

배포 검증:

```bash
# 서비스 상태 확인
gcloud run services describe {service-name} --region={region}

# 최근 로그 확인
gcloud run services logs read {service-name} \
  --region={region} \
  --limit=50
```

정상 배포 흐름:
```
git push origin main (apps/api/** 변경 감지)
  → Checkout
  → GCP 인증 (GCP_SA_KEY)
  → Docker 빌드 (--target api)
  → Artifact Registry 푸시 ({git-sha} 태그)
  → Cloud Run 새 리비전 배포 (콘솔/Secret Manager 환경변수 그대로 유지)
  → entrypoint.sh: db:migrate 실행
  → pnpm --filter api run start:prod
```

---

## 최초 배포 순서 요약

```
[ ] 1.  GCP API 활성화 + Artifact Registry 레포 생성
[ ] 2.  서비스 계정 생성 + 권한 부여 + JSON 키 발급
[ ] 3.  Secret Manager에 민감한 환경변수 등록
[ ] 4.  GitHub Secrets에 GCP_PROJECT_ID, GCP_SA_KEY 등록 (2개만)
[ ] 5.  로컬 JSON 키 파일 삭제
[ ] 6.  .github/workflows/deploy-api.yml env 섹션 수정
[ ] 7.  로컬에서 이미지 빌드 & 푸시
[ ] 8.  gcloud run deploy로 Cloud Run 서비스 최초 생성
[ ] 9.  발급된 Cloud Run URL 확인
[ ] 10. Cloud Run 콘솔에서 비민감 환경변수 입력 + Secret Manager 시크릿 연결
[ ] 11. 각 소셜 플랫폼 콘솔에서 Callback URL 등록
[ ] 12. git push → GitHub Actions 탭에서 파이프라인 정상 동작 확인
```

---

## Secret 값 변경이 필요할 때

```bash
# 새 버전 추가 (자동으로 최신 버전이 됨)
echo -n "{새로운 값}" | gcloud secrets versions add {SECRET_NAME} --data-file=-

# 오래된 버전 정리 (무료 한도 월 6개 버전 초과 방지)
gcloud secrets versions disable {버전번호} --secret={SECRET_NAME}
```

Secret Manager 값은 변경 즉시 다음 컨테이너 시작 시 반영됩니다. (재배포 불필요)
