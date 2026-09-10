import { randomBytes, createHash } from "node:crypto";
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDb, createUserFixture, createMaterialFixture, createClassPeriodFixture } from "./dbHelpers.js";
import { HOST_A, HOST_B, TENANT_A, TENANT_B } from "./tenants.js";
import { runWithTenantContext } from "../shared/tenantContext.js";
import { prisma } from "../shared/prisma.js";
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from "../modules/auth/session.service.js";

const app = createApp();

// Cria um professor ACTIVE e uma sessao local (tabela `sessions`, tokenHash sha256)
// SEM passar pelo endpoint POST /auth/login - mesmo padrao ja usado para ADMIN em
// dbHelpers.ts (createAdminSessionFixture). Motivo: /auth/login tem rate limit de
// 10 tentativas/15min (auth.routes.ts, loginRateLimiter) - este arquivo sozinho
// cria bem mais de 10 professores, e cair no 429 nao tem nada a ver com a regra que
// este teste verifica. A sessao criada aqui e validada pelo MESMO
// validateSessionToken que uma sessao "de verdade" usaria - nao e um atalho que
// pula a autenticacao, so pula o formulario de login.
async function createProfessorSession(tenantId: string, email: string, name?: string) {
  const { user } = await runWithTenantContext(tenantId, async () =>
    createUserFixture({ email, role: "PROFESSOR", status: "ACTIVE", ...(name ? { name } : {}) }),
  );
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  await runWithTenantContext(tenantId, async () =>
    prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt,
        userAgent: null,
        ipAddress: null,
      },
    }),
  );
  const csrf = randomBytes(32).toString("hex");
  return {
    userId: user.id,
    cookie: `${SESSION_COOKIE_NAME}=${token}; ${CSRF_COOKIE_NAME}=${csrf}`,
    csrfHeader: csrf,
  };
}

function mutate(method: "post" | "delete", path: string, auth: { cookie: string; csrfHeader: string }, host = HOST_A) {
  return request(app)[method](path).set("Host", host).set("Cookie", auth.cookie).set("X-CSRF-Token", auth.csrfHeader);
}

// "Hoje"/"amanha"/"ontem" em data civil LOCAL (nunca via toISOString, que e UTC) -
// tem que bater com a mesma comparacao que reservations.service.ts usa
// (todayDateOnlyString) para o teste de data passada fazer sentido em qualquer
// timezone de servidor. Servidor deste projeto roda em America/Sao_Paulo
// (UTC-3): perto da meia-noite, "ontem em UTC" pode ser literalmente igual a
// "hoje local" - foi exatamente esse o bug que este comentario documenta.
function dateOnlyString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function tomorrowISODate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return dateOnlyString(d);
}

function yesterdayISODate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateOnlyString(d);
}

