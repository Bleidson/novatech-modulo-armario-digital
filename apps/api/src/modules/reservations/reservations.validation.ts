import { z } from "zod";

// Data "pura" (sem hora) no formato usado por toda a UI e pela coluna @db.Date do
// Prisma (schema.prisma - Reservation.date) - nunca um DateTime completo, ver
// comentario do model.
const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida. Use o formato AAAA-MM-DD.");

export const createReservationSchema = z.object({
  materialId: z.string().uuid(),
  classPeriodId: z.string().uuid(),
  date: dateOnlySchema,
});

// professorId NUNCA vem daqui de proposito (ver reservations.controller.ts) - um
// professor so pode reservar para si mesmo, e o campo do body seria uma forma de
// reservar "em nome de outro".
export const listReservationsQuerySchema = z.object({
  date: dateOnlySchema.optional(),
});

// materialId opcional: a tela de Calendario (Tarefa "Ajustes Visuais e
// Operacionais" secao 2) so precisa da grade de UM material por vez, para varios
// dias da semana - sem o filtro, cada dia da semana baixaria a grade inteira de
// TODOS os materiais so para usar uma fatia dela.
export const availabilityQuerySchema = z.object({
  date: dateOnlySchema,
  materialId: z.string().uuid().optional(),
});
