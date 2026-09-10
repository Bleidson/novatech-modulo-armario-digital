// Seed do ADMIN inicial em producao - mesmo padrao ja usado no deploy da Core
// (SEED_ADMIN_EMAIL/PASSWORD/NAME no .env de producao, ver docs/17_CONTINUIDADE.md
// do modulo Restaurante). So roda quando SEED_ADMIN_EMAIL esta definido (nunca em
// dev/teste, onde essas variaveis nao existem) e e IDEMPOTENTE: se o e-mail ja
// existir, nao faz nada - nunca sobrescreve uma senha ja em uso.
//
// Necessario porque este modulo, sem uma Core real integrada ainda
// (CORE_API_URL vazio -> MockCoreClient), nao tem nenhum outro jeito de criar o
// primeiro Administrador: normalmente ele viria da Core (Account criada no
// checkout do site), e o deploy nao expoe acesso de banco nem exec de
// container para inserir isso na mao.
//
// Usa o `prisma` (client com tenant escopado por transacao) e
// runWithTenantContext do proprio modulo, NUNCA um PrismaClient cru com
// set_config solto - set_config fora de uma transacao/mesma conexao nao tem
// garantia de valer para a query seguinte (pool de conexoes), exatamente o
// bug documentado em shared/tenantContext.ts.
import { prisma } from "../src/shared/prisma.js";
import { runWithTenantContext } from "../src/shared/tenantContext.js";
import bcrypt from "bcryptjs";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

async function main() {
  const email = process.env["SEED_ADMIN_EMAIL"];
  const password = process.env["SEED_ADMIN_PASSWORD"];
  const name = process.env["SEED_ADMIN_NAME"] ?? "Administrador";

  if (!email || !password) {
    console.log("[seed-admin] SEED_ADMIN_EMAIL/PASSWORD ausentes - pulando.");
    return;
  }

  await runWithTenantContext(TENANT_ID, async () => {
    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing) {
      console.log(`[seed-admin] ${email} ja existe - nada a fazer.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { name, email, passwordHash, role: "ADMIN", status: "ACTIVE" },
    });
    console.log(`[seed-admin] ADMIN ${email} criado.`);
  });
}

main()
  .catch((err) => {
    console.error("[seed-admin] falhou:", err);
    // Nunca derruba o boot do container por causa do seed - login ADMIN so
    // nao vai funcionar ainda, o resto do modulo continua no ar.
  })
  .finally(() => process.exit(0));
