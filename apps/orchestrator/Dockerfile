FROM node:20-alpine
WORKDIR /app

# Copy every workspace manifest so `npm install` resolves the full graph.
# Missing one breaks the install because npm workspaces requires all siblings.
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/grants-kb/package.json packages/grants-kb/
COPY apps/web/package.json apps/web/
COPY apps/orchestrator/package.json apps/orchestrator/
COPY services/mock-tng/package.json services/mock-tng/

RUN npm install

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/grants-kb ./packages/grants-kb
COPY apps/orchestrator ./apps/orchestrator

ENV NODE_ENV=production
EXPOSE 4000

# tsx runs the TypeScript directly. We avoid a compile step so workspace
# packages (which expose `.ts` mains) work without a per-package build.
CMD ["npx", "tsx", "apps/orchestrator/src/server.ts"]
