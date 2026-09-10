import { Prisma } from "@prisma/client";
import { prisma, withCurrentTenant } from "../../shared/prisma.js";
import { AppError } from "../../shared/errors/AppError.js";
import { isDeleteBlockedByReference } from "../../shared/errors/deleteConflict.js";
import { omitUndefined } from "../../shared/utils/omitUndefined.js";
import type {
  createClassPeriodSchema,
  updateClassPeriodSchema,
  listClassPeriodsQuerySchema,
  reorderClassPeriodsSchema,
} from "./classPeriods.validation.js";
import type { z } from "zod";

export async function listClassPeriods(query: z.infer<typeof listClassPeriodsQuerySchema>) {
  return prisma.classPeriod.findMany({
    where: query.active !== undefined ? { active: query.active } : {},
    orderBy: { displayOrder: "asc" },
  });
}

export async function getClassPeriodById(id: string) {
  const classPeriod = await prisma.classPeriod.findUnique({ where: { id } });
  if (!classPeriod) {
    throw AppError.notFound("Horario nao encontrado.");
  }
  return classPeriod;
}

// omitUndefined devolve Partial<T> - com exactOptionalPropertyTypes ligado (tsconfig
// deste modulo), o tipo formal ainda permite a chave existir com valor `undefined`,
// o que o input do Prisma (mais estrito) recusa. omitUndefined ja GARANTE em runtime
// que nenhuma chave sobra com undefined (zod que deixou opcional sem valor) - o cast
// so alinha o tipo com essa garantia, sem mudar nada em runtime.
export async function createClassPeriod(input: z.infer<typeof createClassPeriodSchema>) {
  return prisma.classPeriod.create({ data: omitUndefined(input) as Prisma.ClassPeriodCreateInput });
}

export async function updateClassPeriod(id: string, input: z.infer<typeof updateClassPeriodSchema>) {
  await getClassPeriodById(id);
  return prisma.classPeriod.update({ where: { id }, data: omitUndefined(input) as Prisma.ClassPeriodUpdateInput });
}

export async function setClassPeriodActive(id: string, active: boolean) {
  await getClassPeriodById(id);
  return prisma.classPeriod.update({ where: { id }, data: { active } });
}

// Delete de verdade (nao soft) - so permitido quando nenhuma Reservation aponta pra
// este ClassPeriod (Reservation.classPeriod tem onDelete: Restrict no schema, o
// Postgres recusa sozinho - ver shared/errors/deleteConflict.ts).
export async function deleteClassPeriod(id: string) {
  await getClassPeriodById(id);
  try {
    await prisma.classPeriod.delete({ where: { id } });
  } catch (err) {
    if (isDeleteBlockedByReference(err)) {
      throw AppError.conflict(
        "Nao e possivel excluir - existem reservas vinculadas a este horario. Desative-o em vez de excluir.",
      );
    }
    throw err;
  }
}

// Reordenar a grade de horarios - atualizacao em lote e transacional para nunca
// deixar a ordem em estado parcialmente aplicado (mesmo padrao de
// categories.service.ts reorderCategories, modulo Restaurante).
export async function reorderClassPeriods(input: z.infer<typeof reorderClassPeriodsSchema>) {
  const ids = input.items.map((item) => item.id);
  const found = await prisma.classPeriod.count({ where: { id: { in: ids } } });
  if (found !== ids.length) {
    throw AppError.validation("Um ou mais horarios informados nao existem.");
  }

  await withCurrentTenant(async (tx) =>
    Promise.all(
      input.items.map((item) =>
        tx.classPeriod.update({ where: { id: item.id }, data: { displayOrder: item.displayOrder } }),
      ),
    ),
  );

  return listClassPeriods({});
}