describe("reservations - CRUD + regra de nao-duplicidade", () => {
  beforeEach(resetDb);

  it("fluxo feliz: cria, lista e cancela", async () => {
    const material = await runWithTenantContext(TENANT_A, async () => createMaterialFixture({ name: "Projetor" }));
    const classPeriod = await runWithTenantContext(TENANT_A, async () =>
      createClassPeriodFixture({ name: "1o horario" }),
    );
    const prof = await createProfessorSession(TENANT_A, "prof-feliz@escola.example");
    const date = tomorrowISODate();

    const createRes = await mutate("post", "/api/v1/reservations", prof).send({
      materialId: material.id,
      classPeriodId: classPeriod.id,
      date,
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.materialId).toBe(material.id);
    expect(createRes.body.data.material.name).toBe("Projetor");
    expect(createRes.body.data.classPeriod.name).toBe("1o horario");

    const listRes = await request(app).get("/api/v1/reservations").set("Host", HOST_A).set("Cookie", prof.cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    const reservationId = createRes.body.data.id as string;
    const cancelRes = await mutate("delete", `/api/v1/reservations/${reservationId}`, prof);
    expect(cancelRes.status).toBe(204);

    const listAfter = await request(app).get("/api/v1/reservations").set("Host", HOST_A).set("Cookie", prof.cookie);
    expect(listAfter.body.data).toHaveLength(0);
  });

  it("CONCORRENCIA: duas requisicoes simultaneas para o mesmo slot - exatamente uma 201, a outra 409", async () => {
    const material = await runWithTenantContext(TENANT_A, async () => createMaterialFixture({ name: "Lab de informatica" }));
    const classPeriod = await runWithTenantContext(TENANT_A, async () => createClassPeriodFixture({ name: "2o horario" }));
    const profA = await createProfessorSession(TENANT_A, "concorrencia-a@escola.example");
    const profB = await createProfessorSession(TENANT_A, "concorrencia-b@escola.example");
    const date = tomorrowISODate();

    const body = { materialId: material.id, classPeriodId: classPeriod.id, date };

    // Promise.all dispara as duas chamadas HTTP ANTES de qualquer uma delas ser
    // aguardada - as duas promises de request ja estao "em voo" no momento em que
    // o Promise.all comeca a esperar. Um await sequencial aqui (const r1 = await...;
    // const r2 = await...) nunca provaria a race - a segunda so comecaria depois da
    // primeira terminar, e o teste passaria mesmo se a aplicacao dependesse de um
    // "check then create" com janela de corrida.
    const [res1, res2] = await Promise.all([
      mutate("post", "/api/v1/reservations", profA).send(body),
      mutate("post", "/api/v1/reservations", profB).send(body),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const winner = res1.status === 201 ? res1 : res2;
    const loser = res1.status === 201 ? res2 : res1;
    expect(winner.body.data.materialId).toBe(material.id);
    expect(loser.body.error.code).toBe("CONFLICT");

    // So sobrou UMA linha no banco para este slot - a constraint, nao a aplicacao,
    // decidiu quem ganhou.
    const count = await runWithTenantContext(TENANT_A, async () =>
      prisma.reservation.count({ where: { materialId: material.id, classPeriodId: classPeriod.id, date: new Date(`${date}T00:00:00.000Z`) } }),
    );
    expect(count).toBe(1);
  });

  it("rejeita reserva em data passada", async () => {
    const material = await runWithTenantContext(TENANT_A, async () => createMaterialFixture());
    const classPeriod = await runWithTenantContext(TENANT_A, async () => createClassPeriodFixture());
    const prof = await createProfessorSession(TENANT_A, "passado@escola.example");

    const res = await mutate("post", "/api/v1/reservations", prof).send({
      materialId: material.id,
      classPeriodId: classPeriod.id,
      date: yesterdayISODate(),
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejeita material inativo e horario inativo", async () => {
    const inactiveMaterial = await runWithTenantContext(TENANT_A, async () => createMaterialFixture({ active: false }));
    const activeClassPeriod = await runWithTenantContext(TENANT_A, async () => createClassPeriodFixture());
    const activeMaterial = await runWithTenantContext(TENANT_A, async () => createMaterialFixture());
    const inactiveClassPeriod = await runWithTenantContext(TENANT_A, async () =>
      prisma.classPeriod.create({ data: { name: "Horario inativo", active: false } }),
    );
    const prof = await createProfessorSession(TENANT_A, "inativo@escola.example");
    const date = tomorrowISODate();

    const resMaterial = await mutate("post", "/api/v1/reservations", prof).send({
      materialId: inactiveMaterial.id,
      classPeriodId: activeClassPeriod.id,
      date,
    });
    expect(resMaterial.status).toBe(422);

    const resClassPeriod = await mutate("post", "/api/v1/reservations", prof).send({
      materialId: activeMaterial.id,
      classPeriodId: inactiveClassPeriod.id,
      date,
    });
    expect(resClassPeriod.status).toBe(422);
  });

  it("isolamento por tenant: reserva do tenant A nao aparece pro tenant B, e o mesmo material 'de nome' esta livre em B", async () => {
    const materialA = await runWithTenantContext(TENANT_A, async () => createMaterialFixture({ name: "Carrinho de notebooks" }));
    const classPeriodA = await runWithTenantContext(TENANT_A, async () => createClassPeriodFixture({ name: "3o horario" }));
    const materialB = await runWithTenantContext(TENANT_B, async () => createMaterialFixture({ name: "Carrinho de notebooks" }));
    const classPeriodB = await runWithTenantContext(TENANT_B, async () => createClassPeriodFixture({ name: "3o horario" }));

    const profA = await createProfessorSession(TENANT_A, "isolamento-a@escola.example");
    const profB = await createProfessorSession(TENANT_B, "isolamento-b@escola.example");
    const date = tomorrowISODate();

    const createA = await mutate("post", "/api/v1/reservations", profA).send({
      materialId: materialA.id,
      classPeriodId: classPeriodA.id,
      date,
    });
    expect(createA.status).toBe(201);

    // Mesmo nome, mesma data, mesmo horario "de nome" - mas linha diferente
    // (tenant diferente), entao precisa funcionar sem 409.
    const createB = await mutate("post", "/api/v1/reservations", profB, HOST_B).send({
      materialId: materialB.id,
      classPeriodId: classPeriodB.id,
      date,
    });
    expect(createB.status).toBe(201);

    const listA = await request(app).get("/api/v1/reservations").set("Host", HOST_A).set("Cookie", profA.cookie);
    const listB = await request(app).get("/api/v1/reservations").set("Host", HOST_B).set("Cookie", profB.cookie);
    expect(listA.body.data).toHaveLength(1);
    expect(listB.body.data).toHaveLength(1);
    expect(listA.body.data[0].id).not.toBe(listB.body.data[0].id);
  });

  it("RBAC: professor nao cancela reserva de outro professor (404); cancela a propria; ADMIN cancela qualquer uma", async () => {
    const material = await runWithTenantContext(TENANT_A, async () => createMaterialFixture());
    const classPeriod = await runWithTenantContext(TENANT_A, async () => createClassPeriodFixture());
    const owner = await createProfessorSession(TENANT_A, "dono@escola.example");
    const other = await createProfessorSession(TENANT_A, "outro@escola.example");
    const date = tomorrowISODate();

    const created = await mutate("post", "/api/v1/reservations", owner).send({
      materialId: material.id,
      classPeriodId: classPeriod.id,
      date,
    });
    expect(created.status).toBe(201);
    const reservationId = created.body.data.id as string;

    const forbidden = await mutate("delete", `/api/v1/reservations/${reservationId}`, other);
    expect(forbidden.status).toBe(404);

    const ownerCancel = await mutate("delete", `/api/v1/reservations/${reservationId}`, owner);
    expect(ownerCancel.status).toBe(204);

    // ADMIN cancela reserva de um professor.
    const created2 = await mutate("post", "/api/v1/reservations", owner).send({
      materialId: material.id,
      classPeriodId: classPeriod.id,
      date,
    });
    const reservationId2 = created2.body.data.id as string;

    const { createAdminSessionFixture } = await import("./dbHelpers.js");
    const { token: adminToken } = await runWithTenantContext(TENANT_A, async () => createAdminSessionFixture(TENANT_A));
    const adminCancel = await request(app)
      .delete(`/api/v1/reservations/${reservationId2}`)
      .set("Host", HOST_A)
      .set("Cookie", `pdp_admin_session=${adminToken}`);
    expect(adminCancel.status).toBe(204);
  });

  it("GET /availability: mostra reserved:true/false por slot, sem vazar nome de outro professor para PROFESSOR", async () => {
    const material = await runWithTenantContext(TENANT_A, async () => createMaterialFixture({ name: "Projetor" }));
    const classPeriod = await runWithTenantContext(TENANT_A, async () => createClassPeriodFixture({ name: "4o horario" }));
    const bookerName = "Professor Reservante";
    const booker = await createProfessorSession(TENANT_A, "reservante@escola.example", bookerName);
    const date = tomorrowISODate();

    const created = await mutate("post", "/api/v1/reservations", booker).send({
      materialId: material.id,
      classPeriodId: classPeriod.id,
      date,
    });
    expect(created.status).toBe(201);

    const viewer = await createProfessorSession(TENANT_A, "consulta@escola.example");
    const availRes = await request(app)
      .get("/api/v1/reservations/availability")
      .query({ date })
      .set("Host", HOST_A)
      .set("Cookie", viewer.cookie);
    expect(availRes.status).toBe(200);
    const slot = availRes.body.data.find((s: { materialId: string; classPeriodId: string }) => s.materialId === material.id && s.classPeriodId === classPeriod.id);
    expect(slot.reserved).toBe(true);
    expect(slot.reservedBy).toBeUndefined();

    const { createAdminSessionFixture } = await import("./dbHelpers.js");
    const { token: adminToken } = await runWithTenantContext(TENANT_A, async () => createAdminSessionFixture(TENANT_A));
    const availAdmin = await request(app)
      .get("/api/v1/reservations/availability")
      .query({ date })
      .set("Host", HOST_A)
      .set("Cookie", `pdp_admin_session=${adminToken}`);
    const slotAdmin = availAdmin.body.data.find((s: { materialId: string; classPeriodId: string }) => s.materialId === material.id && s.classPeriodId === classPeriod.id);
    expect(slotAdmin.reserved).toBe(true);
    expect(slotAdmin.reservedBy.name).toBe(bookerName);
  });
});
