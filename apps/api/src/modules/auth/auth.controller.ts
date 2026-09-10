import type { Request, Response } from "express";
import { loginSchema, professorSignupSchema, rejectProfessorSchema, updateOwnProfileSchema } from "./auth.validation.js";
import {
  authenticate,
  signupProfessor,
  listPendingProfessors,
  approveProfessor,
  rejectProfessor,
  updateOwnProfile,
} from "./auth.service.js";
import {
  createSession,
  revokeSessionToken,
  setSessionCookie,
  clearSessionCookie,
  setCsrfCookie,
  clearCsrfCookie,
  SESSION_COOKIE_NAME,
} from "./session.service.js";
import { setAdminSessionCookie, clearAdminSessionCookie, ADMIN_SESSION_COOKIE_NAME } from "./adminSession.service.js";
import { coreClient } from "../../lib/core-client.js";
import { requireTenantId } from "../../shared/tenantContext.js";
import { AppError } from "../../shared/errors/AppError.js";

// Endpoint UNICO de login - mesma decisao arquitetural do modulo Restaurante
// (Especificacao Tecnica Secao 4.5). Quem loga nunca escolhe "sou coordenador" ou
// "sou professor" - tenta o caminho LOCAL primeiro (authenticate(), so Professor -
// ADMIN e sempre recusado ali) e so se falhar tenta a Core (coreClient.login()). As
// duas mensagens de erro sao identicas - nunca revela qual caminho foi tentado.
export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);

  try {
    const user = await authenticate(email, password);
    const token = await createSession(user.id, req);
    setSessionCookie(res, token);
    setCsrfCookie(res);
    res.json({
      success: true,
      data: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    });
    return;
  } catch (err) {
    // Falha de status (PENDING/REJECTED/SUSPENDED) e do usuario que EXISTE - nao faz
    // sentido tentar a Core (a Core nunca vai conhecer esse e-mail de Professor).
    // So tenta a Core quando o motivo foi "nao achei localmente" (401).
    if (err instanceof AppError && err.statusCode === 403) {
      throw err;
    }

    const tenantId = requireTenantId();
    const result = await coreClient.login(tenantId, email, password).catch(() => null);
    if (!result) {
      throw AppError.unauthorized("Email ou senha invalidos.");
    }

    setAdminSessionCookie(res, result.token, new Date(result.expiresAt));
    setCsrfCookie(res);
    res.json({
      success: true,
      // phone: null - a Core (dona da Account do Administrador) nao modela
      // telefone, so o professor tem (ver auth.service.ts updateOwnProfile).
      data: { id: result.auth.userId, name: result.auth.name, email: result.auth.email, phone: null, role: result.auth.role },
    });
  }
}

// Cadastro publico do Professor - sempre PENDING, nunca cria sessao (ver
// auth.service.ts signupProfessor).
export async function signup(req: Request, res: Response) {
  const input = professorSignupSchema.parse(req.body);
  const user = await signupProfessor(input);
  res.status(201).json({
    success: true,
    data: { id: user.id, name: user.name, email: user.email, status: user.status },
  });
}

// "Entrar como suporte" (painel admin Novatech) - alvo de um REDIRECT de navegador,
// disparado pelo painel depois de emitir o grant na Core.
export async function supportEntry(req: Request, res: Response) {
  const token = typeof req.query["token"] === "string" ? req.query["token"] : null;
  if (!token) throw AppError.validation("Token de suporte ausente.");

  const result = await coreClient.redeemSupportGrant(token);
  if (!result) {
    res.redirect(302, "/login?erro=suporte_invalido");
    return;
  }

  setAdminSessionCookie(res, result.token, new Date(result.expiresAt));
  setCsrfCookie(res);
  res.redirect(302, "/");
}

export async function logout(req: Request, res: Response) {
  const localToken = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  const adminToken = req.cookies?.[ADMIN_SESSION_COOKIE_NAME] as string | undefined;

  if (localToken) {
    await revokeSessionToken(localToken);
    clearSessionCookie(res);
  }
  if (adminToken) {
    await coreClient.logout(adminToken);
    clearAdminSessionCookie(res);
  }
  clearCsrfCookie(res);
  res.status(204).send();
}

export function me(req: Request, res: Response) {
  res.json({ success: true, data: req.user });
}

// PATCH /auth/me - pagina "Conta" do professor (ver auth.service.ts
// updateOwnProfile - 403 se quem chama nao for PROFESSOR).
export async function updateMe(req: Request, res: Response) {
  const input = updateOwnProfileSchema.parse(req.body);
  const user = await updateOwnProfile({ id: req.user!.id, role: req.user!.role }, input);
  res.json({ success: true, data: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
}

// Fila de aprovacao - so ADMIN (requireRole na rota).
export async function pendingProfessors(_req: Request, res: Response) {
  const professors = await listPendingProfessors();
  res.json({ success: true, data: professors });
}

export async function approve(req: Request, res: Response) {
  const id = req.params["id"];
  if (!id) throw AppError.validation();
  const approvedBy = req.user?.id;
  if (!approvedBy) throw AppError.unauthorized();
  const user = await approveProfessor(id, approvedBy);
  res.json({ success: true, data: user });
}

export async function reject(req: Request, res: Response) {
  const id = req.params["id"];
  if (!id) throw AppError.validation();
  rejectProfessorSchema.parse(req.body ?? {});
  const rejectedBy = req.user?.id;
  if (!rejectedBy) throw AppError.unauthorized();
  const user = await rejectProfessor(id, rejectedBy);
  res.json({ success: true, data: user });
}
