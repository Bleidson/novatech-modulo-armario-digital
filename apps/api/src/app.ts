import express from "express";
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
import { internalRouter } from "./modules/internal/internal.routes.js";
import { reservationsRouter } from "./modules/reservations/reservations.routes.js";
import { UPLOADS_ROOT } from "./shared/uploadsDir.js";
// Rotas de dominio adicionadas pelos teammates B (materiais, class-periods, painel
// admin) e C (reservas, agenda do professor) - mount points ja reservados abaixo,
// ver comentario "MODULOS DE DOMINIO".

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

  app.get("/api/v1/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok", env: env.NODE_ENV } });
  });

  // Servidor-a-servidor com a Core (offboarding, manutencao, setup do wizard) - fora
  // de /api/v1 de proposito, nunca passa por resolveTenant nem pelo rate limiter de
  // trafego de usuario final.
  app.use("/internal", internalRouter);

  app.use("/api/v1", generalRateLimiter);

  // Resolucao de tenant por dominio (Novatech Platform) - a partir daqui toda rota,
  // publica ou autenticada, corre no contexto de uma escola especifica.
  app.use("/api/v1", resolveTenant);

  app.get("/api/v1/health/tenant", (req, res) => {
    res.json({
      success: true,
      data: {
        host: req.headers.host,
        tenantId: req.tenant?.id,
        slug: req.tenant?.slug,
        status: req.tenant?.status,
        // Telefone da coordenacao (Core-provided, ver TenantInfo.settings em
        // lib/core-client.ts) - mesmo dado publico de contato exibido em qualquer
        // fachada da escola, sem risco em expor num endpoint sem auth. Usado pelo
        // botao "falar com a coordenacao pelo WhatsApp" (Teammate C, catalogo/
        // minhas reservas do professor).
        phone: req.tenant?.settings.phone ?? null,
      },
    });
  });

  app.get("/api/v1/health/db", async (_req, res, next) => {
    try {
      await basePrisma.$queryRaw`SELECT 1`;
      res.json({ success: true, data: { status: "ok", database: "connected" } });
    } catch (err) {
      next(err);
    }
  });

  // --- MODULOS DE DOMINIO ---------------------------------------------------
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/uploads", uploadsRouter);
  // Teammate B monta aqui: /api/v1/materials, /api/v1/class-periods
  app.use("/api/v1/reservations", reservationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
