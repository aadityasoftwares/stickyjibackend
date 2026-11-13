
# STAGE 1: Build TypeScript application
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build


# STAGE 2: Production image
FROM node:22-bookworm-slim AS production

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled backend
COPY --from=builder /app/dist ./dist

# Run application without root privileges
USER 10001:10001

EXPOSE 3000

# Load environment from secure VPS-mounted file
CMD ["node", "--env-file=/run/secrets/app_env", "dist/server.js"]
