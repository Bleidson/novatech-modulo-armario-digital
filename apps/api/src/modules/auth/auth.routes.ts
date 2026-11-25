import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, logout, me, updateMe, supportEntry, signup, pendingProfessors, approve, reject } from "./auth.controller.js";
import { asyncHandler } from "../../shared/middlewares/asyncHandler.js";
import { requireAuth, requireRole } from "../../shared/middlewares/auth.js";
import { z } from "zod";
import { requestPasswordRecovery, confirmPasswordRecovery } from "./passwordRecovery.service.js";
import { logger } from "../../shared/logger.js";
import { env } from "../../shared/env.js";

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "TOO_MANY_ATTEMPTS", message: "Muitas tentativas de login. Tente novamente mais tarde." },
  },
});

// Cadastro publico e alvo de abuso classico (criar contas em massa) - limite mais
// generoso que login (nao e brute force de senha), mas ainda assim finito.
const signupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "TOO_MANY_ATTEMPTS", message: "Muitas tentativas de cadastro. Tente novamente mais tarde." },
  },
});

export const authRouter = Router();

// Endpoint UNICO (detecta Administrador via Core vs Professor local de forma
// transparente - ver auth.controller.ts).
authRouter.post("/login", loginRateLimiter, asyncHandler(login));
authRouter.post("/password-recovery/request", asyncHandler(async (req, res) => {
  const started = Date.now();
  const input = z.object({ email: z.string().trim().email().max(254) }).strict().parse(req.body);
  if (!env.CORE_RECOVERY_API_URL || !env.CORE_RECOVERY_SERVICE_TOKEN) { res.status(503).json({ success: false, error: { code: "RECOVERY_UNAVAILABLE", message: "Recuperação indisponível no momento. Tente mais tarde." } }); return; }
  await requestPasswordRecovery(input.email, req.ip ?? "unknown", req.tenant!.slug).catch(() => { logger.error("RECOVERY_REQUEST_FAILED"); });
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, 2_000 - (Date.now() - started))));
  res.json({ success: true, data: { message: "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha." } });
}));
authRouter.post("/password-recovery/confirm", asyncHandler(async (req, res) => {
  const input = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: z.string().min(8).max(200).refine((value) => Buffer.byteLength(value, "utf8") <= 72) }).strict().parse(req.body);
  const ok = await confirmPasswordRecovery(input.token, input.password, req.ip ?? "unknown");
  if (!ok) { res.status(400).json({ success: false, error: { code: "RECOVERY_INVALID", message: "Link inválido ou expirado. Solicite outro link." } }); return; }
  res.json({ success: true, data: { message: "Senha alterada. Entre com a nova senha." } });
}));
// Cadastro publico do Professor - sem requireAuth, qualquer um pode chamar. Sempre
// nasce PENDING (ver auth.service.ts).
authRouter.post("/signup", signupRateLimiter, asyncHandler(signup));
// GET, nao POST: destino de um REDIRECT de navegador (painel admin Novatech).
authRouter.get("/support-entry", asyncHandler(supportEntry));
authRouter.post("/logout", asyncHandler(logout));
authRouter.get("/me", requireAuth, me);
// Pagina "Conta" do professor (ver auth.controller.ts updateMe - 403 se ADMIN).
authRouter.patch("/me", requireAuth, asyncHandler(updateMe));

// Fila de aprovacao de Professor - exclusiva do ADMIN da escola.
authRouter.get("/professors/pending", requireAuth, requireRole("ADMIN"), asyncHandler(pendingProfessors));
authRouter.post("/professors/:id/approve", requireAuth, requireRole("ADMIN"), asyncHandler(approve));
authRouter.post("/professors/:id/reject", requireAuth, requireRole("ADMIN"), asyncHandler(reject));
