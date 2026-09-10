import { Router } from "express";
import { requireAuth, requireRole } from "../../shared/middlewares/auth.js";
import { asyncHandler } from "../../shared/middlewares/asyncHandler.js";
import * as classPeriodsController from "./classPeriods.controller.js";

// Grade de horarios/periodos de aula da escola. Leitura liberada tambem para
// PROFESSOR (precisa da grade para escolher o horario da reserva); toda mutacao
// (cadastro/edicao/exclusao/ativacao/reordenacao) e exclusiva do ADMIN.
export const classPeriodsRouter = Router();

classPeriodsRouter.use(requireAuth);

classPeriodsRouter.get("/", requireRole("ADMIN", "PROFESSOR"), asyncHandler(classPeriodsController.list));
classPeriodsRouter.get("/:id", requireRole("ADMIN", "PROFESSOR"), asyncHandler(classPeriodsController.get));
classPeriodsRouter.put("/reorder", requireRole("ADMIN"), asyncHandler(classPeriodsController.reorder));
classPeriodsRouter.post("/", requireRole("ADMIN"), asyncHandler(classPeriodsController.create));
classPeriodsRouter.put("/:id", requireRole("ADMIN"), asyncHandler(classPeriodsController.update));
classPeriodsRouter.delete("/:id", requireRole("ADMIN"), asyncHandler(classPeriodsController.remove));
classPeriodsRouter.post("/:id/activate", requireRole("ADMIN"), asyncHandler(classPeriodsController.activate));
classPeriodsRouter.post("/:id/deactivate", requireRole("ADMIN"), asyncHandler(classPeriodsController.deactivate));
