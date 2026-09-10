import bcrypt from "bcryptjs";
import type { Role, UserStatus } from "@prisma/client";
import { prisma } from "../shared/prisma.js";
import { runWithTenantContext } from "../shared/tenantContext.js";
import { wipeCurrentTenantData } from "../shared/tenantWipe.js";
import { coreClient } from "../lib/core-client.js";
import { TENANT_A, TENANT_B } from "./tenants.js";

// Banco dedicado a testes (DATABASE_URL de test em setupEnv.ts) - nunca aponta para
// dev/producao, entao apagar tudo entre suites e seguro.
//
// Limpa OS DOIS tenants de teste, um de cada vez: com RLS ligada, um deleteMany so
// alcanca as linhas do tenant que estiver no contexto.
export async function resetDb() {
  for (const tenantId of [TENANT_A, TENANT_B]) {
    await runWithTenantContext(tenantId, () => wipeCurrentTenantData());
  }
}

let fixtureCounter = 0;

export async function createUserFixture(overrides: {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  status?: UserStatus;
} = {}) {
  fixtureCounter += 1;
  const password = overrides.password ?? "Senha1234";
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? `Usuario Teste ${fixtureCounter}`,
      email: overrides.email ?? `user${fixtureCounter}-${Date.now()}@test.local`,
      passwordHash,
      role: overrides.role ?? "PROFESSOR",
      status: overrides.status ?? "ACTIVE",
    },
  });

  return { user, password };
}

// BUG REAL encontrado pela Teammate B: o parametro `tenantId` era aceito mas nunca
// usado - createUserFixture/prisma.session.create rodavam no contexto AMBIENTE
// (o default do processo de teste, TENANT_A - ver setupEnv.ts), entao chamar
// createAdminSessionFixture(TENANT_B) criava silenciosamente um admin no tenant A
// mesmo assim. Corrigido envolvendo todo o corpo em runWithTenantContext(tenantId, ...).
export async function createAdminSessionFixture(tenantId: string = TENANT_A) {
  return runWithTenantContext(tenantId, async () => {
    const { randomBytes, createHash } = await import("node:crypto");
    const { user } = await createUserFixture({ role: "ADMIN", status: "ACTIVE" });
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt,
        userAgent: null,
        ipAddress: null,
      },
    });

    return { user, token };
  });
}

export async function createMaterialFixture(overrides: { name?: string; active?: boolean } = {}) {
  fixtureCounter += 1;
  return prisma.material.create({
    data: {
      name: overrides.name ?? `Material Teste ${fixtureCounter}`,
      active: overrides.active ?? true,
    },
  });
}

export async function createClassPeriodFixture(overrides: { name?: string; displayOrder?: number } = {}) {
  fixtureCounter += 1;
  return prisma.classPeriod.create({
    data: {
      name: overrides.name ?? `Horario Teste ${fixtureCounter}`,
      displayOrder: overrides.displayOrder ?? fixtureCounter,
    },
  });
}

export async function createReservationFixture(overrides: {
  materialId?: string;
  classPeriodId?: string;
  professorId?: string;
  date?: Date;
} = {}) {
  const materialId = overrides.materialId ?? (await createMaterialFixture()).id;
  const classPeriodId = overrides.classPeriodId ?? (await createClassPeriodFixture()).id;
  const professorId = overrides.professorId ?? (await createUserFixture({ role: "PROFESSOR" })).user.id;

  return prisma.reservation.create({
    data: {
      materialId,
      classPeriodId,
      professorId,
      date: overrides.date ?? new Date(),
    },
  });
}

// So para garantir que o MockCoreClient nao carrega config nenhuma entre testes -
// hoje este modulo nao tem settings mutaveis (ao contrario do Restaurante, que tem
// horario de funcionamento) mas o helper fica pronto caso um dia precise.
export function coreClientRef() {
  return coreClient;
}
