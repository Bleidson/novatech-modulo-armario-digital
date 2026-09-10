import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { AppError } from "../errors/AppError.js";
import { env } from "../env.js";

const HEADER = "x-internal-token";

// Autentica chamadas SERVIDOR-A-SERVIDOR vindas da Core ou do novatech-site (nunca
// usuario final nem painel da escola) - hoje so as rotas em modules/internal
// (offboarding, manutencao, setup, setup-schema). Comparacao em tempo constante
// (timingSafeEqual) - mesmo padrao do modulo Restaurante.
export function requireInternalToken(req: Request, _res: Response, next: NextFunction): void {
  const provided = req.headers[HEADER];

  if (typeof provided !== "string" || provided.length === 0) {
    next(AppError.unauthorized());
    return;
  }

  const expected = Buffer.from(env.CORE_INTERNAL_TOKEN);
  const given = Buffer.from(provided);

  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    next(AppError.unauthorized());
    return;
  }

  next();
}
