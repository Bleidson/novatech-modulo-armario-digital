import { z } from "zod";

export const createClassPeriodSchema = z.object({
  name: z.string().trim().min(1),
  startTime: z.string().trim().min(1).nullable().optional(),
  endTime: z.string().trim().min(1).nullable().optional(),
  displayOrder: z.number().int().optional(),
});

export const updateClassPeriodSchema = z.object({
  name: z.string().trim().min(1).optional(),
  startTime: z.string().trim().min(1).nullable().optional(),
  endTime: z.string().trim().min(1).nullable().optional(),
  displayOrder: z.number().int().optional(),
});

export const listClassPeriodsQuerySchema = z.object({
  active: z.coerce.boolean().optional(),
});

export const reorderClassPeriodsSchema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), displayOrder: z.number().int() })).min(1),
});
