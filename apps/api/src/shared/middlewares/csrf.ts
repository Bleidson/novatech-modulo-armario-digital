import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError.js";
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from "../../modules/auth/session.service.js";

const CSRF_HEADER_NAME = "x-csrf-token";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Double-submit cookie - defesa em profundidade alem de SameSite=Lax + CORS de origem
// explicita. So se aplica quando a requisicao ja carrega o cookie de sessao local
// (pdp_session); GET/HEAD/OPTIONS nunca mutam estado, passam direto.
export function requireCsrfToken(req: Request, _res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  const sessionCookie = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  if (!sessionCookie) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME] as string | undefined;
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    next(AppError.forbidden("Token CSRF ausente ou invalido."));
    return;
  }

  next();
}
