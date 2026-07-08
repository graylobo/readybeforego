# git push → Cloud Run 자동 배포 흐름

---

## 전체 흐름도

```
개발자 로컬 PC
│
│  git push origin main
│
▼
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GitHub
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│
│  push 이벤트 감지
│  apps/api/** 변경사항 있는지 확인
│  (paths 필터 - 해당 없으면 여기서 종료)
│
▼
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GitHub Actions Runner (ubuntu-latest 임시 가상머신)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│
├─ Step 1. Checkout
│    └─ 레포 코드를 Runner 머신에 다운로드
│
├─ Step 2. Google Auth
│    └─ GCP_SA_KEY (서비스 계정 JSON)로 GCP 인증
│         이후 gcloud, docker 명령어가 GCP에 접근 가능해짐
│
├─ Step 3. Set up Cloud SDK
│    └─ gcloud CLI 설치
│
├─ Step 4. Authorize Docker
│    └─ asia-northeast3-docker.pkg.dev 에 docker push 권한 부여
│
├─ Step 5. Build and Push Container
│    ├─ docker build --target api
│    │    ├─ base 스테이지 (node:22-alpine)
│    │    ├─ api-pruner (turbo prune → api 관련 파일만 추출)
│    │    ├─ api-builder (pnpm install → pnpm build)
│    │    └─ api 런타임 이미지 완성
│    │
│    └─ docker push → Artifact Registry에 이미지 업로드
│         이미지 태그: {commit SHA} (예: a1b2c3d4...)
│
└─ Step 6. Deploy to Cloud Run
     └─ 새 리비전 생성 요청 (이미지 교체만, 환경변수 유지)
          Runner 머신은 여기서 삭제됨

▼
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GCP Artifact Registry
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│
│  새 이미지 저장 완료
│  asia-northeast3-docker.pkg.dev/.../community-api:a1b2c3d4
│
▼
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cloud Run
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│
├─ 새 리비전 생성
│    └─ Artifact Registry에서 이미지 pull
│
├─ 컨테이너 시작
│    ├─ entrypoint.sh 실행
│    │    └─ pnpm --filter api run db:migrate (DB 마이그레이션)
│    │
│    └─ pnpm --filter api run start:prod (NestJS 앱 시작)
│         └─ PORT=4000 에서 수신 대기
│
├─ 헬스체크 통과 확인
│    └─ 실패 시 → 이전 리비전으로 자동 롤백
│
└─ 트래픽을 새 리비전으로 전환 (무중단)
     이전 리비전은 대기 상태 유지
```

---

## GitHub Actions Runner란?

```
- 정체: GitHub이 제공하는 클라우드 임시 가상머신
- 사양: ubuntu-latest (2코어 CPU, 7GB RAM, 14GB SSD)
- 수명: 워크플로우 시작 ~ 종료까지만 존재 (보통 수 분)
- 격리: 다른 레포, 다른 실행과 완전히 분리된 독립 환경
- 비용: Public 레포 무료 / Private 레포 월 2,000분 무료
```

노트북과 동일하게 파일 시스템, 명령어 실행, 네트워크 통신이 가능합니다.  
워크플로우가 끝나면 통째로 삭제되므로 실행 간 상태가 공유되지 않습니다.

---

## 핵심 포인트

**이미지 태그 = commit SHA**

어떤 코드로 빌드된 이미지인지 항상 추적 가능합니다.  
문제가 생기면 이전 SHA 태그의 이미지로 즉시 롤백할 수 있습니다.

```bash
# 특정 커밋 버전으로 롤백
gcloud run services update-traffic {service-name} \
  --region=asia-northeast3 \
  --to-revisions={revision-name}=100
```

**환경변수는 건드리지 않음**

워크플로우는 이미지만 교체합니다.  
Cloud Run 콘솔에서 설정한 환경변수는 리비전이 바뀌어도 그대로 유지됩니다.

**무중단 배포**

새 리비전이 헬스체크를 통과한 후에 트래픽이 전환됩니다.  
새 리비전이 실패하면 자동으로 이전 리비전이 유지됩니다.
