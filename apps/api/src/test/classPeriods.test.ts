import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import {
  resetDb,
  createAdminSessionFixture,
  createClassPeriodFixture,
  createUserFixture,
  createReservationFixture,
} from "./dbHelpers.js";
import { HOST_A, HOST_B, TENANT_B } from "./tenants.js";
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from "../modules/auth/session.service.js";
import { runWithTenantContext } from "../shared/tenantContext.js";

const app = createApp();

// Sessao de PROFESSOR criada direto no banco - inclui um par CSRF valido (cookie +
// header) porque requireCsrfToken exige os dois em toda mutacao que carrega
// SESSION_COOKIE_NAME (shared/middlewares/csrf.ts); sem isto uma tentativa de mutacao
// do professor falharia com 403 de CSRF, mascarando o que o teste de RBAC quer provar.
async function createProfessorSessionCookie() {
  const { randomBytes, createHash } = await import("node:crypto");
  const { user } = await createUserFixture({ role: "PROFESSOR", status: "ACTIVE" });
  const { prisma } = await import("../shared/prisma.js");
  const token = randomBytes(32).toString("hex");
  const csrfToken = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      userAgent: null,
      ipAddress: null,
    },
  });
  return {
    user,
    cookie: `${SESSION_COOKIE_NAME}=${token}; ${CSRF_COOKIE_NAME}=${csrfToken}`,
    csrfHeader: csrfToken,
  };
}

