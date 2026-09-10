import { Prisma } from "@prisma/client";

// P2003: violacao de foreign key - o Postgres recusou o DELETE porque outra linha
// ainda referencia esta (ex.: apagar um Material que tem Reservation apontando pra
// ele). Usado para trocar um 500 cru por um 409 com mensagem util (ver services que
// fazem delete "de verdade").
export function isDeleteBlockedByReference(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003";
}
