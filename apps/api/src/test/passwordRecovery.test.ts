import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { createUserFixture, resetDb } from "./dbHelpers.js";
import { prisma } from "../shared/prisma.js";
import { runWithTenantContext } from "../shared/tenantContext.js";
import { TENANT_A, TENANT_B } from "./tenants.js";
import { confirmPasswordRecovery, requestPasswordRecovery } from "../modules/auth/passwordRecovery.service.js";
import { authenticate } from "../modules/auth/auth.service.js";

vi.mock("../shared/env.js", async (load) => {
  const actual = await load<typeof import("../shared/env.js")>();
  return { ...actual, env: { ...actual.env, CORE_RECOVERY_API_URL: "http://core-fake.test", CORE_RECOVERY_SERVICE_TOKEN: "fake-recovery-token-0000000000000000000" } };
});

afterEach(() => vi.unstubAllGlobals());
beforeEach(async () => {
  await resetDb();
  for (const tenant of [TENANT_A, TENANT_B]) await runWithTenantContext(tenant, () => prisma.passwordRecoveryLimit.deleteMany());
});

describe("recuperação local de professor", () => {
  it("isola escolas, invalida links anteriores e revoga sessões sem alterar o perfil", async () => {
    const messages: { token: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
      messages.push(JSON.parse(String(init.body)) as { token: string });
      return new Response(null, { status: 204 });
    }));
    const { user } = await runWithTenantContext(TENANT_A, () => createUserFixture({ email: "professor-recovery@example.test", password: "senha-antiga" }));
    await runWithTenantContext(TENANT_A, () => prisma.session.create({ data: { userId: user.id, tokenHash: "session-recovery", expiresAt: new Date(Date.now() + 60_000) } }));
    await runWithTenantContext(TENANT_A, () => requestPasswordRecovery(user.email, "192.0.2.1", "ceti"));
    await runWithTenantContext(TENANT_A, () => requestPasswordRecovery(user.email, "192.0.2.1", "ceti"));
    expect(messages).toHaveLength(2);
    const old = messages[0]!.token, current = messages[1]!.token;
    expect(await runWithTenantContext(TENANT_B, () => confirmPasswordRecovery(current, "senha-nova", "192.0.2.2"))).toBe(false);
    expect(await runWithTenantContext(TENANT_A, () => confirmPasswordRecovery(old, "senha-nova", "192.0.2.1"))).toBe(false);
    const results = await Promise.all([1, 2].map(() => runWithTenantContext(TENANT_A, () => confirmPasswordRecovery(current, "senha-nova", "192.0.2.1"))));
    expect(results.filter(Boolean)).toHaveLength(1);
    const updated = await runWithTenantContext(TENANT_A, () => prisma.user.findUniqueOrThrow({ where: { id: user.id } }));
    expect(updated.role).toBe("PROFESSOR");
    expect(await bcrypt.compare("senha-nova", updated.passwordHash)).toBe(true);
    expect(await bcrypt.compare("senha-antiga", updated.passwordHash)).toBe(false);
    expect((await runWithTenantContext(TENANT_A, () => authenticate(user.email, "senha-nova"))).id).toBe(user.id);
    await expect(runWithTenantContext(TENANT_A, () => authenticate(user.email, "senha-antiga"))).rejects.toThrow();
    expect((await runWithTenantContext(TENANT_A, () => prisma.session.findFirstOrThrow({ where: { userId: user.id } }))).revokedAt).not.toBeNull();
  });

  it("não envia para contas ausentes ou pendentes e recusa token expirado", async () => {
    const messages: { token: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
      messages.push(JSON.parse(String(init.body)) as { token: string });
      return new Response(null, { status: 204 });
    }));
    await runWithTenantContext(TENANT_A, () => requestPasswordRecovery("ausente@example.test", "192.0.2.5", "ceti"));
    const pending = await runWithTenantContext(TENANT_A, () => createUserFixture({ email: "pendente@example.test", status: "PENDING" }));
    await runWithTenantContext(TENANT_A, () => requestPasswordRecovery(pending.user.email, "192.0.2.5", "ceti"));
    expect(messages).toHaveLength(0);
    const active = await runWithTenantContext(TENANT_A, () => createUserFixture({ email: "expired@example.test" }));
    await runWithTenantContext(TENANT_A, () => requestPasswordRecovery(active.user.email, "192.0.2.5", "ceti"));
    await runWithTenantContext(TENANT_A, () => prisma.passwordReset.updateMany({ where: { userId: active.user.id }, data: { expiresAt: new Date(Date.now() - 1_000) } }));
    expect(await runWithTenantContext(TENANT_A, () => confirmPasswordRecovery(messages[0]!.token, "senha-nova", "192.0.2.5"))).toBe(false);
    const limited = await runWithTenantContext(TENANT_A, () => createUserFixture({ email: "limited@example.test" }));
    for (let i = 0; i < 4; i++) await runWithTenantContext(TENANT_A, () => requestPasswordRecovery(limited.user.email, "192.0.2.6", "ceti"));
    expect(messages).toHaveLength(4);
  });
});
