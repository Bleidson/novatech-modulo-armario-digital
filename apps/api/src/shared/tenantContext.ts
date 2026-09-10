import { AsyncLocalStorage } from "node:async_hooks";
import type { TenantInfo } from "../lib/core-client.js";

// Contexto do tenant da requisicao em andamento - mesmo padrao do modulo Restaurante
// (AsyncLocalStorage aberto uma vez por requisicao, no middleware resolveTenant;
// todo await disparado dentro dela o herda automaticamente). Quem garante o
// isolamento e a policy do Postgres (Row Level Security), nao o cuidado de quem
// escreve a chamada.
interface TenantStore {
  tenantId: string;
  tenant?: TenantInfo;
}

const storage = new AsyncLocalStorage<TenantStore>();

export function runWithTenantContext<T>(tenantId: string, fn: () => T, tenant?: TenantInfo): T {
  return storage.run(tenant ? { tenantId, tenant } : { tenantId }, fn);
}

export function getCurrentTenant(): TenantInfo | null {
  return storage.getStore()?.tenant ?? null;
}

export function getTenantId(): string | null {
  return storage.getStore()?.tenantId ?? processDefaultTenantId;
}

// --- tenant padrao do processo (SOMENTE em teste) ---------------------------
// Um teste que chama fixture e faz assert direto no Prisma roda fora de qualquer
// requisicao HTTP - sem uma saida, cada arquivo de teste teria que embrulhar toda
// chamada em runWithTenantContext. O AsyncLocalStorage continua tendo PRECEDENCIA
// (um teste HTTP usa o tenant que o header Host resolveu; um teste de isolamento
// troca explicitamente com runWithTenantContext); isto so entra quando nao ha
// contexto nenhum.
let processDefaultTenantId: string | null = null;

export function setProcessDefaultTenant(tenantId: string | null): void {
  if (process.env["NODE_ENV"] !== "test") {
    throw new Error(
      "setProcessDefaultTenant so pode ser usado em teste. Em codigo normal, o tenant " +
        "vem da requisicao (resolveTenant) ou de um withTenant(tenantId, ...) explicito.",
    );
  }
  processDefaultTenantId = tenantId;
}

// Usado por tudo que toca o banco. Falhar aqui e deliberado: uma consulta sem tenant
// no contexto nao tem resposta correta possivel - devolver "tudo" seria vazamento
// entre escolas, devolver "nada" esconderia o bug atras de uma tela vazia.
export function requireTenantId(): string {
  const tenantId = getTenantId();
  if (!tenantId) {
    throw new Error(
      "Nenhum tenant no contexto da operacao. Toda consulta ao banco precisa acontecer " +
        "dentro de uma requisicao com tenant resolvido (middleware resolveTenant) ou " +
        "dentro de withTenant(tenantId, ...) - ver shared/prisma.ts.",
    );
  }
  return tenantId;
}

// ARMADILHA (ja documentada no Restaurante, vale exatamente igual aqui): PrismaPromise
// e PREGUICOSA - `prisma.x.findMany()` nao dispara consulta nenhuma enquanto ninguem
// der await. Se a promise for CRIADA dentro do contexto mas AGUARDADA fora dele, o
// tenant e resolvido tarde demais.
//   ERRADO:  runWithTenantContext(B, () => prisma.material.findMany())
//   CERTO:   runWithTenantContext(B, async () => prisma.material.findMany())

export function applyTenantSettingsToContext(settings: Partial<TenantInfo["settings"]>): void {
  const store = storage.getStore();
  if (!store?.tenant) return;
  store.tenant = { ...store.tenant, settings: { ...store.tenant.settings, ...settings } };
}
