CREATE TABLE "password_resets" (
  "tenant_id" UUID NOT NULL DEFAULT (current_setting('app.tenant_id'))::uuid,
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" TEXT NOT NULL UNIQUE,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "used_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "password_resets_tenant_id_user_id_used_at_idx" ON "password_resets"("tenant_id", "user_id", "used_at");
CREATE TABLE "password_recovery_limits" (
  "tenant_id" UUID NOT NULL DEFAULT (current_setting('app.tenant_id'))::uuid,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "window_start" TIMESTAMPTZ NOT NULL,
  PRIMARY KEY ("tenant_id", "key")
);
ALTER TABLE "password_resets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_resets" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "password_resets" USING (tenant_id = current_setting('app.tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
ALTER TABLE "password_recovery_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_recovery_limits" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "password_recovery_limits" USING (tenant_id = current_setting('app.tenant_id')::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
