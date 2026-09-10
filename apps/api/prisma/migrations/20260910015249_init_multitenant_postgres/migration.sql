-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PROFESSOR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "users" (
    "tenant_id" UUID NOT NULL DEFAULT (current_setting('app.tenant_id'))::uuid,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "tenant_id" UUID NOT NULL DEFAULT (current_setting('app.tenant_id'))::uuid,
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "user_agent" TEXT,
    "ip_address" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "tenant_id" UUID NOT NULL DEFAULT (current_setting('app.tenant_id'))::uuid,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_periods" (
    "tenant_id" UUID NOT NULL DEFAULT (current_setting('app.tenant_id'))::uuid,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "tenant_id" UUID NOT NULL DEFAULT (current_setting('app.tenant_id'))::uuid,
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "class_period_id" TEXT NOT NULL,
    "professor_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_role_status_idx" ON "users"("tenant_id", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_tenant_id_user_id_idx" ON "sessions"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "materials_tenant_id_idx" ON "materials"("tenant_id");

-- CreateIndex
CREATE INDEX "materials_tenant_id_active_idx" ON "materials"("tenant_id", "active");

-- CreateIndex
CREATE INDEX "class_periods_tenant_id_idx" ON "class_periods"("tenant_id");

-- CreateIndex
CREATE INDEX "class_periods_tenant_id_active_idx" ON "class_periods"("tenant_id", "active");

-- CreateIndex
CREATE INDEX "reservations_tenant_id_idx" ON "reservations"("tenant_id");

-- CreateIndex
CREATE INDEX "reservations_tenant_id_professor_id_idx" ON "reservations"("tenant_id", "professor_id");

-- CreateIndex
CREATE INDEX "reservations_tenant_id_date_idx" ON "reservations"("tenant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_tenant_id_material_id_date_class_period_id_key" ON "reservations"("tenant_id", "material_id", "date", "class_period_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_class_period_id_fkey" FOREIGN KEY ("class_period_id") REFERENCES "class_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- ISOLAMENTO POR TENANT (Row Level Security)
-- ============================================================================
-- Esta e a camada de verdade do isolamento entre escolas - nao o filtro que a
-- aplicacao faz. Se um service esquecer um "where", a policy abaixo ainda impede a
-- linha de outra escola de aparecer; o inverso nao e verdade.
--
-- ENABLE liga a policy para quem consulta a tabela. FORCE a aplica TAMBEM ao dono da
-- tabela - sem FORCE, o Postgres simplesmente ignora RLS para o owner, e bastaria a
-- aplicacao conectar com a role errada para tudo vazar em silencio.
--
-- A role de runtime (armario_app) nao e dona de nada, nao e superuser e nao tem
-- BYPASSRLS - e sobre ela que estas policies realmente valem. A role de migration
-- (armario_owner) tem BYPASSRLS porque o proprio Prisma Migrate precisa ler as
-- tabelas fora de qualquer contexto de tenant; ela nunca atende requisicao.
-- Ver docker/postgres-init/01-roles-and-databases.sql.
--
-- current_setting('app.tenant_id') e setado por SET LOCAL a cada transacao
-- (shared/prisma.ts). Deliberadamente SEM o segundo argumento missing_ok: se alguem
-- consultar sem tenant no contexto, o banco levanta erro na hora em vez de devolver
-- zero linha silenciosamente.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "users"
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sessions"
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE "materials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "materials" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "materials"
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE "class_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_periods" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "class_periods"
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE "reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reservations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reservations"
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
