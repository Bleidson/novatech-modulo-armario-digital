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
# "|| true": defesa em profundidade - um erro aqui NUNCA pode impedir o
# servidor de subir (na pior das hipoteses, so o login ADMIN nao funciona
# ainda). O proprio seedAdmin.ts ja engole os proprios erros, mas isto cobre
# tambem falha de carregamento do script em si (ex: modulo nao encontrado -
# bug real ja visto no primeiro deploy).
echo "[entrypoint] seed do ADMIN inicial (se configurado)..."
npx tsx apps/api/prisma/seedAdmin.ts || echo "[entrypoint] seed do ADMIN falhou, seguindo boot mesmo assim."

exec "$@"
