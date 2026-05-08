FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN export DATABASE_URL=postgres://placeholder:placeholder@localhost/placeholder && \
    npm run build && \
    npx esbuild server/migrate.ts --platform=node --packages=external --bundle --format=esm --outdir=dist && \
    npx drizzle-kit generate

FROM node:20-slim AS runner

WORKDIR /app

# libheif-examples  — provides heif-convert CLI for HEIC → JPEG conversion
# libde265-0        — H.265/HEVC decoder required by libheif for iPhone HEIC files
# Sharp uses its own bundled libvips (8.17.3) for all other formats.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    imagemagick \
    libheif-examples \
    libde265-0 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations

COPY entrypoint.sh ./entrypoint.sh
RUN mkdir -p uploads && chmod +x entrypoint.sh

EXPOSE 5000

ENV NODE_ENV=production

ENTRYPOINT ["./entrypoint.sh"]
