import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/prisma.js";
import { AppError } from "../../shared/errors/AppError.js";
import { isDeleteBlockedByReference } from "../../shared/errors/deleteConflict.js";
import { omitUndefined } from "../../shared/utils/omitUndefined.js";
import type { createMaterialSchema, updateMaterialSchema, listMaterialsQuerySchema } from "./materials.validation.js";
import type { z } from "zod";

export async function listMaterials(query: z.infer<typeof listMaterialsQuerySchema>) {
  return prisma.material.findMany({
    where: query.active !== undefined ? { active: query.active } : {},
    orderBy: { name: "asc" },
  });
}

export async function getMaterialById(id: string) {
  const material = await prisma.material.findUnique({ where: { id } });
  if (!material) {
    throw AppError.notFound("Material nao encontrado.");
  }
  return material;
}

// omitUndefined devolve Partial<T> - com exactOptionalPropertyTypes ligado (tsconfig
// deste modulo), o tipo formal ainda permite a chave existir com valor `undefined`,
// o que o input do Prisma (mais estrito) recusa. omitUndefined ja GARANTE em runtime
// que nenhuma chave sobra com undefined (zod que deixou opcional sem valor) - o cast
// so alinha o tipo com essa garantia, sem mudar nada em runtime.
export async function createMaterial(input: z.infer<typeof createMaterialSchema>) {
  return prisma.material.create({ data: omitUndefined(input) as Prisma.MaterialCreateInput });
}

export async function updateMaterial(id: string, input: z.infer<typeof updateMaterialSchema>) {
  await getMaterialById(id);
  return prisma.material.update({ where: { id }, data: omitUndefined(input) as Prisma.MaterialUpdateInput });
}

export async function setMaterialActive(id: string, active: boolean) {
  await getMaterialById(id);
  return prisma.material.update({ where: { id }, data: { active } });
}

// Delete de verdade (nao soft) - so permitido quando nenhuma Reservation aponta pra
// este Material (Reservation.material tem onDelete: Restrict no schema, o Postgres
// recusa sozinho - ver shared/errors/deleteConflict.ts).
export async function deleteMaterial(id: string) {
  await getMaterialById(id);
  try {
    await prisma.material.delete({ where: { id } });
  } catch (err) {
    if (isDeleteBlockedByReference(err)) {
      throw AppError.conflict(
        "Nao e possivel excluir - existem reservas vinculadas a este material. Desative-o em vez de excluir.",
      );
    }
    throw err;
  }
}
