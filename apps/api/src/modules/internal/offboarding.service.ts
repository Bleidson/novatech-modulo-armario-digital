import { rm } from "node:fs/promises";
import { runWithTenantContext } from "../../shared/tenantContext.js";
import { wipeCurrentTenantData } from "../../shared/tenantWipe.js";
import { materialsUploadPathFor } from "../uploads/uploads.routes.js";
import { logger } from "../../shared/logger.js";

export interface OffboardResult {
  tenantId: string;
  rowsDeleted: number;
  uploadsRemoved: boolean;
}

// Chamado por POST /internal/offboard (Core, servidor-a-servidor) quando uma escola
// sai da plataforma. Nao existe ON DELETE CASCADE entre o banco da Core e o deste
// modulo (bancos diferentes, sem FK entre eles) - a Core avisa, este modulo apaga o
// proprio lado.
//
// Idempotente por construcao: wipeCurrentTenantData() e so deleteMany por tabela
// (conta 0 se ja estiver vazio); rm(..., {force:true}) nao lanca se a pasta ja nao
// existir. Chamar duas vezes para o mesmo tenantId e seguro.
export async function offboardTenant(tenantId: string): Promise<OffboardResult> {
  const rowsDeleted = await runWithTenantContext(tenantId, () => wipeCurrentTenantData());

  const uploadsDir = materialsUploadPathFor(tenantId);
  await rm(uploadsDir, { recursive: true, force: true });

  logger.info({ tenantId, rowsDeleted, uploadsDir }, "TENANT_OFFBOARDED");

  return { tenantId, rowsDeleted, uploadsRemoved: true };
}
