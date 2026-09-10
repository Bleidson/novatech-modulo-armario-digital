import type { Request, Response } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import {
  createClassPeriodSchema,
  updateClassPeriodSchema,
  listClassPeriodsQuerySchema,
  reorderClassPeriodsSchema,
} from "./classPeriods.validation.js";
import * as classPeriodsService from "./classPeriods.service.js";

export async function list(req: Request, res: Response) {
  const query = listClassPeriodsQuerySchema.parse(req.query);
  const classPeriods = await classPeriodsService.listClassPeriods(query);
  res.json({ success: true, data: classPeriods });
}

export async function get(req: Request, res: Response) {
  const id = req.params["id"];
  if (!id) throw AppError.validation();
  const classPeriod = await classPeriodsService.getClassPeriodById(id);
  res.json({ success: true, data: classPeriod });
}

export async function create(req: Request, res: Response) {
  const input = createClassPeriodSchema.parse(req.body);
  const classPeriod = await classPeriodsService.createClassPeriod(input);
  res.status(201).json({ success: true, data: classPeriod });
}

export async function update(req: Request, res: Response) {
  const id = req.params["id"];
  if (!id) throw AppError.validation();
  const input = updateClassPeriodSchema.parse(req.body);
  const classPeriod = await classPeriodsService.updateClassPeriod(id, input);
  res.json({ success: true, data: classPeriod });
}

export async function activate(req: Request, res: Response) {
  const id = req.params["id"];
  if (!id) throw AppError.validation();
  const classPeriod = await classPeriodsService.setClassPeriodActive(id, true);
  res.json({ success: true, data: classPeriod });
}

export async function deactivate(req: Request, res: Response) {
  const id = req.params["id"];
  if (!id) throw AppError.validation();
  const classPeriod = await classPeriodsService.setClassPeriodActive(id, false);
  res.json({ success: true, data: classPeriod });
}

export async function remove(req: Request, res: Response) {
  const id = req.params["id"];
  if (!id) throw AppError.validation();
  await classPeriodsService.deleteClassPeriod(id);
  res.status(204).send();
}

export async function reorder(req: Request, res: Response) {
  const input = reorderClassPeriodsSchema.parse(req.body);
  const classPeriods = await classPeriodsService.reorderClassPeriods(input);
  res.json({ success: true, data: classPeriods });
}
