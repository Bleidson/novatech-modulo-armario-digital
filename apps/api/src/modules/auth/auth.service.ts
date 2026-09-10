import bcrypt from "bcryptjs";
import { prisma } from "../../shared/prisma.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { professorSignupSchema, updateOwnProfileSchema } from "./auth.validation.js";
import type { z } from "zod";

// Autenticacao LOCAL - so Professor. ADMIN e SEMPRE recusado aqui de proposito (a
// senha do Administrador nunca existe neste banco, so na Core) - o controller tenta
// este caminho primeiro e, se falhar, cai para coreClient.login(). Mesmo padrao
// arquitetural do modulo Restaurante (endpoint UNICO de login, deteccao transparente).
export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findFirst({ where: { email, role: "PROFESSOR" } });
  const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
  const ok = await bcrypt.compare(password, hash);

  if (!user || !ok) {
    throw AppError.unauthorized("Email ou senha invalidos.");
  }

  if (user.status === "PENDING") {
    throw AppError.forbidden("Seu cadastro ainda esta aguardando aprovacao da coordenacao.");
  }
  if (user.status === "REJECTED") {
    throw AppError.forbidden("Seu cadastro nao foi aprovado. Entre em contato com a coordenacao.");
  }
  if (user.status === "SUSPENDED") {
    throw AppError.forbidden("Seu acesso foi suspenso. Entre em contato com a coordenacao.");
  }

  return user;
}

// POST /auth/signup (publico, sem sessao) - Professor se cadastra sozinho e comeca
// PENDING. Nunca loga automaticamente depois de criar a conta: precisa esperar um
// ADMIN aprovar (ver approveProfessor/rejectProfessor).
export async function signupProfessor(input: z.infer<typeof professorSignupSchema>) {
  const existing = await prisma.user.findFirst({ where: { email: input.email } });
  if (existing) {
    throw AppError.conflict("Ja existe um cadastro com este e-mail.");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: "PROFESSOR",
      status: "PENDING",
    },
  });
}

export async function listPendingProfessors() {
  return prisma.user.findMany({
    where: { role: "PROFESSOR", status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
}

export async function approveProfessor(id: string, approvedBy: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "PROFESSOR") {
    throw AppError.notFound("Professor nao encontrado.");
  }
  if (user.status !== "PENDING") {
    throw AppError.conflict("Este cadastro ja foi processado.");
  }

  return prisma.user.update({
    where: { id },
    data: { status: "ACTIVE", approvedBy, approvedAt: new Date() },
  });
}

// PATCH /auth/me - pagina "Conta" do professor. So PROFESSOR: o ADMIN e uma
// projecao local da Account da Core (upsertAdminProjection), e o proprio nome
// dela e sobrescrito a cada verificacao de sessao - editar aqui pareceria
// funcionar e sumiria no proximo login. Nunca mexe em email/status/role.
export async function updateOwnProfile(caller: { id: string; role: string }, input: z.infer<typeof updateOwnProfileSchema>) {
  if (caller.role !== "PROFESSOR") {
    throw AppError.forbidden("Apenas professores podem editar os proprios dados aqui.");
  }

  return prisma.user.update({
    where: { id: caller.id },
    data: { name: input.name, phone: input.phone },
  });
}

export async function rejectProfessor(id: string, rejectedBy: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "PROFESSOR") {
    throw AppError.notFound("Professor nao encontrado.");
  }
  if (user.status !== "PENDING") {
    throw AppError.conflict("Este cadastro ja foi processado.");
  }

  return prisma.user.update({
    where: { id },
    data: { status: "REJECTED", approvedBy: rejectedBy, approvedAt: new Date() },
  });
}
