import { PrismaClient, type Prisma } from "@prisma/client";
import { env } from "./env.js";
import { requireTenantId } from "./tenantContext.js";

// Cliente "cru", sem escopo de tenant. Uso restrito: health check (SELECT 1),
// migrations/seed, e a propria implementacao de withTenant abaixo. Nenhum service de
// dominio deve importar isto - services usam `prisma`.
export const basePrisma = new PrismaClient({
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

// set_config(chave, valor, true) e a forma funcional de SET LOCAL: vale so ate o fim
// da transacao atual. Precisa ser SET LOCAL e nunca SET simples - a aplicacao roda com
// pool de conexoes, e um SET comum sobreviveria a requisicao, "emprestando" o tenant
// de uma escola para a proxima requisicao que reaproveitasse aquela conexao.
function setTenantOnConnection(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
}

// Transacao escopada a um tenant. Use nas operacoes que precisam ser atomicas entre
// varias tabelas.
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return basePrisma.$transaction(async (tx) => {
    await setTenantOnConnection(tx, tenantId);
    return fn(tx);
  });
}

export async function withCurrentTenant<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return withTenant(requireTenantId(), fn);
}

// Cliente que os services usam. Cada operacao de model vira, sozinha, uma transacao
// que primeiro fixa o tenant da sessao e so entao roda a consulta - as duas coisas na
// MESMA conexao, que e o que faz o SET LOCAL valer para a consulta seguinte.
export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        const tenantId = requireTenantId();
        const [, result] = await basePrisma.$transaction([
          basePrisma.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
          query(args),
        ]);
        return result as unknown;
      },
    },
  },
});
