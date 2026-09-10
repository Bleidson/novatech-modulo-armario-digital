import type { Request, Response } from "express";
import { AppError } from "../../shared/errors/AppError.js";
import { createMaterialSchema, updateMaterialSchema, listMaterialsQuerySchema } from "./materials.validation.js";
import * as materialsService from "./materials.service.js";

export async function list(req: Request, res: Response) {
  const query = listMaterialsQuerySchema.parse(req.query);
  const materials = await materialsService.listMaterials(query);
  res.json({ success: true, data: materials });
}

export async function get(req: Request, res: Response) {
  const id = req.params["id"];
  if (!id) throw AppError.validation();
  const material = await materialsService.getMaterialById(id);
  res.json({ success: true, data: material });
}

export async function create(req: Request, res: Response) {
  const input = createMaterialSchema.parse(req.body);
  const material = await materialsService.createMaterial(input);
  res.status(201).json({ success: true, data: material });
}

export async function update(req: Request, res: Response) {
  const id = req.params["id"];
  if (!id) throw AppError.validation();
  const input = updateMaterialSchema.parse(req.body);
  const material = await materialsService.updateMaterial(id, input);
  res.json({ success: true, data: material });
}

export async function activate(req: Request, res: Response) {
  const id = req.params["id"];
  if (!id) throw AppError.validation();
  const material = await materialsService.setMaterialActive(id, true);
  res.json({ success: true, data: material });
}

export async function deactivate(req: Request, res: Response) {
  const id = req.params["id"];
  if (!id) throw AppError.validation();
  const material = await materialsService.setMaterialActive(id, false);
  res.json({ success: true, data: material });
}

export async function remove(req: Request, res: Response) {
  const id = req.params["id"];
  if (!id) throw AppError.validation();
  await materialsService.deleteMaterial(id);
  res.status(204).send();
}
