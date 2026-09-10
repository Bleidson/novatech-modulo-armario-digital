import { prisma } from "./prisma.js";

// Apaga TODO o dado de negocio do tenant que estiver no contexto atual (RLS-scoped) -
// nunca um TRUNCATE de tabela inteira. Chamar isto fora de withTenant()/
// runWithTenantContext() falha alto (requireTenantId), nunca varre o banco inteiro em
// silencio.
//
// Usado em dois lugares que precisam do EXATO mesmo comportamento:
//   - test/dbHelpers.ts resetDb() - limpa os tenants de teste entre arquivos;
//   - modules/internal/offboarding.service.ts - apaga o dado de um tenant removido da
//     plataforma (chamado pela Core via POST /internal/offboard).
//
// Se um model novo entrar no schema, esta e a UNICA lista que precisa lembrar dele.
export async function wipeCurrentTenantData(): Promise<number> {
  let total = 0;
  const del = async (op: Promise<{ count: number }>) => {
    total += (await op).count;
  };

  await del(prisma.session.deleteMany());
  await del(prisma.reservation.deleteMany());
  await del(prisma.classPeriod.deleteMany());
  await del(prisma.material.deleteMany());
  await del(prisma.user.deleteMany());

  return total;
}
