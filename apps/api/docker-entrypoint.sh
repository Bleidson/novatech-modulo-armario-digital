#!/bin/sh
set -e

# "prisma migrate deploy" so aplica migrations PENDENTES e e seguro rodar em
# toda subida do container (inclusive apos um restart automatico) - diferente
# de "migrate dev", nunca gera migration nova nem pede confirmacao interativa.
echo "[entrypoint] aplicando migrations pendentes..."
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma

# So faz algo quando SEED_ADMIN_EMAIL/PASSWORD estao definidas (producao,
# sem Core real ainda) - idempotente, nunca sobrescreve um ADMIN ja
# existente. Ver apps/api/prisma/seedAdmin.ts.
echo "[entrypoint] seed do ADMIN inicial (se configurado)..."
npx tsx apps/api/prisma/seedAdmin.ts

exec "$@"
