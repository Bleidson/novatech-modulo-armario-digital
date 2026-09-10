import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../shared/prisma.js";
import { logger } from "../shared/logger.js";
import { normalizeHost } from "../shared/normalizeHost.js";
import { env } from "../shared/env.js";
import { getRedisClient } from "../shared/redisClient.js";
import { CachedCoreClient } from "./cachedCoreClient.js";

// ============================================================================
// Unica porta de entrada/saida para a Core (novatech-core). Mesmo padrao dos demais
// modulos da plataforma (ver novatech-modulo-restaurante/apps/api/src/lib/core-client.ts):
// este modulo CONSOME identidade/tenant/cobranca da Core, nunca acessa o banco dela
// direto. Quando CORE_API_URL nao esta definido (dev/teste), tudo e atendido por
// MockCoreClient, lendo de um fixture local e do proprio banco do modulo.
// ============================================================================

export interface TenantInfo {
  id: string;
  slug: string;
  status: "active" | "suspended" | "setup_pending";
  settings: {
    logoUrl: string | null;
    primaryColor: string;
    businessName: string;
    phone: string | null;
    address: string | null;
  };
}

// name/email: a Core mantem a conta do Administrador (a mesma criada no site da
// Novatech antes de pagar) - o modulo guarda so uma PROJECAO local minima,
// atualizada a cada verificacao (ver upsertAdminProjection).
export interface AuthResult {
  tenantId: string;
  userId: string;
  role: "ADMIN" | "PROFESSOR";
  name: string;
  email: string;
}

export interface LoginResult {
  token: string;
  expiresAt: string;
  auth: AuthResult;
}

export interface CoreClient {
  // host SEMPRE ja normalizado (minusculas, sem porta) por quem chama
  // (shared/middlewares/tenant.ts) - a Core nao normaliza.
  resolveTenantByDomain(host: string): Promise<TenantInfo | null>;
  // SO a sessao do Administrador (a Account da Core) passa por aqui. Professor e
  // sessao 100% local do modulo (modules/auth/session.service.ts) - NUNCA chama
  // verifySession/login.
  verifySession(token: string): Promise<AuthResult | null>;
  login(tenantId: string, email: string, password: string): Promise<LoginResult | null>;
  redeemSupportGrant(grantToken: string): Promise<LoginResult | null>;
  logout(token: string): Promise<void>;
  updateTenantSettings(tenantId: string, settings: Partial<TenantInfo["settings"]>): Promise<void>;
}

// ---------------------------------------------------------------------------

interface DevTenantRecord extends TenantInfo {
  hosts: string[];
}

function toTenantInfo(record: DevTenantRecord): TenantInfo {
  return { id: record.id, slug: record.slug, status: record.status, settings: record.settings };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE_PATH = join(HERE, "tenants.dev.json");

function overridesPathFor(fixturePath: string): string {
  return join(dirname(fixturePath), `${basename(fixturePath, ".json")}.local.json`);
}

export class MockCoreClient implements CoreClient {
  private tenants: DevTenantRecord[];
  private readonly overridesPath: string;

  constructor(fixturePath: string = DEFAULT_FIXTURE_PATH) {
    const raw = JSON.parse(readFileSync(fixturePath, "utf8")) as { tenants: DevTenantRecord[] };
    this.tenants = raw.tenants;
    this.overridesPath = overridesPathFor(fixturePath);

    if (existsSync(this.overridesPath)) {
      const overrides = JSON.parse(readFileSync(this.overridesPath, "utf8")) as Record<
        string,
        Partial<TenantInfo["settings"]>
      >;
      for (const tenant of this.tenants) {
        const override = overrides[tenant.id];
        if (override) tenant.settings = { ...tenant.settings, ...override };
      }
    }
  }

  resolveTenantByDomain(host: string): Promise<TenantInfo | null> {
    const wanted = normalizeHost(host);
    const found = this.tenants.find((t) => t.hosts.some((h) => normalizeHost(h) === wanted));
    return Promise.resolve(found ? toTenantInfo(found) : null);
  }

  // So simula a sessao do ADMINISTRADOR - Professor nunca chega aqui, nem no mock nem
  // na Core real (ver requireAuth). Reaproveita a MESMA tabela `sessions` que o
  // mecanismo local usa - o que separa os dois e o cookie (pdp_admin_session vs
  // pdp_session), nunca a tabela.
  async verifySession(token: string): Promise<AuthResult | null> {
    const { createHash } = await import("node:crypto");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt !== null || session.expiresAt < new Date()) return null;
    if (session.user.status !== "ACTIVE") return null;
    // A Core so emite sessao pra ADMIN (unica Account que ela conhece) - falha
    // fechado se chegar outra coisa.
    if (session.user.role !== "ADMIN") return null;

    return {
      tenantId: session.tenantId,
      userId: session.userId,
      role: session.user.role,
      name: session.user.name,
      email: session.user.email,
    };
  }

  async login(tenantId: string, email: string, password: string): Promise<LoginResult | null> {
    const bcrypt = (await import("bcryptjs")).default;
    const { randomBytes, createHash } = await import("node:crypto");

    const user = await prisma.user.findFirst({ where: { tenantId, email, role: "ADMIN" } });
    const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
    const ok = await bcrypt.compare(password, hash);
    if (!user || !ok || user.status !== "ACTIVE") return null;

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

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      auth: { tenantId, userId: user.id, role: "ADMIN", name: user.name, email: user.email },
    };
  }

  // Nao ha Core real no mock - honesto sobre a limitacao (mesmo padrao do
  // Restaurante): "entrar como suporte" so funciona com CORE_API_URL configurado.
  redeemSupportGrant(_grantToken: string): Promise<LoginResult | null> {
    return Promise.resolve(null);
  }

  async logout(token: string): Promise<void> {
    const { createHash } = await import("node:crypto");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.session.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  updateTenantSettings(tenantId: string, settings: Partial<TenantInfo["settings"]>): Promise<void> {
    const tenant = this.tenants.find((t) => t.id === tenantId);
    if (!tenant) {
      return Promise.reject(new Error(`Tenant desconhecido no MockCoreClient: ${tenantId}`));
    }
    tenant.settings = { ...tenant.settings, ...settings };

    if (process.env["NODE_ENV"] === "test") return Promise.resolve();

    try {
      const current: Record<string, Partial<TenantInfo["settings"]>> = existsSync(this.overridesPath)
        ? (JSON.parse(readFileSync(this.overridesPath, "utf8")) as Record<string, Partial<TenantInfo["settings"]>>)
        : {};
      current[tenantId] = tenant.settings;
      writeFileSync(this.overridesPath, `${JSON.stringify(current, null, 2)}\n`);
    } catch (err) {
      logger.warn({ err }, "MOCK_CORE_SETTINGS_PERSIST_FAILED");
    }
    return Promise.resolve();
  }

  // Somente para desenvolvimento/teste - nao faz parte da interface CoreClient.
  listTenantsForDevelopment(): TenantInfo[] {
    return this.tenants.map(toTenantInfo);
  }
}

