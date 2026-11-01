FROM node:22-slim

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY backend/package.json backend/package.json
COPY interfaces/telegram/package.json interfaces/telegram/package.json
RUN pnpm install --frozen-lockfile --filter @daytrade/backend...

COPY backend backend
RUN pnpm --filter @daytrade/backend build

USER node
EXPOSE 3000
CMD ["sh", "-c", "node backend/dist/db/migrate.js && node backend/dist/main.js"]
