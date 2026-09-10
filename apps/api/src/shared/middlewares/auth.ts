import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { AppError } from "../errors/AppError.js";
import { SESSION_COOKIE_NAME, validateSessionToken } from "../../modules/auth/session.service.js";
import { ADMIN_SESSION_COOKIE_NAME, upsertAdminProjection } from "../../modules/auth/adminSession.service.js";
import { coreClient } from "../../lib/core-client.js";

// Dois mecanismos de sessao, nunca misturados, distinguidos pelo COOKIE que chegou
// (nunca inferido do formato/conteudo do token) - mesmo padrao arquitetural da
// plataforma (ja usado no modulo Restaurante):
//
//   pdp_admin_session -> Administrador, a Account da Core. Verificado via
//                        coreClient.verifySession() - o UNICO papel que fala com a Core.
//   pdp_session       -> Professor, sessao 100% local do modulo (session.service.ts).
//                        NUNCA passa por coreClient.
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const adminToken = req.cookies?.[ADMIN_SESSION_COOKIE_NAME] as string | undefined;
  const localToken = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

  try {
    if (adminToken) {
      await authenticateViaAdminCookie(req, adminToken);
      next();
      return;
    }

    if (localToken) {
      const user = await validateSessionToken(localToken);
      if (!user) {
        next(AppError.unauthorized());
        return;
      }
      req.user = { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
      next();
      return;
    }

    next(AppError.unauthorized());
  } catch (err) {
    // Express 4 nao propaga rejeicao de middleware async automaticamente.
    next(err);
  }
}

async function authenticateViaAdminCookie(req: Request, token: string): Promise<void> {
  const auth = await coreClient.verifySession(token);
  if (!auth) {
    throw AppError.unauthorized();
  }

  // Defesa em profundidade: o tenant que o dominio resolveu e o tenant do token tem
  // que ser o mesmo - apresentar o token da escola B no dominio da escola A nunca
  // pode autenticar.
  if (req.tenant && auth.tenantId !== req.tenant.id) {
    throw AppError.unauthorized();
  }

  // A Core so emite sessao pra ADMIN - qualquer outro valor aqui e uma anomalia do
  // lado da Core (falha fechado).
  if (auth.role !== "ADMIN") {
    throw AppError.unauthorized();
  }

  const user = await upsertAdminProjection(auth);

  req.user = { id: user.id, name: user.name, email: user.email, phone: user.phone, role: "ADMIN" };
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden());
      return;
    }
    next();
  };
}
