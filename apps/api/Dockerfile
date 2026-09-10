# Imagem de producao da API do Armario Digital. Mesmo padrao do modulo
# Restaurante (apps/api/Dockerfile) - build de contexto = raiz do monorepo
# (workspaces npm), por isso todo COPY abaixo usa caminho a partir da raiz:
#   docker build -f apps/api/Dockerfile -t armario-digital-api .
FROM node:20-bookworm-slim AS base
WORKDIR /app
# Prisma detecta a versao do OpenSSL via o binario CLI "openssl" - sem ele, so
# avisa e assume 1.1.x, mas o binaryTarget gerado (schema.prisma:
# "debian-openssl-3.0.x") e 3.0.x. bookworm-slim nao traz o binario por padrao.
RUN apt-get update -qq && apt-get install -y -qq openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
# --ignore-scripts: o postinstall do workspace da api roda "prisma generate &&
# prisma migrate deploy", que exige um Postgres alcancavel - nao existe nenhum
# durante o build da imagem. prisma generate roda a parte (abaixo); migrate
# deploy fica para o entrypoint, em runtime (docker-entrypoint.sh).
RUN npm ci --ignore-scripts

FROM deps AS build
COPY apps/api apps/api
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace=apps/api
# tsc so compila .ts (rootDir "src") - o fixture JSON de tenant e lido em
# runtime via readFileSync relativo ao PROPRIO arquivo compilado
# (dirname(fileURLToPath(import.meta.url)) dentro de dist/lib/), entao tsc
# nunca o copia sozinho. Sem este cp, o container sobe e cai na primeira
# resolucao de tenant com ENOENT procurando tenants.dev.json em dist/lib/.
RUN cp apps/api/src/lib/tenants.dev.json apps/api/dist/lib/tenants.dev.json \
 && cp apps/api/src/lib/tenants.prod.json apps/api/dist/lib/tenants.prod.json

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/tsconfig.json apps/api/tsconfig.json
# prisma/seedAdmin.ts importa "../src/shared/..." e roda via "npx tsx" (nunca
# compilado por tsc, rootDir "src" nao o inclui) - precisa do codigo-fonte
# presente, nao so do dist. Mesmo padrao do modulo Restaurante
# (prisma/seed.ts/seed-demo.ts, ver Dockerfile de la) - bug real encontrado
# no primeiro deploy: sem isto o container entra em loop de crash
# (ERR_MODULE_NOT_FOUND) porque o entrypoint roda esse script a cada boot.
COPY --from=build /app/apps/api/src apps/api/src
COPY apps/api/docker-entrypoint.sh apps/api/docker-entrypoint.sh
# Windows/git nao preserva o bit de execucao (maquina de desenvolvimento deste
# modulo e Windows) - garante executavel independente do checkout.
RUN chmod +x apps/api/docker-entrypoint.sh

EXPOSE 3401
ENTRYPOINT ["/app/apps/api/docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/server.js"]
