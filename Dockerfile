# syntax=docker/dockerfile:1

# Crewfest — multi-stage build.
#
# Debian slim (not Alpine) on purpose: better-sqlite3 is a native module and Alpine's
# musl libc is a recurring source of prebuild/ABI mismatches for it. Both stages use
# the SAME base image (node:22-slim) so the native addon built in the "build" stage
# is guaranteed to run in the "runtime" stage.

# ─── Stage 1: build ──────────────────────────────────────────────────────────────
FROM node:22-slim AS build

# Must be set BEFORE `npm ci` — puppeteer's postinstall would otherwise try to
# download its own Chromium (we use the system Chromium installed in the runtime
# stage instead, see CHROMIUM_PATH below).
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app

# build-essential + python3: fallback toolchain for better-sqlite3's
# `prebuild-install || node-gyp rebuild` install script, in case no prebuilt binary
# matches this exact Node/arch combination (relevant for linux/arm64 builds).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first (better layer caching — only reruns on lockfile change).
COPY package.json package-lock.json ./
RUN npm ci

# Now bring in the rest of the source and build.
COPY tsconfig.json tailwind.config.js ./
COPY src ./src
COPY public ./public
RUN npm run build

# tailwindcss, typescript, tsx etc. are devDependencies (see package.json) and are
# only needed for the build above — strip them so only runtime deps remain.
RUN npm prune --omit=dev

# ─── Stage 2: runtime ─────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

# System Chromium for puppeteer (src/services/pdf.ts picks it up via CHROMIUM_PATH)
# + fonts-liberation so PDF text (Latin/umlaut glyphs) renders instead of falling
# back to tofu boxes. `chromium` on Debian pulls in the shared libs it needs
# (libnss3, libx11, libatk, …) as regular apt dependencies.
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && chromium --version

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    CHROMIUM_PATH=/usr/bin/chromium \
    DB_PATH=/data/crewfest.db \
    UPLOADS_DIR=/data/uploads \
    PORT=3001

WORKDIR /app

# /data holds the sqlite DB + uploaded photos (VOLUME below). Created + owned by the
# non-root `node` user (baked into the official Node image, uid/gid 1000) up front so
# the app can write to it after USER node.
#
# NOTE for bind-mount users: a bind mount does NOT inherit this ownership — if you
# mount a host directory at /data instead of using a named volume, `chown` it to
# uid:gid 1000:1000 on the host first (e.g. `chown -R 1000:1000 ./crewfest-data`),
# otherwise the app will fail to write the DB/uploads.
RUN mkdir -p /data && chown -R node:node /data

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json

USER node

EXPOSE 3001
VOLUME ["/data"]

# curl isn't in node:22-slim — use node's built-in fetch instead.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
