// Variaveis minimas para os testes rodarem sem depender de um .env real. Nunca
// aponta para o banco de desenvolvimento/producao de verdade.
process.env.NODE_ENV ??= "test";
process.env.APP_URL ??= "http://localhost:5174";
process.env.PORT ??= "3401";
// Postgres local via Docker (docker-compose.yml), banco separado do de
// desenvolvimento - criado pelo script de init do container. A role da aplicacao
// (armario_app) nao e dona das tabelas, entao a Row Level Security vale nos testes
// exatamente como vale em producao.
process.env.DATABASE_URL ??= "postgresql://armario_app:armario_app_dev@127.0.0.1:5433/armario_test";
process.env.DATABASE_MIGRATION_URL ??= "postgresql://armario_owner:armario_owner_dev@127.0.0.1:5433/armario_test";
process.env.SESSION_SECRET ??= "test-secret-nao-usar-em-producao-0000000000";
process.env.CORE_INTERNAL_TOKEN ??= "test-internal-token-nao-usar-em-producao-0000";
// Pasta irma, nunca commitada - isola o teste do servidor de dev (mesmo bug real ja
// encontrado e corrigido no modulo Restaurante: sem isto, um rmSync recursivo entre
// testes apagaria uploads reais de dev).
process.env.UPLOADS_DIR ??= "uploads-test";

// Toda consulta ao banco exige um tenant no contexto (shared/tenantContext.ts). Numa
// requisicao HTTP quem abre esse contexto e o middleware resolveTenant; num teste que
// chama fixture/assert direto no Prisma nao ha requisicao nenhuma, entao o contexto e
// definido aqui como padrao do processo. Testes que precisam de outro tenant
// (isolamento) trocam explicitamente com runWithTenantContext.
const { setProcessDefaultTenant } = await import("../shared/tenantContext.js");
const { TENANT_A } = await import("./tenants.js");
setProcessDefaultTenant(TENANT_A);
