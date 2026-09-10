import { runWithTenantContext } from "../../shared/tenantContext.js";
import { prisma } from "../../shared/prisma.js";
import type { internalSetupSchema } from "./internal.validation.js";
import type { z } from "zod";

export interface SetupResult {
  tenantId: string;
  periodosCriados: number;
}

/**
 * Chamado por POST /internal/setup (novatech-site, wizard de setup) logo apos
 * POST /api/tenants criar o Tenant na Core - grava os dados especificos do nicho
 * Armario Digital (grade de horarios) que a Core deliberadamente nao guarda. Sem
 * sessao de usuario: so um chamador com o segredo compartilhado (x-internal-token)
 * consegue provisionar o tenant neste momento.
 *
 * Idempotencia deliberadamente NAO implementada (mesmo padrao do Restaurante):
 * rodar isto duas vezes duplicaria os horarios. O wizard so chama isto UMA vez, na
 * confirmacao final.
 */
export async function provisionInitialSetup(
  input: z.infer<typeof internalSetupSchema>,
): Promise<SetupResult> {
  return runWithTenantContext(input.tenantId, async () => {
    for (const [index, periodo] of input.periodos.entries()) {
      await prisma.classPeriod.create({ data: { name: periodo.name, displayOrder: index } });
    }

    return { tenantId: input.tenantId, periodosCriados: input.periodos.length };
  });
}
