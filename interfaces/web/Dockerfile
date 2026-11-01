FROM node:22-slim

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY backend/package.json backend/package.json
COPY interfaces/telegram/package.json interfaces/telegram/package.json
COPY interfaces/web/package.json interfaces/web/package.json
RUN pnpm install --frozen-lockfile --filter @daytrade/web...

COPY interfaces/web interfaces/web
RUN pnpm --filter @daytrade/web build

USER node
EXPOSE 3002
CMD ["node", "interfaces/web/dist/server/main.js"]
