import { describe, it, expect, beforeEach } from "vitest";
import { runWithTenantContext } from "../shared/tenantContext.js";
import { prisma } from "../shared/prisma.js";
import { resetDb, createMaterialFixture, createClassPeriodFixture, createUserFixture } from "./dbHelpers.js";
import { TENANT_A, TENANT_B } from "./tenants.js";

// A propria fundacao do modulo: prova que a Row Level Security do Postgres, nao a
// aplicacao, e quem impede uma escola de ver dado de outra. Dois tenants de
// proposito - com um so, um vazamento seria indetectavel (toda consulta "certa"
// tambem seria a unica resposta possivel).
describe("isolamento por tenant (RLS)", () => {
  beforeEach(resetDb);

  it("Material criado no tenant A nao aparece para o tenant B", async () => {
    await runWithTenantContext(TENANT_A, async () => {
      await createMaterialFixture({ name: "Projetor" });
    });

    const materiaisA = await runWithTenantContext(TENANT_A, async () => prisma.material.findMany());
    const materiaisB = await runWithTenantContext(TENANT_B, async () => prisma.material.findMany());

    expect(materiaisA).toHaveLength(1);
    expect(materiaisB).toHaveLength(0);
  });

  it("ClassPeriod criado no tenant A nao aparece para o tenant B", async () => {
    await runWithTenantContext(TENANT_A, async () => {
      await createClassPeriodFixture({ name: "1o horario" });
    });

    const periodosB = await runWithTenantContext(TENANT_B, async () => prisma.classPeriod.findMany());
    expect(periodosB).toHaveLength(0);
  });

  it("User (professor) criado no tenant A nao aparece para o tenant B, mesmo com o mesmo e-mail", async () => {
    await runWithTenantContext(TENANT_A, async () => {
      await createUserFixture({ email: "professor@escola.example", role: "PROFESSOR" });
    });

    // Mesmo e-mail, tenant diferente - a constraint @@unique([tenantId, email]) so
    // vale DENTRO do tenant, entao isto precisa funcionar sem conflito.
    await runWithTenantContext(TENANT_B, async () => {
      await createUserFixture({ email: "professor@escola.example", role: "PROFESSOR" });
    });

    const usersA = await runWithTenantContext(TENANT_A, async () => prisma.user.findMany());
    const usersB = await runWithTenantContext(TENANT_B, async () => prisma.user.findMany());
    expect(usersA).toHaveLength(1);
    expect(usersB).toHaveLength(1);
  });

  it("consulta sem tenant no contexto falha alto, nunca devolve tudo nem nada silenciosamente", async () => {
    // basePrisma cru, fora de qualquer contexto - simula um bug de codigo que
    // esqueceu de abrir o contexto de tenant.
    const { basePrisma } = await import("../shared/prisma.js");
    await expect(basePrisma.material.findMany()).rejects.toBeDefined();
  });
});
