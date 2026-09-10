import type { Request, Response } from "express";
import { internalTenantSchema, internalSetupSchema } from "./internal.validation.js";
import { offboardTenant } from "./offboarding.service.js";
import { runMaintenanceForTenant } from "./maintenance.service.js";
import { provisionInitialSetup } from "./setup.service.js";
import { armarioDigitalSetupSchema } from "./setupSchema.js";

export async function offboard(req: Request, res: Response) {
  const { tenantId } = internalTenantSchema.parse(req.body);
  const result = await offboardTenant(tenantId);
  res.json({ success: true, data: result });
}

export async function maintenance(req: Request, res: Response) {
  const { tenantId } = internalTenantSchema.parse(req.body);
  const result = await runMaintenanceForTenant(tenantId);
  res.json({ success: true, data: result });
}

export function setupSchema(_req: Request, res: Response) {
  res.json({ success: true, data: armarioDigitalSetupSchema });
}

export async function setup(req: Request, res: Response) {
  const input = internalSetupSchema.parse(req.body);
  const result = await provisionInitialSetup(input);
  res.json({ success: true, data: result });
}
