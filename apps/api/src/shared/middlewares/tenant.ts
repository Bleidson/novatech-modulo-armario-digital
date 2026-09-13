import type { NextFunction, Request, Response } from "express";
import { coreClient } from "../../lib/core-client.js";
import { AppError } from "../errors/AppError.js";
import { runWithTenantContext } from "../tenantContext.js";

const SLUG_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Resolucao de tenant por SLUG (decisao de 13/09/2026: estrutura de dominio por
// path, "ntarmario.nthub.online/{slug}/..." em vez de "armario-digital.nthub.online"
// - evita registrar/gerenciar um dominio por escola e resolve a colisao de rede
// Docker que causava demo.nthub.online abrir o modulo errado) - a segunda das
// tres camadas de isolamento da plataforma (a primeira e o Traefik, a terceira
// e a RLS do Postgres). O slug vem do PRIMEIRO SEGMENTO DO PATH (app.ts monta
// os routers sob "/api/v1/:tenantSlug"), nunca do Host.
//
//   curl http://localhost:3401/api/v1/ceti/health/tenant
export async function resolveTenant(req: Request, _res: Response, next: NextFunction) {
  const slug = req.params["tenantSlug"];

  if (!slug || !SLUG_FORMAT.test(slug)) {
    next(AppError.notFound("Nenhuma escola atende este endereco."));
    return;
  }

  try {
    const tenant = await coreClient.resolveTenantBySlug(slug);

    if (!tenant) {
      next(AppError.notFound("Nenhuma escola atende este endereco."));
      return;
    }

    if (tenant.status === "suspended") {
      next(
        AppError.forbidden(
          "Este espaco esta temporariamente indisponivel. Entre em contato com o suporte.",
        ),
      );
      return;
    }

    req.tenant = tenant;
    runWithTenantContext(tenant.id, () => next(), tenant);
  } catch (err) {
    next(err);
  }
}
