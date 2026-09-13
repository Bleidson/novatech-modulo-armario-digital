import type { AuthResult, CoreClient, LoginResult, TenantInfo } from "./core-client.js";
import { logger } from "../shared/logger.js";

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
}

interface CacheEntry {
  value: TenantInfo | null;
  cachedAt: number;
}

const KEY_PREFIX = "core:tenant-by-slug:";

// Cache de resolucao de tenant por slug - obrigatorio a partir do momento em que
// coreClient vira uma chamada HTTP de verdade. Se a Core nao responder (timeout, 5xx,
// fora do ar), serve o ultimo valor conhecido em cache mesmo vencido, com log de
// alerta - nunca derruba a operacao da escola por uma instabilidade da Core.
export class CachedCoreClient implements CoreClient {
  constructor(
    private readonly inner: CoreClient,
    private readonly store: CacheStore,
    private readonly ttlMs: number,
  ) {}

  async resolveTenantBySlug(slug: string): Promise<TenantInfo | null> {
    const key = KEY_PREFIX + slug;
    const cachedRaw = await this.store.get(key);
    const cached = cachedRaw ? (JSON.parse(cachedRaw) as CacheEntry) : null;

    if (cached && Date.now() - cached.cachedAt < this.ttlMs) {
      return cached.value;
    }

    try {
      const fresh = await this.inner.resolveTenantBySlug(slug);
      const entry: CacheEntry = { value: fresh, cachedAt: Date.now() };
      await this.store.set(key, JSON.stringify(entry));
      return fresh;
    } catch (err) {
      if (cached) {
        logger.warn(
          { err, slug, cachedAt: new Date(cached.cachedAt).toISOString() },
          "CORE_UNAVAILABLE_SERVING_STALE_TENANT_CACHE",
        );
        return cached.value;
      }
      throw err;
    }
  }

  verifySession(token: string): Promise<AuthResult | null> {
    return this.inner.verifySession(token);
  }

  login(tenantId: string, email: string, password: string): Promise<LoginResult | null> {
    return this.inner.login(tenantId, email, password);
  }

  redeemSupportGrant(grantToken: string): Promise<LoginResult | null> {
    return this.inner.redeemSupportGrant(grantToken);
  }

  logout(token: string): Promise<void> {
    return this.inner.logout(token);
  }

  // Slug e ESTAVEL (nunca muda depois de criado) - diferente de Host, que podia
  // ter varios valores por tenant (custom domain, subdominio). Invalidar por
  // slug direto, sem precisar de um indice reverso tenantId -> slugs.
  async updateTenantSettings(tenantId: string, settings: Partial<TenantInfo["settings"]>): Promise<void> {
    await this.inner.updateTenantSettings(tenantId, settings);
  }
}
