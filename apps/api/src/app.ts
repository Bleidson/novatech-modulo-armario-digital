import express, { Router } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { env } from "./shared/env.js";
import { logger } from "./shared/logger.js";
import { basePrisma } from "./shared/prisma.js";
import { errorHandler, notFoundHandler } from "./shared/middlewares/errorHandler.js";
import { requireCsrfToken } from "./shared/middlewares/csrf.js";
import { resolveTenant } from "./shared/middlewares/tenant.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { uploadsRouter } from "./modules/uploads/uploads.routes.js";
import { materialsRouter } from "./modules/materials/materials.routes.js";
import { classPeriodsRouter } from "./modules/classPeriods/classPeriods.routes.js";
import { internalRouter } from "./modules/internal/internal.routes.js";
import { reservationsRouter } from "./modules/reservations/reservations.routes.js";
import { UPLOADS_ROOT } from "./shared/uploadsDir.js";

// Rede de seguranca ampla contra abuso de qualquer endpoint - inclusive
// administrativo - sem atrapalhar uso legitimo (professor/coordenacao operando o
// dia inteiro). Health check fica fora por nao ser alvo de abuso relevante.
const generalRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "TOO_MANY_REQUESTS", message: "Muitas requisicoes. Tente novamente em instantes." },
  },
});

// Tudo que precisa de uma escola resolvida (publica ou autenticada) - montado sob
// "/api/v1/:tenantSlug" (app.ts), nunca em host nenhum.
const tenantScopedRouter = Router({ mergeParams: true });
tenantScopedRouter.use(resolveTenant);

tenantScopedRouter.get("/health", (req, res) => {
  res.json({
    success: true,
    data: {
      tenantId: req.tenant?.id,
      slug: req.tenant?.slug,
      status: req.tenant?.status,
      phone: req.tenant?.settings.phone ?? null,
    },
  });
});

tenantScopedRouter.use("/auth", authRouter);
tenantScopedRouter.use("/uploads", uploadsRouter);
tenantScopedRouter.use("/materials", materialsRouter);
tenantScopedRouter.use("/class-periods", classPeriodsRouter);
tenantScopedRouter.use("/reservations", reservationsRouter);

export function createApp() {
  const app = express();

  // Confia so no primeiro hop do proxy reverso em producao (Traefik) - inofensivo em
  // dev, onde nao ha proxy nenhum e o header nunca chega.
  app.set("trust proxy", 1);

  app.use(cors({ origin: env.APP_URL, credentials: true }));
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(express.json({ limit: "200kb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));
  app.use(requireCsrfToken);
  app.use("/uploads", express.static(UPLOADS_ROOT));

  // Servidor-a-servidor com a Core (offboarding, manutencao, setup do wizard) - fora
  // de /api/v1 de proposito, nunca passa por resolveTenant nem pelo rate limiter de
  // trafego de usuario final.
  app.use("/internal", internalRouter);

  app.use("/api/v1", generalRateLimiter);

  // Health checks SEM tenant - ANTES do mount generico "/:tenantSlug" abaixo, de
  // proposito (Express casa o primeiro middleware cujo padrao bate).
  app.get("/api/v1/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok", env: env.NODE_ENV } });
  });

  app.get("/api/v1/health/db", async (_req, res, next) => {
    try {
      await basePrisma.$queryRaw`SELECT 1`;
      res.json({ success: true, data: { status: "ok", database: "connected" } });
    } catch (err) {
      next(err);
    }
  });

  // Estrutura de dominio por PATH (decisao de 13/09/2026): o Host identifica so
  // o MODULO (ntarmario.nthub.online, fixo); quem identifica a escola e o
  // PRIMEIRO SEGMENTO DO PATH, extraido aqui e resolvido em resolveTenant.
  app.use("/api/v1/:tenantSlug", tenantScopedRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
