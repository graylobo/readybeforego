#!/bin/sh
# Run migrations
echo "Running database migrations..."
# URL이 없으면 어차피 실패하므로, 가볍게 체크만 하고 넘어갑니다
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. Skipping migrations..."
else
  pnpm --filter api run db:migrate || echo "Migration failed, but continuing..."
fi

# Start the application
exec "$@"
