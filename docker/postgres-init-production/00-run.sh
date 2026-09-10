#!/bin/sh
set -e

# docker-entrypoint-initdb.d roda automaticamente todo *.sh/*.sql desta pasta
# na PRIMEIRA subida do volume (imagem oficial do Postgres) - inclusive um
# .sql que so deveria ser lido POR ESTE wrapper. Por isso o arquivo com a
# senha parametrizada tem extensao ".sql.template" (nao ".sql"): assim so
# este script o invoca, com a senha passada por variavel psql (-v) em vez de
# deixa-la escrita no arquivo versionado. Mesmo padrao da Core (docker/init/
# 00-run.sh) e do modulo Restaurante.
psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v app_pw="$POSTGRES_APP_PASSWORD" \
  -f /docker-entrypoint-initdb.d/roles.sql.template
