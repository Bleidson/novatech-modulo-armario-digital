import { z } from "zod";

export const createMaterialSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).nullable().optional(),
  imageUrl: z.string().trim().min(1).nullable().optional(),
  category: z.string().trim().min(1).nullable().optional(),
});

export const updateMaterialSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).nullable().optional(),
  imageUrl: z.string().trim().min(1).nullable().optional(),
  category: z.string().trim().min(1).nullable().optional(),
});

export const listMaterialsQuerySchema = z.object({
  active: z.coerce.boolean().optional(),
});
