FROM node:20-slim AS builder

WORKDIR /app

# Build tools + libvips/libheif/libde265 dev headers so sharp compiles
# from source against system libvips (which includes full HEIF/H.265 support).
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    libvips-dev \
    libheif-dev \
    libde265-dev \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# Install all deps normally (prebuilt binaries for everything else),
# then add node-addon-api (required by sharp's binding.gyp) and rebuild
# only sharp from source against the system libvips installed above.
# This gives sharp access to libheif + libde265 for HEIC → JPEG conversion.
RUN npm ci && \
    npm install --no-save node-addon-api && \
    npm_config_build_from_source=true npm rebuild sharp

COPY . .

RUN export DATABASE_URL=postgres://placeholder:placeholder@localhost/placeholder && \
    npm run build && \
    npx esbuild server/migrate.ts --platform=node --packages=external --bundle --format=esm --outdir=dist && \
    npx drizzle-kit generate

FROM node:20-slim AS runner

WORKDIR /app

# Runtime libraries that match the system libvips sharp was compiled against.
# libvips42   — libvips runtime
# libheif1    — HEIF codec (reads HEIC/HEIF containers)
# libde265-0  — H.265/HEVC decoder (used by virtually all iPhone HEIC files)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    imagemagick \
    libvips42 \
    libheif1 \
    libde265-0 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# Copy node_modules from builder — sharp's .node file was compiled against
# the system libvips above and must not be re-downloaded as a prebuilt binary.
COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations

COPY entrypoint.sh ./entrypoint.sh
RUN mkdir -p uploads && chmod +x entrypoint.sh

EXPOSE 5000

ENV NODE_ENV=production

ENTRYPOINT ["./entrypoint.sh"]
