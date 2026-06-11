# ── Stage 1: Build Angular ─────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build -- --configuration production

# ── Stage 2: Serve with nginx ───────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Default for docker-compose; override BACKEND_URL env var on Railway/Render
ENV BACKEND_URL=http://backend:8080
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
