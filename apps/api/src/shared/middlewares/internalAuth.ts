import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { AppError } from "../errors/AppError.js";
import { env } from "../env.js";

const HEADER = "x-internal-token";

interface ServiceAuthContext {
  serviceId: string;
  scopes: readonly string[];
  mode: "scoped" | "legacy";
}

function sameSecret(provided: string, expected: string) {
  const given = Buffer.from(provided);
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

function authenticateService(token: string): ServiceAuthContext | null {
  if (env.serviceCredentials.length === 0) {
    return sameSecret(token, env.CORE_INTERNAL_TOKEN)
      ? { serviceId: "legacy-internal", scopes: [], mode: "legacy" }
      : null;
  }

  for (const credential of env.serviceCredentials) {
    if (sameSecret(token, credential.token)) {
      return { serviceId: credential.serviceId, scopes: credential.scopes, mode: "scoped" };
    }
  }
  return null;
}

// Autentica chamadas SERVIDOR-A-SERVIDOR vindas da Core ou do novatech-site (nunca
// usuario final nem painel da escola) - hoje so as rotas em modules/internal
// (offboarding, manutencao, setup, setup-schema). Comparacao em tempo constante
// (timingSafeEqual) - mesmo padrao do modulo Restaurante.
export function requireInternalToken(req: Request, res: Response, next: NextFunction): void {
  const provided = req.headers[HEADER];

  if (typeof provided !== "string" || provided.length === 0) {
    next(AppError.unauthorized());
    return;
  }

  const auth = authenticateService(provided);
  if (!auth) {
    next(AppError.unauthorized());
    return;
  }

  res.locals["serviceAuth"] = auth;
  next();
}

export function requireInternalScope(scope: string) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const auth = res.locals["serviceAuth"] as ServiceAuthContext | undefined;
    if (!auth) {
      next(AppError.unauthorized());
      return;
    }
    if (auth.mode === "legacy" || auth.scopes.includes(scope)) {
      next();
      return;
    }
    next(new AppError("SERVICE_SCOPE_FORBIDDEN", "Credencial sem permissao para esta operacao.", 403));
  };
}
