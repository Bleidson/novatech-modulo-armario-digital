import { randomBytes, createHash } from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "../../shared/prisma.js";
import { env } from "../../shared/env.js";

// Sessao opaca stateful (decisao fixa de plataforma, nunca JWT). O cookie carrega o
// token em texto puro; o banco guarda apenas o hash (sha256) - um dump da tabela
// `sessions` nunca permite sequestrar uma sessao ativa.
export const SESSION_COOKIE_NAME = "pdp_session";
const SESSION_TTL_HOURS = 12;
const SESSION_RENEW_THRESHOLD_MINUTES = 5;

// Double-submit cookie - defesa em profundidade alem de SameSite=Lax + CORS de
// origem explicita. Sem estado no servidor: o middleware so compara este cookie
// (nao-httpOnly, o frontend precisa le-lo em JS) com o header X-CSRF-Token.
export const CSRF_COOKIE_NAME = "pdp_csrf";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function ttlFromNow(): Date {
  return new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
}

export async function createSession(
  userId: string,
  req: Pick<Request, "headers" | "ip">,
) {
  const token = randomBytes(32).toString("hex");

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: ttlFromNow(),
      userAgent: req.headers["user-agent"] ?? null,
      ipAddress: req.ip ?? null,
    },
  });

  return token;
}

export async function validateSessionToken(token: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.revokedAt !== null || session.expiresAt < new Date()) {
    return null;
  }

  // So ACTIVE loga - PENDING (aguardando aprovacao do ADMIN), REJECTED e SUSPENDED
  // nunca autenticam, mesmo com token valido.
  if (session.user.status !== "ACTIVE") {
    return null;
  }

  const minutesSinceLastSeen = (Date.now() - session.lastSeenAt.getTime()) / 60_000;
  if (minutesSinceLastSeen >= SESSION_RENEW_THRESHOLD_MINUTES) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: ttlFromNow() },
    });
  }

  return session.user;
}

export async function revokeSessionToken(token: string) {
  await prisma.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    domain: env.COOKIE_DOMAIN,
    maxAge: SESSION_TTL_HOURS * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/", domain: env.COOKIE_DOMAIN });
}

export function setCsrfCookie(res: Response): void {
  res.cookie(CSRF_COOKIE_NAME, randomBytes(32).toString("hex"), {
    httpOnly: false,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    domain: env.COOKIE_DOMAIN,
    maxAge: SESSION_TTL_HOURS * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearCsrfCookie(res: Response): void {
  res.clearCookie(CSRF_COOKIE_NAME, { path: "/", domain: env.COOKIE_DOMAIN });
}
