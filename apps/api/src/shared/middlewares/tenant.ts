import type { NextFunction, Request, Response } from "express";
import { coreClient } from "../../lib/core-client.js";
import { AppError } from "../errors/AppError.js";
import { runWithTenantContext } from "../tenantContext.js";
import { normalizeHost } from "../normalizeHost.js";

// Resolucao de tenant por dominio - a segunda das tres camadas de isolamento da
// plataforma (a primeira e o Traefik, a terceira e a RLS do Postgres). Mesmo padrao
// do modulo Restaurante.
//
//   curl -H "Host: ceti.localhost" http://localhost:3401/api/v1/health/tenant
export async function resolveTenant(req: Request, _res: Response, next: NextFunction) {
  const host = req.headers.host;

  if (!host) {
    next(AppError.validation("Requisicao sem header Host - impossivel identificar a escola."));
    return;
  }

  try {
    const tenant = await coreClient.resolveTenantByDomain(normalizeHost(host));

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
