-- Modulo Armario Digital da Novatech Platform - inicializacao do Postgres de desenvolvimento.
--
-- Duas roles distintas, e essa separacao NAO e estetica: o Postgres ignora Row Level
-- Security para o dono da tabela e para superusuarios, mesmo com FORCE ROW LEVEL
-- SECURITY (FORCE cobre o dono, mas BYPASSRLS/superuser continua passando por cima).
-- Se a aplicacao conectasse como dona das tabelas, toda a politica de isolamento por
-- tenant viraria decoracao: um bug de query voltaria a vazar linha de outro tenant.
--
--   armario_owner -> dona do schema. So o Prisma Migrate usa (DATABASE_MIGRATION_URL).
--                    Tem CREATEDB porque o Prisma Migrate cria um shadow database
--                    temporario para calcular o diff de cada migration.
--   armario_app   -> usada pela aplicacao em runtime (DATABASE_URL). Nao e dona de
--                    nada, nao e superuser, nao tem BYPASSRLS. E a role sobre a qual
--                    as policies de tenant realmente valem.

-- BYPASSRLS no owner: com FORCE ROW LEVEL SECURITY ligado, ate o dono da tabela cai na
-- policy - e as policies exigem app.tenant_id setado. Sem isto, QUALQUER leitura feita
-- pelo Prisma Migrate (a checagem de perda de dados, por exemplo) morre com
-- "unrecognized configuration parameter app.tenant_id", e nenhuma migration nova roda.
-- Isso NAO enfraquece o isolamento: quem atende requisicao e armario_app, que continua
-- sem BYPASSRLS e sem ser dona de nada. armario_owner so e usada por migration
-- (DATABASE_MIGRATION_URL), nunca em runtime.
CREATE ROLE armario_owner WITH LOGIN PASSWORD 'armario_owner_dev' CREATEDB BYPASSRLS;
CREATE ROLE armario_app   WITH LOGIN PASSWORD 'armario_app_dev';

-- Banco de desenvolvimento e banco de teste separados - a suite automatizada limpa
-- tabelas entre testes e nunca pode tocar no banco que o desenvolvedor usa na mao.
CREATE DATABASE armario_dev  OWNER armario_owner;
CREATE DATABASE armario_test OWNER armario_owner;

\connect armario_dev
GRANT CONNECT ON DATABASE armario_dev TO armario_app;
GRANT USAGE ON SCHEMA public TO armario_app;
-- O app precisa poder ler/escrever, mas nunca criar/alterar estrutura: DDL e
-- exclusividade do owner via migration versionada.
ALTER DEFAULT PRIVILEGES FOR ROLE armario_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO armario_app;
ALTER DEFAULT PRIVILEGES FOR ROLE armario_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO armario_app;
-- Cobre tambem tabelas que ja existam (ex.: schema recriado a mao durante o
-- desenvolvimento). ALTER DEFAULT PRIVILEGES so vale para o que for criado DEPOIS dele -
-- descobrir isso do jeito dificil custa uma suite inteira falhando com
-- "permission denied for table ...". Se voce recriar o schema public na mao, rode este
-- bloco de novo: dropar o schema leva junto os privilegios padrao.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO armario_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO armario_app;

\connect armario_test
GRANT CONNECT ON DATABASE armario_test TO armario_app;
GRANT USAGE ON SCHEMA public TO armario_app;
ALTER DEFAULT PRIVILEGES FOR ROLE armario_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO armario_app;
ALTER DEFAULT PRIVILEGES FOR ROLE armario_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO armario_app;
-- Cobre tambem tabelas que ja existam (ex.: schema recriado a mao durante o
-- desenvolvimento). ALTER DEFAULT PRIVILEGES so vale para o que for criado DEPOIS dele -
-- descobrir isso do jeito dificil custa uma suite inteira falhando com
-- "permission denied for table ...". Se voce recriar o schema public na mao, rode este
-- bloco de novo: dropar o schema leva junto os privilegios padrao.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO armario_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO armario_app;
