import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";

const app = createApp();
const CORE_TOKEN = "core-test-token-000000000000000001";
const SITE_TOKEN = "site-test-token-000000000000000001";

describe("identidades e scopes das rotas internas", () => {
  it("nega credencial ausente ou invalida", async () => {
    const absent = await request(app).get("/internal/setup-schema");
    const invalid = await request(app).get("/internal/setup-schema").set("x-internal-token", "invalido-000000000000000000000000");
    expect(absent.status).toBe(401);
    expect(invalid.status).toBe(401);
  });

  it("permite ao Site ler o schema, mas nega offboarding", async () => {
    const allowed = await request(app).get("/internal/setup-schema").set("x-internal-token", SITE_TOKEN);
    const denied = await request(app).post("/internal/offboard").set("x-internal-token", SITE_TOKEN).send({ tenantId: crypto.randomUUID() });
    expect(allowed.status).toBe(200);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("SERVICE_SCOPE_FORBIDDEN");
  });

  it("nega ao Core scope de setup do Site", async () => {
    const response = await request(app).get("/internal/setup-schema").set("x-internal-token", CORE_TOKEN);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("SERVICE_SCOPE_FORBIDDEN");
  });
});
