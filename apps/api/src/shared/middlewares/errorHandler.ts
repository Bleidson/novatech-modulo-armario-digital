import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";
import { logger } from "../logger.js";
import { env } from "../env.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: { code: "RESOURCE_NOT_FOUND", message: `Rota nao encontrada: ${req.method} ${req.path}` },
  });
}

// body-parser (via http-errors) lanca SyntaxError/PayloadTooLargeError com
// statusCode/expose proprios - nao sao AppError, mas ja carregam o status HTTP
// correto. Sem isto, cairiam no branch generico e sempre virariam 500.
function asClientBodyErrorStatus(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;
  const candidate = err as { statusCode?: unknown; status?: unknown; expose?: unknown };
  if (candidate.expose !== true) return null;
  const code = typeof candidate.statusCode === "number" ? candidate.statusCode : candidate.status;
  return typeof code === "number" && code >= 400 && code < 500 ? code : null;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Dados invalidos.", details: err.flatten() },
    });
    return;
  }

  const clientBodyErrorStatus = asClientBodyErrorStatus(err);
  if (clientBodyErrorStatus !== null) {
    res.status(clientBodyErrorStatus).json({
      success: false,
      error: { code: "INVALID_REQUEST_BODY", message: "Corpo da requisicao invalido ou grande demais." },
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err }, "Erro interno tratado");
    }
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details ?? null },
    });
    return;
  }

  logger.error({ err }, "Erro nao tratado");

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Erro interno. Tente novamente.",
      // nunca expor stack trace em producao
      details: env.NODE_ENV === "development" ? String(err) : null,
    },
  });
}
