import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDb, createAdminSessionFixture } from "./dbHelpers.js";
import { HOST_A } from "./tenants.js";
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from "../modules/auth/session.service.js";

const app = createApp();

function extractCookie(setCookieHeader: string[] | undefined, name: string): string | undefined {
  const raw = setCookieHeader?.find((c) => c.startsWith(`${name}=`));
  return raw?.split(";")[0]?.split("=")[1];
}

describe("auth - cadastro de professor (pending -> approve/reject)", () => {
  beforeEach(resetDb);

  it("professor recem-cadastrado nao consegue logar antes da aprovacao", async () => {
    const signupRes = await request(app)
      .post("/api/v1/auth/signup")
      .set("Host", HOST_A)
      .send({ name: "Professor Teste", email: "prof1@escola.example", phone: "11999990001", password: "SenhaForte123" });

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.data.status).toBe("PENDING");

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .set("Host", HOST_A)
      .send({ email: "prof1@escola.example", password: "SenhaForte123" });

    expect(loginRes.status).toBe(403);
  });

  it("ADMIN aprova o professor, que so entao consegue logar", async () => {
    await request(app)
      .post("/api/v1/auth/signup")
      .set("Host", HOST_A)
      .send({ name: "Professor Teste", email: "prof2@escola.example", phone: "11999990002", password: "SenhaForte123" });

    const { token: adminToken } = await createAdminSessionFixture();

    const pendingRes = await request(app)
      .get("/api/v1/auth/professors/pending")
      .set("Host", HOST_A)
      .set("Cookie", `pdp_admin_session=${adminToken}`);
    // ADMIN aqui e via cookie local (fixture cria User role ADMIN com sessao na
    // tabela sessions local) - mas requireAuth so aceita pdp_admin_session via
    // coreClient.verifySession. Em teste sem CORE_API_URL o MockCoreClient.verifySession
    // busca na mesma tabela sessions, entao o cookie pdp_admin_session funciona aqui.
    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body.data).toHaveLength(1);

    const professorId = pendingRes.body.data[0].id;

    const approveRes = await request(app)
      .post(`/api/v1/auth/professors/${professorId}/approve`)
      .set("Host", HOST_A)
      .set("Cookie", `pdp_admin_session=${adminToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe("ACTIVE");

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .set("Host", HOST_A)
      .send({ email: "prof2@escola.example", password: "SenhaForte123" });

    expect(loginRes.status).toBe(200);
    const sessionCookie = extractCookie(loginRes.headers["set-cookie"] as unknown as string[], SESSION_COOKIE_NAME);
    const csrfCookie = extractCookie(loginRes.headers["set-cookie"] as unknown as string[], CSRF_COOKIE_NAME);
    expect(sessionCookie).toBeTruthy();
    expect(csrfCookie).toBeTruthy();
  });

  it("ADMIN rejeita o professor, que continua sem conseguir logar", async () => {
    await request(app)
      .post("/api/v1/auth/signup")
      .set("Host", HOST_A)
      .send({ name: "Professor Teste", email: "prof3@escola.example", phone: "11999990003", password: "SenhaForte123" });

    const { token: adminToken } = await createAdminSessionFixture();
    const pendingRes = await request(app)
      .get("/api/v1/auth/professors/pending")
      .set("Host", HOST_A)
      .set("Cookie", `pdp_admin_session=${adminToken}`);
    const professorId = pendingRes.body.data[0].id;

    const rejectRes = await request(app)
      .post(`/api/v1/auth/professors/${professorId}/reject`)
      .set("Host", HOST_A)
      .set("Cookie", `pdp_admin_session=${adminToken}`)
      .send({ motivo: "Nao pertence mais ao corpo docente" });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe("REJECTED");

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .set("Host", HOST_A)
      .send({ email: "prof3@escola.example", password: "SenhaForte123" });
    expect(loginRes.status).toBe(403);
  });

  it("PROFESSOR autenticado nao pode acessar a fila de aprovacao (RBAC)", async () => {
    await request(app)
      .post("/api/v1/auth/signup")
      .set("Host", HOST_A)
      .send({ name: "Professor Teste", email: "prof4@escola.example", phone: "11999990004", password: "SenhaForte123" });

    const { token: adminToken } = await createAdminSessionFixture();
    const pendingRes = await request(app)
      .get("/api/v1/auth/professors/pending")
      .set("Host", HOST_A)
      .set("Cookie", `pdp_admin_session=${adminToken}`);
    const professorId = pendingRes.body.data[0].id;
    await request(app)
      .post(`/api/v1/auth/professors/${professorId}/approve`)
      .set("Host", HOST_A)
      .set("Cookie", `pdp_admin_session=${adminToken}`);

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .set("Host", HOST_A)
      .send({ email: "prof4@escola.example", password: "SenhaForte123" });
    const professorSessionCookie = extractCookie(
      loginRes.headers["set-cookie"] as unknown as string[],
      SESSION_COOKIE_NAME,
    );

    const forbiddenRes = await request(app)
      .get("/api/v1/auth/professors/pending")
      .set("Host", HOST_A)
      .set("Cookie", `${SESSION_COOKIE_NAME}=${professorSessionCookie}`);
    expect(forbiddenRes.status).toBe(403);
  });

  // Ajuste de produto (Tarefa "Ajustes Visuais e Operacionais" secao 3): WhatsApp
  // deixou de ser opcional - e o dado usado para montar o link de negociacao de
  // horario entre professores.
  it("cadastro sem WhatsApp e recusado (campo agora obrigatorio)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .set("Host", HOST_A)
      .send({ name: "Professor Sem Whats", email: "prof5@escola.example", password: "SenhaForte123" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  // Pagina "Conta" do professor (Tarefa de ajuste): autoatendimento de nome/WhatsApp.
  it("PATCH /auth/me atualiza nome e WhatsApp do proprio professor; recusa (403) se for ADMIN", async () => {
    await request(app)
      .post("/api/v1/auth/signup")
      .set("Host", HOST_A)
      .send({ name: "Professor Conta", email: "prof-conta@escola.example", phone: "11999990006", password: "SenhaForte123" });

    const { token: adminToken } = await createAdminSessionFixture();
    const pendingRes = await request(app)
      .get("/api/v1/auth/professors/pending")
      .set("Host", HOST_A)
      .set("Cookie", `pdp_admin_session=${adminToken}`);
    const professorId = pendingRes.body.data.find((p: { email: string }) => p.email === "prof-conta@escola.example").id;
    await request(app)
      .post(`/api/v1/auth/professors/${professorId}/approve`)
      .set("Host", HOST_A)
      .set("Cookie", `pdp_admin_session=${adminToken}`);

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .set("Host", HOST_A)
      .send({ email: "prof-conta@escola.example", password: "SenhaForte123" });
    expect(loginRes.body.data.phone).toBe("11999990006");
    const sessionCookie = extractCookie(loginRes.headers["set-cookie"] as unknown as string[], SESSION_COOKIE_NAME);
    const csrfCookie = extractCookie(loginRes.headers["set-cookie"] as unknown as string[], CSRF_COOKIE_NAME);

    const patchRes = await request(app)
      .patch("/api/v1/auth/me")
      .set("Host", HOST_A)
      .set("Cookie", `${SESSION_COOKIE_NAME}=${sessionCookie}; ${CSRF_COOKIE_NAME}=${csrfCookie}`)
      .set("X-CSRF-Token", csrfCookie ?? "")
      .send({ name: "Professor Conta Editado", phone: "11999990099" });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.name).toBe("Professor Conta Editado");
    expect(patchRes.body.data.phone).toBe("11999990099");

    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Host", HOST_A)
      .set("Cookie", `${SESSION_COOKIE_NAME}=${sessionCookie}`);
    expect(meRes.body.data.name).toBe("Professor Conta Editado");
    expect(meRes.body.data.phone).toBe("11999990099");

    // ADMIN e projecao local da Core - editar aqui nunca deveria "colar" (o proximo
    // login sobrescreveria o nome de volta), entao o endpoint recusa de saida.
    const adminPatch = await request(app)
      .patch("/api/v1/auth/me")
      .set("Host", HOST_A)
      .set("Cookie", `pdp_admin_session=${adminToken}`)
      .send({ name: "Tentando Editar", phone: "11999990000" });
    expect(adminPatch.status).toBe(403);
  });
});
