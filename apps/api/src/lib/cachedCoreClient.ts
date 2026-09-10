import type { AuthResult, CoreClient, LoginResult, TenantInfo } from "./core-client.js";
import { logger } from "../shared/logger.js";

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  sadd(key: string, member: string): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
  del(...keys: string[]): Promise<unknown>;
}

interface CacheEntry {
  value: TenantInfo | null;
  cachedAt: number;
}

const KEY_PREFIX = "core:tenant-by-domain:";
const HOSTS_KEY_PREFIX = "core:tenant-hosts:";

// Cache de resolucao de tenant por dominio - obrigatorio a partir do momento em que
// coreClient vira uma chamada HTTP de verdade. Se a Core nao responder (timeout, 5xx,
// fora do ar), serve o ultimo valor conhecido em cache mesmo vencido, com log de
// alerta - nunca derruba a operacao da escola por uma instabilidade da Core. Mesmo
// padrao do modulo Restaurante.
export class CachedCoreClient implements CoreClient {
  constructor(
    private readonly inner: CoreClient,
    private readonly store: CacheStore,
    private readonly ttlMs: number,
  ) {}

  async resolveTenantByDomain(host: string): Promise<TenantInfo | null> {
    const key = KEY_PREFIX + host;
    const cachedRaw = await this.store.get(key);
    const cached = cachedRaw ? (JSON.parse(cachedRaw) as CacheEntry) : null;

    if (cached && Date.now() - cached.cachedAt < this.ttlMs) {
      return cached.value;
    }

    try {
      const fresh = await this.inner.resolveTenantByDomain(host);
      const entry: CacheEntry = { value: fresh, cachedAt: Date.now() };
      await this.store.set(key, JSON.stringify(entry));
      if (fresh) await this.store.sadd(HOSTS_KEY_PREFIX + fresh.id, host);
      return fresh;
    } catch (err) {
      if (cached) {
        logger.warn(
          { err, host, cachedAt: new Date(cached.cachedAt).toISOString() },
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

  async updateTenantSettings(tenantId: string, settings: Partial<TenantInfo["settings"]>): Promise<void> {
    await this.inner.updateTenantSettings(tenantId, settings);

    const hosts = await this.store.smembers(HOSTS_KEY_PREFIX + tenantId);
    if (hosts.length > 0) {
      await this.store.del(...hosts.map((h) => KEY_PREFIX + h));
    }
  }
}
