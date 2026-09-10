import type { NextFunction, Request, Response } from "express";

// Express 4 nao propaga rejeicao de handler async para o errorHandler
// automaticamente - todo handler assincrono de rota deve passar por aqui para nao
// travar a requisicao em erro.
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}
