FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/grants-kb/package.json packages/grants-kb/
COPY apps/web/package.json apps/web/
COPY apps/orchestrator/package.json apps/orchestrator/
COPY services/mock-tng/package.json services/mock-tng/

RUN npm install

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/mock-tng ./services/mock-tng

ENV NODE_ENV=production
EXPOSE 5050

CMD ["npx", "tsx", "services/mock-tng/src/server.ts"]