describe("modulo class-periods", () => {
  beforeEach(resetDb);

  it("ADMIN cria, le, atualiza e ativa/desativa um horario", async () => {
    const { token: adminToken } = await createAdminSessionFixture();
    const adminCookie = `pdp_admin_session=${adminToken}`;

    const createRes = await request(app)
      .post("/api/v1/class-periods")
      .set("Host", HOST_A)
      .set("Cookie", adminCookie)
      .send({ name: "1o horario", startTime: "07:00", endTime: "07:50" });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.name).toBe("1o horario");
    expect(createRes.body.data.active).toBe(true);
    const id = createRes.body.data.id as string;

    const getRes = await request(app)
      .get(`/api/v1/class-periods/${id}`)
      .set("Host", HOST_A)
      .set("Cookie", adminCookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.startTime).toBe("07:00");

    const updateRes = await request(app)
      .put(`/api/v1/class-periods/${id}`)
      .set("Host", HOST_A)
      .set("Cookie", adminCookie)
      .send({ endTime: "07:55" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.endTime).toBe("07:55");

    const deactivateRes = await request(app)
      .post(`/api/v1/class-periods/${id}/deactivate`)
      .set("Host", HOST_A)
      .set("Cookie", adminCookie);
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.data.active).toBe(false);

    const activateRes = await request(app)
      .post(`/api/v1/class-periods/${id}/activate`)
      .set("Host", HOST_A)
      .set("Cookie", adminCookie);
    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.active).toBe(true);
  });

  it("PROFESSOR pode ler a grade mas nao pode mutar (RBAC)", async () => {
    await createClassPeriodFixture({ name: "2o horario" });
    const { cookie: professorCookie, csrfHeader } = await createProfessorSessionCookie();

    const listRes = await request(app)
      .get("/api/v1/class-periods")
      .set("Host", HOST_A)
      .set("Cookie", professorCookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    const createRes = await request(app)
      .post("/api/v1/class-periods")
      .set("Host", HOST_A)
      .set("Cookie", professorCookie)
      .set("X-CSRF-Token", csrfHeader)
      .send({ name: "3o horario" });
    expect(createRes.status).toBe(403);

    const reorderRes = await request(app)
      .put("/api/v1/class-periods/reorder")
      .set("Host", HOST_A)
      .set("Cookie", professorCookie)
      .set("X-CSRF-Token", csrfHeader)
      .send({ items: [] });
    expect(reorderRes.status).toBe(403);
  });

  it("requisicao sem sessao e recusada (401)", async () => {
    const res = await request(app).get("/api/v1/class-periods").set("Host", HOST_A);
    expect(res.status).toBe(401);
  });

  it("isolamento por tenant: horario criado no tenant A nao aparece no tenant B", async () => {
    await createClassPeriodFixture({ name: "So do tenant A" });
    // NOTA: createAdminSessionFixture(tenantId) recebe o parametro mas nao o usa (nao
    // envolve a criacao em runWithTenantContext) - sem este wrap explicito, o admin
    // nasceria no tenant padrao do processo (TENANT_A), nao em TENANT_B. Flagged ao
    // lead junto do relatorio final.
    const { token: adminTokenB } = await runWithTenantContext(TENANT_B, async () => createAdminSessionFixture(TENANT_B));

    const listResB = await request(app)
      .get("/api/v1/class-periods")
      .set("Host", HOST_B)
      .set("Cookie", `pdp_admin_session=${adminTokenB}`);
    expect(listResB.status).toBe(200);
    expect(listResB.body.data).toHaveLength(0);
  });

  it("reordena horarios de forma transacional", async () => {
    const { token: adminToken } = await createAdminSessionFixture();
    const adminCookie = `pdp_admin_session=${adminToken}`;
    const first = await createClassPeriodFixture({ name: "A", displayOrder: 1 });
    const second = await createClassPeriodFixture({ name: "B", displayOrder: 2 });

    const res = await request(app)
      .put("/api/v1/class-periods/reorder")
      .set("Host", HOST_A)
      .set("Cookie", adminCookie)
      .send({ items: [{ id: first.id, displayOrder: 2 }, { id: second.id, displayOrder: 1 }] });

    expect(res.status).toBe(200);
    const ordered = res.body.data as Array<{ id: string; displayOrder: number }>;
    expect(ordered.find((c) => c.id === second.id)?.displayOrder).toBe(1);
    expect(ordered.find((c) => c.id === first.id)?.displayOrder).toBe(2);
  });

  it("rejeita reorder com id inexistente sem aplicar nenhuma mudanca (422)", async () => {
    const { token: adminToken } = await createAdminSessionFixture();
    const adminCookie = `pdp_admin_session=${adminToken}`;
    const period = await createClassPeriodFixture({ name: "Unico", displayOrder: 0 });

    const res = await request(app)
      .put("/api/v1/class-periods/reorder")
      .set("Host", HOST_A)
      .set("Cookie", adminCookie)
      .send({ items: [{ id: period.id, displayOrder: 9 }, { id: "00000000-0000-0000-0000-000000000000", displayOrder: 1 }] });
    expect(res.status).toBe(422);

    const getRes = await request(app)
      .get(`/api/v1/class-periods/${period.id}`)
      .set("Host", HOST_A)
      .set("Cookie", adminCookie);
    expect(getRes.body.data.displayOrder).toBe(0);
  });

  it("exclui um horario sem reservas; recusa (409) excluir um horario com reserva vinculada", async () => {
    const { token: adminToken } = await createAdminSessionFixture();
    const adminCookie = `pdp_admin_session=${adminToken}`;

    const free = await createClassPeriodFixture({ name: "Sem reservas" });
    const deleteRes = await request(app)
      .delete(`/api/v1/class-periods/${free.id}`)
      .set("Host", HOST_A)
      .set("Cookie", adminCookie);
    expect(deleteRes.status).toBe(204);

    const reserved = await createClassPeriodFixture({ name: "Com reserva" });
    await createReservationFixture({ classPeriodId: reserved.id });

    const blockedRes = await request(app)
      .delete(`/api/v1/class-periods/${reserved.id}`)
      .set("Host", HOST_A)
      .set("Cookie", adminCookie);
    expect(blockedRes.status).toBe(409);

    const stillThereRes = await request(app)
      .get(`/api/v1/class-periods/${reserved.id}`)
      .set("Host", HOST_A)
      .set("Cookie", adminCookie);
    expect(stillThereRes.status).toBe(200);
  });
});
