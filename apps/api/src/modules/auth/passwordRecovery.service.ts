import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { withCurrentTenant } from "../../shared/prisma.js";
import { env } from "../../shared/env.js";
import { logger } from "../../shared/logger.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

async function consumeLimit(key: string, limit: number) {
  return withCurrentTenant(async (tx) => {
    const rows = await tx.$queryRaw<{ count: number }[]>`
      INSERT INTO password_recovery_limits (tenant_id, key, count, window_start)
      VALUES (current_setting('app.tenant_id')::uuid, ${key}, 1, now())
      ON CONFLICT (tenant_id, key) DO UPDATE SET
        count = CASE WHEN password_recovery_limits.window_start < now() - interval '1 hour' THEN 1 ELSE password_recovery_limits.count + 1 END,
        window_start = CASE WHEN password_recovery_limits.window_start < now() - interval '1 hour' THEN now() ELSE password_recovery_limits.window_start END
      RETURNING count`;
    return (rows[0]?.count ?? limit + 1) <= limit;
  });
}

export async function requestPasswordRecovery(email: string, ip: string, tenantSlug: string) {
  const normalized = email.trim().toLowerCase();
  const [allowed, ipAllowed] = await Promise.all([consumeLimit(`email:${hash(normalized)}`, 3), consumeLimit(`ip:${hash(ip)}`, 10)]);
  if (!allowed || !ipAllowed) return;
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const user = await withCurrentTenant(async (tx) => {
    const matches = await tx.user.findMany({ where: { email: { equals: normalized, mode: "insensitive" }, role: "PROFESSOR", status: "ACTIVE" }, select: { id: true, email: true }, take: 2 });
    const candidate = matches.length === 1 ? matches[0] : null;
    if (!candidate) return null;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${candidate.id}))`;
    await tx.passwordReset.updateMany({ where: { userId: candidate.id, usedAt: null }, data: { usedAt: now } });
    await tx.passwordReset.create({ data: { userId: candidate.id, tokenHash: hash(token), expiresAt: new Date(now.getTime() + 30 * 60_000) } });
    return candidate;
  });
  if (!user) return;
  if (!env.CORE_RECOVERY_API_URL || !env.CORE_RECOVERY_SERVICE_TOKEN) { logger.error("RECOVERY_EMAIL_UNAVAILABLE"); return; }
  try {
    const response = await fetch(`${env.CORE_RECOVERY_API_URL.replace(/\/$/, "")}/api/communications/armario-password-recovery`, {
      method: "POST", headers: { "content-type": "application/json", "x-internal-token": env.CORE_RECOVERY_SERVICE_TOKEN },
      body: JSON.stringify({ email: user.email, token, tenantSlug }), signal: AbortSignal.timeout(Math.min(env.CORE_CLIENT_TIMEOUT_MS, 1_200)),
    });
    if (!response.ok) logger.error("RECOVERY_EMAIL_UNAVAILABLE");
  } catch { logger.error("RECOVERY_EMAIL_UNAVAILABLE"); }
}

export async function confirmPasswordRecovery(token: string, password: string, ip: string) {
  const [allowed, ipAllowed] = await Promise.all([consumeLimit(`token:${hash(token)}`, 10), consumeLimit(`confirm-ip:${hash(ip)}`, 30)]);
  if (!allowed || !ipAllowed) return false;
  const reset = await withCurrentTenant((tx) => tx.passwordReset.findUnique({ where: { tokenHash: hash(token) }, include: { user: { select: { status: true, role: true } } } }));
  if (!reset || reset.usedAt || reset.expiresAt <= new Date() || reset.user.status !== "ACTIVE" || reset.user.role !== "PROFESSOR") return false;
  const passwordHash = await bcrypt.hash(password, 10);
  return withCurrentTenant(async (tx) => {
    const now = new Date();
    const claimed = await tx.passwordReset.updateMany({ where: { id: reset.id, usedAt: null, expiresAt: { gt: now }, user: { status: "ACTIVE", role: "PROFESSOR" } }, data: { usedAt: now } });
    if (claimed.count !== 1) return false;
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
    await tx.passwordReset.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: now } });
    await tx.session.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: now } });
    return true;
  });
}
