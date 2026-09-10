import type { Request, Response } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import {
  createReservationSchema,
  listReservationsQuerySchema,
  availabilityQuerySchema,
} from "./reservations.validation.js";
import * as reservationsService from "./reservations.service.js";

// professorId NUNCA vem de req.body - so req.user!.id. ADMIN tambem so cria para
// si mesmo (uso de fiscalizacao/teste); "reservar em nome de outro" e fora de
// escopo, ver reservations.validation.ts.
export async function create(req: Request, res: Response) {
  const input = createReservationSchema.parse(req.body);
  const reservation = await reservationsService.createReservation(req.user!.id, input);
  res.status(201).json({ success: true, data: reservation });
}

export async function list(req: Request, res: Response) {
  const query = listReservationsQuerySchema.parse(req.query);
  const reservations = await reservationsService.listReservations(
    { id: req.user!.id, role: req.user!.role },
    query,
  );
  res.json({ success: true, data: reservations });
}

export async function availability(req: Request, res: Response) {
  const query = availabilityQuerySchema.parse(req.query);
  const slots = await reservationsService.getAvailability({ id: req.user!.id, role: req.user!.role }, query);
  res.json({ success: true, data: slots });
}

export async function remove(req: Request, res: Response) {
  const id = req.params["id"];
  if (!id) throw AppError.validation();
  await reservationsService.cancelReservation({ id: req.user!.id, role: req.user!.role }, id);
  res.status(204).send();
}

// GET /:id/negotiate-contact - ver reservations.service.ts getNegotiateContact
// para a regra completa. O frontend deve usar o {phone} devolvido aqui SO para
// montar o href do wa.me na hora (window.location.href) - nunca renderiza-lo como
// texto visivel na tela (Tarefa "Ajustes Visuais e Operacionais" secao 2.4.3).
export async function negotiateContact(req: Request, res: Response) {
  const id = req.params["id"];
  if (!id) throw AppError.validation();
  const contact = await reservationsService.getNegotiateContact({ id: req.user!.id, role: req.user!.role }, id);
  res.json({ success: true, data: contact });
}
