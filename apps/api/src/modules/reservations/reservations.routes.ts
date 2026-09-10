import { Router } from "express";
import { requireAuth } from "../../shared/middlewares/auth.js";
import { asyncHandler } from "../../shared/middlewares/asyncHandler.js";
import * as reservationsController from "./reservations.controller.js";

// PROFESSOR e ADMIN operam aqui os dois - sem requireRole: PROFESSOR reserva para
// si mesmo, ADMIN tem visao/uso de fiscalizacao (ve tudo, pode reservar/cancelar
// qualquer uma). O escopo por papel e resolvido dentro do service, nunca aqui.
export const reservationsRouter = Router();

reservationsRouter.use(requireAuth);

// Antes de "/:id" nao ha ambiguidade aqui (nao existe GET "/:id"), mas mantem o
// mais especifico primeiro por consistencia com o resto da plataforma.
reservationsRouter.get("/availability", asyncHandler(reservationsController.availability));
reservationsRouter.get("/", asyncHandler(reservationsController.list));
reservationsRouter.post("/", asyncHandler(reservationsController.create));
reservationsRouter.delete("/:id", asyncHandler(reservationsController.remove));
