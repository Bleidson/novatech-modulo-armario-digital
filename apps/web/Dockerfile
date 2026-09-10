# Build de contexto = raiz do monorepo (mesma razao do Dockerfile da api):
#   docker build -f apps/web/Dockerfile -t armario-digital-web .
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --ignore-scripts
COPY apps/web apps/web
# VITE_API_URL de proposito NAO definido: o build fica com API_BASE_URL vazio
# (lib/api.ts), chamando "/api/v1/..." relativo ao proprio dominio - exatamente
# o que o Traefik espera (PathPrefix /api e /uploads roteados pro container da
# api, tudo o resto pra este). O mesmo bundle serve o dominio de producao sem
# rebuild.
RUN npm run build --workspace=apps/web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
