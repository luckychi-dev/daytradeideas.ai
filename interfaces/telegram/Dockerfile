FROM node:22-slim

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY backend/package.json backend/package.json
COPY interfaces/telegram/package.json interfaces/telegram/package.json
RUN pnpm install --frozen-lockfile --filter @daytrade/telegram...

COPY interfaces/telegram interfaces/telegram
RUN pnpm --filter @daytrade/telegram build

USER node
EXPOSE 3001
CMD ["node", "interfaces/telegram/dist/main.js"]

