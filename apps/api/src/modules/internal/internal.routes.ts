import { Router } from "express";
import { asyncHandler } from "../../shared/middlewares/asyncHandler.js";
import { requireInternalToken } from "../../shared/middlewares/internalAuth.js";
import * as internalController from "./internal.controller.js";

// Superficie EXCLUSIVAMENTE servidor-a-servidor - Core -> modulo (offboard,
// maintenance) OU novatech-site -> modulo (setup, setup-schema) - nunca exposta a
// usuario final nem ao painel da escola. Fica fora de /api/v1 (nao passa por
// resolveTenant) e exige requireInternalToken em vez de sessao/CSRF.
export const internalRouter = Router();
internalRouter.use(requireInternalToken);

internalRouter.post("/offboard", asyncHandler(internalController.offboard));
internalRouter.post("/maintenance", asyncHandler(internalController.maintenance));
internalRouter.get("/setup-schema", internalController.setupSchema);
internalRouter.post("/setup", asyncHandler(internalController.setup));
