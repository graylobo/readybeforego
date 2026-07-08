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

# --- Web Pruner ---
FROM base AS web-pruner
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=web --docker

# --- API Build ---
FROM base AS api-builder
WORKDIR /app
COPY --from=api-pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=api-pruner /app/out/full/ .
# 빌드 시점에 dist 폴더가 생성됨
RUN pnpm run build --filter=api

# --- Web Build ---
FROM base AS web-builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY --from=web-pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=web-pruner /app/out/full/ .
RUN pnpm run build --filter=web

# --- API Runtime ---
FROM node:22-alpine AS api
WORKDIR /app
RUN npm install -g pnpm@10.10.0
# 빌드된 전체 환경을 복사 (워크스페이스 의존성 유지)
COPY --from=api-builder /app .
COPY entrypoint.sh /usr/bin/
RUN chmod +x /usr/bin/entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["entrypoint.sh"]
# node 직접 실행 대신 pnpm 스크립트 사용 (경로 문제 해결)
CMD ["pnpm", "--filter", "api", "run", "start:prod"]

# --- Web Runtime ---
FROM node:22-alpine AS web
WORKDIR /app
# standalone 결과물 복사
COPY --from=web-builder /app/apps/web/.next/standalone ./
COPY --from=web-builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
# Web의 경우 standalone은 루트의 server.js를 실행함
CMD ["node", "apps/web/server.js"]
