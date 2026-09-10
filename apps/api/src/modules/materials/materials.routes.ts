import { Router } from "express";
import { requireAuth, requireRole } from "../../shared/middlewares/auth.js";
import { asyncHandler } from "../../shared/middlewares/asyncHandler.js";
import * as materialsController from "./materials.controller.js";

// Catalogo de materiais reservaveis. Leitura liberada tambem para PROFESSOR (precisa
// do catalogo para escolher o que reservar - ver modulo reservations do Teammate C);
// toda mutacao (cadastro/edicao/exclusao/ativacao) e exclusiva do ADMIN.
export const materialsRouter = Router();

materialsRouter.use(requireAuth);

materialsRouter.get("/", requireRole("ADMIN", "PROFESSOR"), asyncHandler(materialsController.list));
materialsRouter.get("/:id", requireRole("ADMIN", "PROFESSOR"), asyncHandler(materialsController.get));
materialsRouter.post("/", requireRole("ADMIN"), asyncHandler(materialsController.create));
materialsRouter.put("/:id", requireRole("ADMIN"), asyncHandler(materialsController.update));
materialsRouter.delete("/:id", requireRole("ADMIN"), asyncHandler(materialsController.remove));
materialsRouter.post("/:id/activate", requireRole("ADMIN"), asyncHandler(materialsController.activate));
materialsRouter.post("/:id/deactivate", requireRole("ADMIN"), asyncHandler(materialsController.deactivate));
