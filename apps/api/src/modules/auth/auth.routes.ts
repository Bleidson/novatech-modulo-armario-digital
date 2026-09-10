import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, logout, me, updateMe, supportEntry, signup, pendingProfessors, approve, reject } from "./auth.controller.js";
import { asyncHandler } from "../../shared/middlewares/asyncHandler.js";
import { requireAuth, requireRole } from "../../shared/middlewares/auth.js";

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
