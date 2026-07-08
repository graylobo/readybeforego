---
trigger: always_on
---

# AI Agent Coding Instructions - Community Boilerplate

이 문서는 프로젝트의 핵심 아키텍처와 개발 원칙을 담고 있습니다. AI 에이전트는 모든 구현 작업 시 이 문서를 최우선으로 참조하여 일관성을 유지해야 합니다.

## 개요

이 프로젝트는 커뮤니티 플랫폼 구축을 위한 보일러플레이트이다.

향후 다양한 형태의 커뮤니티 서비스로 확장될 수 있도록
재사용 가능한 기반 구조로 설계 및 구현해야 한다.

모든 기능은 아래 원칙을 반드시 준수한다:

1. 확장성과 유지보수성을 최우선으로 고려한다.
2. 모듈화 및 도메인 중심 구조를 유지한다.
3. 가능한 기존 기능을 깨지 않고 새로운 기능을 추가/교체할 수 있어야 한다.
4. UI, Domain, Infrastructure 레이어 간의 책임을 명확히 분리한다.

명시되지 않은 기능이라도, 향후 구현되는 모든 기능은 위 원칙을 기본 전제로 설계 및 구현한다.

# Technical Stack Specification

## 1. Core Stack

### Frontend

- Framework: **Next.js (App Router 기반)**
- Styling: **Tailwind CSS (shadcn/ui 및 유틸리티 기반)**
- Data Fetching: **TanStack Query (기본 원칙)**
- State Management: **Zustand**
- UI Loading Strategy: **Skeleton UI 기반 로딩 처리**
- UI Library: **shadcn/ui**

### Backend

- Framework: **NestJS**
- ORM: **Drizzle ORM**
- Validation: **Zod 기반 스키마 검증**

### Infrastructure

- Containerization: **Docker**
- Orchestration (Local/Production): **Docker Compose**
- Database: **PostgreSQL (Docker 컨테이너 기반 운영)**
- Repository Strategy: **Monorepo 구조**

---

# 📌 Development Guidelines

## 1. Architectural Principles (공통 원칙)

- 본 프로젝트는 실제 서비스 운영을 목표로 한다.
- 모든 설계는 **모듈화(Modularity)**, **확장성(Scalability)**, **안정성(Stability)**을 최우선으로 고려한다.
- 클라이언트에서 사용자와 상호작용이 가능한 모든 영역은 cursor:pointer 처리 한다.
- 기능 구현 시, 필요하다고 판단될 경우 적극적으로 테스트 코드를 작성한다.
- 클라이언트 ↔ 서버 간에는 **일관되고 확장 가능한 에러 코드 체계**를 설계한다.
- 데이터베이스는 로컬/운영 환경 모두에서 직접 설치하지 않으며, 반드시 Docker 컨테이너 기반으로 실행한다.
- 초기 단계에서 불필요한 오버엔지니어링은 지양하되,
  향후 대규모 트래픽으로 확장될 가능성을 고려하여 **마이그레이션이 용이한 구조**로 설계한다.

---

## 2. Security Guidelines (보안 원칙)

모든 코드는 아래 보안 항목을 기본 전제로 작성한다:

1. SQL Injection 방지 (Drizzle ORM의 안전한 쿼리 작성 원칙 준수)
2. XSS (Cross-Site Scripting) 방지
3. 인증/인가 우회 취약점 방지
4. 민감 정보 노출 방지 (API Key, 비밀번호, 토큰 등은 환경 변수로 관리)
5. CSRF 방지 전략 적용
6. 신뢰할 수 없는 라이브러리 사용 금지 및 의존성 보안 관리

보안은 기능 구현 이후 고려하는 요소가 아니라, **설계 단계에서부터 반영해야 하는 기본 조건이다.**

---

## 3. Client Guidelines

- 네트워크 요청은 기본적으로 **TanStack Query**를 사용한다.
- 다만, 상황에 따라 **Next.js API Route** 또는 **Server Action**을 병행하여 사용 가능하다.
- 모든 페이지/컴포넌트 등 사용자에게 보여지는 영역은 모바일/PC 반응형을 기본 전제로 설계한다.
- 스타일링은 **Tailwind CSS 유틸리티 클래스**를 최우선으로 사용하며, 복잡한 커스텀 로직 외에는 따로 분리된 SCSS, CSS Modules 작성을 지양한다. 기존 UI 컴포넌트는 `shadcn/ui`의 패턴을 따른다.
- 로딩 UX는 Skeleton UI 기반으로 구현한다.
- SEO를 고려하여 코드를 작성한다.
   1. 기본은 서버 컴포넌트로 두고, 데이터 페칭을 서버에서 한다.
   2. 상호작용이 필요한 부분만 "use client"로 분리하되, 트리 말단(leaf)으로 밀어 넣는다 ("push client down").
   3. SEO가 중요한 페이지는: 서버에서 데이터를 가져와 클라이언트 컴포넌트에 props로 내려주거나, react-query라면 서버에서 prefetch → dehydrate/hydrate 패턴을 쓴다.

---

## 4. Server Guidelines

### Database Optimization

- 적절한 인덱스를 설계 단계에서 고려한다.
- N+1 문제가 발생하지 않도록 쿼리 구조를 설계한다.
- 슬로우 쿼리가 발생하지 않도록 사전 설계 및 점검을 수행한다.

### Caching Strategy

- 자주 조회되는 데이터는 인메모리 캐싱을 고려한다.
- 기본 선택지는 Redis이며, 필요 시 더 적합한 캐시 솔루션으로 대체 가능하다.

### Background Processing

즉시 응답이 필요하지 않은 작업은 반드시 비동기/백그라운드로 분리한다.

예:

- 이메일 발송
- 이미지 리사이징
- 외부 API 호출
- 로그 집계 작업

이러한 작업은 API 응답 시간에 영향을 주지 않도록 설계한다.

---

# 📌 핵심 설계 철학 (요약)

- 느슨한 결합 (Loose Coupling)
- 높은 응집도 (High Cohesion)
- 확장 가능한 구조
- 명확한 책임 분리
- 서비스 운영을 전제로 한 설계