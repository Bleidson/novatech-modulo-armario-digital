#!/bin/sh
set -e

# "prisma migrate deploy" so aplica migrations PENDENTES e e seguro rodar em
# toda subida do container (inclusive apos um restart automatico) - diferente
# de "migrate dev", nunca gera migration nova nem pede confirmacao interativa.
echo "[entrypoint] aplicando migrations pendentes..."
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma

exec "$@"
