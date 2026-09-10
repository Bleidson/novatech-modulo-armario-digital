# Postgres com o script de bootstrap de role JA EMBUTIDO na imagem, em vez de
# bind mount - mesmo motivo e padrao da Core (docker/postgres/Dockerfile la):
# o ambiente de deploy (Hostinger VPS project API) so sabe puxar uma imagem ja
# pronta, nunca ha checkout do repositorio no host, entao um bind mount
# relativo nao encontraria nada la. COPY para dentro da propria imagem
# funciona em qualquer host.
#
# Build context = raiz do repositorio (nao esta pasta), de proposito - assim
# docker/postgres-init-production continua sendo a UNICA fonte destes scripts:
#   docker build -f docker/postgres/Dockerfile -t ghcr.io/bleidson/armario-digital-postgres:prod .
FROM postgres:17-alpine
COPY docker/postgres-init-production/ /docker-entrypoint-initdb.d/
