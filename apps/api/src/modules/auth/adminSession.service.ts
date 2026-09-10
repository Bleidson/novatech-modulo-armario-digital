import type { Response } from "express";
import type { AuthResult } from "../../lib/core-client.js";
import { prisma } from "../../shared/prisma.js";
import { env } from "../../shared/env.js";

// Cookie da sessao do ADMINISTRADOR (a Account da Core) - deliberadamente um nome
// DIFERENTE de SESSION_COOKIE_NAME (session.service.ts, usado por Professor): a
// distincao entre os dois mecanismos precisa ser explicita e verificavel no codigo,
// nunca inferida a partir do formato do token.
export const ADMIN_SESSION_COOKIE_NAME = "pdp_admin_session";

export function setAdminSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(ADMIN_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    domain: env.COOKIE_DOMAIN,
    expires: expiresAt,
    path: "/",
  });
}

export function clearAdminSessionCookie(res: Response): void {
  res.clearCookie(ADMIN_SESSION_COOKIE_NAME, { path: "/", domain: env.COOKIE_DOMAIN });
}

// Placeholder de passwordHash pro registro local (projecao) do Administrador - a
// senha de verdade mora so na Core, nunca aqui. Formato valido de bcrypt hash, mas
// matematicamente impossivel de bater com qualquer bcrypt.compare real - so existe
// para o campo NOT NULL do schema, nunca e comparado contra nada.
export const CORE_MANAGED_PASSWORD_PLACEHOLDER =
  "$2a$10$CoreManagedAccountNoLocalPasswordxxxxxxxxxxxxxxxxxxx";

// Projecao local minima do Administrador (name/email/role), atualizada a cada
// verificacao - a Core e quem manda no dado. Correlacao por (tenant atual + email),
// NUNCA por auth.userId como chave primaria local - o id que a Core emite e o id do
// MODULO nunca precisaram ser o mesmo valor.
export async function upsertAdminProjection(auth: AuthResult) {
  const existing = await prisma.user.findFirst({ where: { email: auth.email } });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { name: auth.name, role: "ADMIN", status: "ACTIVE" },
    });
  }

  return prisma.user.create({
    data: {
      name: auth.name,
      email: auth.email,
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: CORE_MANAGED_PASSWORD_PLACEHOLDER,
    },
  });
}
