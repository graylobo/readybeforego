FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN corepack prepare pnpm@10.10.0 --activate

# --- API Pruner ---
FROM base AS api-pruner
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=api --docker

# --- API Build ---
FROM base AS api-builder
WORKDIR /app
COPY --from=api-pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=api-pruner /app/out/full/ .
# 빌드 시점에 dist 폴더가 생성됨
RUN pnpm run build --filter=api

# --- API Runtime ---
FROM node:22-alpine AS api
WORKDIR /app
RUN npm install -g pnpm@10.10.0
# 빌드된 전체 환경을 복사 (워크스페이스 의존성 유지)
COPY --from=api-builder /app .

EXPOSE 4000
# node 직접 실행 대신 pnpm 스크립트 사용 (경로 문제 해결)
CMD ["pnpm", "--filter", "api", "run", "start:prod"]