// ---------------------------------------------------------------------------
// HttpCoreClient - implementacao real, contra a Core de verdade. Formato de resposta
// segue o MESMO contrato ja confirmado pelo modulo Restaurante contra a Core real
// (novatech-core): resolveTenantByDomain, verifySession, login, logout, support-redeem.
// ---------------------------------------------------------------------------
export class CoreClientError extends Error {
  readonly status: number;

  constructor(status: number, body: string) {
    super(`Core respondeu ${status}: ${body.slice(0, 500)}`);
    this.name = "CoreClientError";
    this.status = status;
  }
}

export class CoreClientTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Core nao respondeu em ${timeoutMs}ms`);
    this.name = "CoreClientTimeoutError";
  }
}

export class HttpCoreClient implements CoreClient {
  constructor(
    private readonly baseUrl: string,
    private readonly internalToken: string,
    private readonly timeoutMs: number,
  ) {}

  private async request(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { ...init.headers, "x-internal-token": this.internalToken },
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new CoreClientTimeoutError(this.timeoutMs);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async resolveTenantByDomain(host: string): Promise<TenantInfo | null> {
    const res = await this.request(`/api/tenants/by-domain?host=${encodeURIComponent(host)}`, {
      method: "GET",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new CoreClientError(res.status, await res.text());
    return (await res.json()) as TenantInfo;
  }

  async verifySession(token: string): Promise<AuthResult | null> {
    const res = await this.request("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (res.status === 401) return null;
    if (!res.ok) throw new CoreClientError(res.status, await res.text());
    return (await res.json()) as AuthResult;
  }

  // POST /api/auth/login recebe {tenantId,email,password} e devolve
  // {token, expiresAt, user: AuthResult} - o campo chama "user", nao "auth" (formato
  // ja confirmado contra a Core real pelo modulo Restaurante).
  async login(tenantId: string, email: string, password: string): Promise<LoginResult | null> {
    const res = await this.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId, email, password }),
    });
    if (res.status === 401) return null;
    if (!res.ok) throw new CoreClientError(res.status, await res.text());
    const body = (await res.json()) as { token: string; expiresAt: string; user: AuthResult };
    return { token: body.token, expiresAt: body.expiresAt, auth: body.user };
  }

  // POST /api/auth/support-redeem devolve {token, expiresAt, user, grantedBy} - MESMO
  // formato flat do login. "grantedBy" e extra, so para log local.
  async redeemSupportGrant(grantToken: string): Promise<LoginResult | null> {
    const res = await this.request("/api/auth/support-redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: grantToken }),
    });
    if (res.status === 401) return null;
    if (!res.ok) throw new CoreClientError(res.status, await res.text());
    const body = (await res.json()) as { token: string; expiresAt: string; user: AuthResult; grantedBy: string };
    return { token: body.token, expiresAt: body.expiresAt, auth: body.user };
  }

  async logout(token: string): Promise<void> {
    const res = await this.request("/api/auth/logout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok && res.status !== 401 && res.status !== 404) {
      throw new CoreClientError(res.status, await res.text());
    }
  }

  async updateTenantSettings(tenantId: string, settings: Partial<TenantInfo["settings"]>): Promise<void> {
    const res = await this.request(`/api/tenants/${tenantId}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new CoreClientError(res.status, await res.text());
  }
}

// ============================================================================
// Selecao do client ativo. CORE_API_URL definido -> HttpCoreClient decorado com o
// cache obrigatorio de resolucao de tenant (CachedCoreClient). Ausente -> MockCoreClient.
// ============================================================================
export const coreClient: CoreClient = env.CORE_API_URL
  ? new CachedCoreClient(
      new HttpCoreClient(env.CORE_API_URL, env.CORE_INTERNAL_TOKEN, env.CORE_CLIENT_TIMEOUT_MS),
      getRedisClient(),
      env.CORE_TENANT_CACHE_TTL_SECONDS * 1000,
    )
  : new MockCoreClient(env.CORE_MOCK_TENANTS_FILE ? resolve(env.CORE_MOCK_TENANTS_FILE) : undefined);

export const mockCoreClient = coreClient as MockCoreClient;

export function listKnownTenantIds(): Promise<string[]> {
  const client = coreClient;
  if (client instanceof MockCoreClient) {
    return Promise.resolve(
      client.listTenantsForDevelopment().filter((t) => t.status !== "suspended").map((t) => t.id),
    );
  }
  return Promise.resolve([]);
}
