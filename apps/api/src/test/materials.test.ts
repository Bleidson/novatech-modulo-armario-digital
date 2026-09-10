import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDb, createAdminSessionFixture, createMaterialFixture, createUserFixture, createReservationFixture } from "./dbHelpers.js";
import { HOST_A, HOST_B, TENANT_B } from "./tenants.js";
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from "../modules/auth/session.service.js";
import { runWithTenantContext } from "../shared/tenantContext.js";

const app = createApp();

// Sessao de PROFESSOR criada direto no banco (sem passar pelo fluxo HTTP de
// signup/aprovacao) - inclui um par CSRF valido (cookie + header) porque
// requireCsrfToken exige os dois em toda mutacao que carrega SESSION_COOKIE_NAME
// (shared/middlewares/csrf.ts); sem isto uma tentativa de mutacao do professor
// falharia com 403 de CSRF, mascarando o que o teste de RBAC realmente quer provar.
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

describe("modulo materials", () => {
  beforeEach(resetDb);

  it("ADMIN cria, le, atualiza e ativa/desativa um material", async () => {
    const { token: adminToken } = await createAdminSessionFixture();
    const adminCookie = `pdp_admin_session=${adminToken}`;

    const createRes = await request(app)
      .post("/api/v1/materials")
      .set("Host", HOST_A)
      .set("Cookie", adminCookie)
      .send({ name: "Projetor Epson", category: "Audiovisual" });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.name).toBe("Projetor Epson");
    expect(createRes.body.data.active).toBe(true);
    const id = createRes.body.data.id as string;

    const getRes = await request(app).get(`/api/v1/materials/${id}`).set("Host", HOST_A).set("Cookie", adminCookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.category).toBe("Audiovisual");

    const updateRes = await request(app)
      .put(`/api/v1/materials/${id}`)
      .set("Host", HOST_A)
      .set("Cookie", adminCookie)
      .send({ description: "Projetor da sala de video" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.description).toBe("Projetor da sala de video");

    const deactivateRes = await request(app)
      .post(`/api/v1/materials/${id}/deactivate`)
      .set("Host", HOST_A)
      .set("Cookie", adminCookie);
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.data.active).toBe(false);

    const activateRes = await request(app)
      .post(`/api/v1/materials/${id}/activate`)
      .set("Host", HOST_A)
      .set("Cookie", adminCookie);
    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.active).toBe(true);

    const listRes = await request(app)
      .get("/api/v1/materials")
      .query({ active: "true" })
      .set("Host", HOST_A)
      .set("Cookie", adminCookie);
    expect(listRes.status).toBe(200);
    expect((listRes.body.data as Array<{ id: string }>).some((m) => m.id === id)).toBe(true);
  });

  it("PROFESSOR pode ler o catalogo mas nao pode mutar (RBAC)", async () => {
    await createMaterialFixture({ name: "Carrinho de notebooks" });
    const { cookie: professorCookie, csrfHeader } = await createProfessorSessionCookie();

    const listRes = await request(app).get("/api/v1/materials").set("Host", HOST_A).set("Cookie", professorCookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    const createRes = await request(app)
      .post("/api/v1/materials")
      .set("Host", HOST_A)
      .set("Cookie", professorCookie)
      .set("X-CSRF-Token", csrfHeader)
      .send({ name: "Notebook extra" });
    expect(createRes.status).toBe(403);
  });

  it("requisicao sem sessao e recusada (401)", async () => {
    const res = await request(app).get("/api/v1/materials").set("Host", HOST_A);
    expect(res.status).toBe(401);
  });

  it("isolamento por tenant: material criado no tenant A nao aparece no tenant B", async () => {
    await createMaterialFixture({ name: "So do tenant A" });
    // NOTA: createAdminSessionFixture(tenantId) recebe o parametro mas nao o usa (nao
    // envolve a criacao em runWithTenantContext) - sem este wrap explicito, o admin
    // nasceria no tenant padrao do processo (TENANT_A), nao em TENANT_B. Flagged ao
    // lead junto do relatorio final.
    const { token: adminTokenB } = await runWithTenantContext(TENANT_B, async () => createAdminSessionFixture(TENANT_B));

    const listResB = await request(app)
      .get("/api/v1/materials")
      .set("Host", HOST_B)
      .set("Cookie", `pdp_admin_session=${adminTokenB}`);
    expect(listResB.status).toBe(200);
    expect(listResB.body.data).toHaveLength(0);
  });

  it("exclui um material sem reservas; recusa (409) excluir um material com reserva vinculada", async () => {
    const { token: adminToken } = await createAdminSessionFixture();
    const adminCookie = `pdp_admin_session=${adminToken}`;

    const free = await createMaterialFixture({ name: "Sem reservas" });
    const deleteRes = await request(app)
      .delete(`/api/v1/materials/${free.id}`)
      .set("Host", HOST_A)
      .set("Cookie", adminCookie);
    expect(deleteRes.status).toBe(204);

    const reserved = await createMaterialFixture({ name: "Com reserva" });
    await createReservationFixture({ materialId: reserved.id });

    const blockedRes = await request(app)
      .delete(`/api/v1/materials/${reserved.id}`)
      .set("Host", HOST_A)
      .set("Cookie", adminCookie);
    expect(blockedRes.status).toBe(409);

    const stillThereRes = await request(app)
      .get(`/api/v1/materials/${reserved.id}`)
      .set("Host", HOST_A)
      .set("Cookie", adminCookie);
    expect(stillThereRes.status).toBe(200);
  });
});
