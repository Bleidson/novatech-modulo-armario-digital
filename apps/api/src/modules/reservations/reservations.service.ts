import { Prisma, type Role } from "@prisma/client";
import { prisma } from "../../shared/prisma.js";
import { AppError } from "../../shared/errors/AppError.js";
import type {
  createReservationSchema,
  listReservationsQuerySchema,
  availabilityQuerySchema,
} from "./reservations.validation.js";
import type { z } from "zod";

interface Caller {
  id: string;
  role: Role;
}

// Data local do SERVIDOR, sem hora - "hoje" precisa ser o dia civil de quem opera o
// modulo (a escola), nunca UTC puro (evitaria reservar "amanha" achando que e "hoje"
// perto da meia-noite, ou vice-versa). Comparacao e sempre string-a-string
// (AAAA-MM-DD ordena lexicograficamente igual a ordem cronologica).
function todayDateOnlyString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// @db.Date nao guarda fuso - grava sempre a mesma data civil independente de onde o
// processo roda, construindo o Date em UTC meia-noite (nunca com o construtor local,
// que deslocaria o dia conforme o timezone do processo).
function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

const reservationInclude = {
  material: { select: { id: true, name: true, category: true, imageUrl: true } },
  classPeriod: { select: { id: true, name: true, startTime: true, endTime: true } },
} satisfies Prisma.ReservationInclude;

// POST / - cria a reserva. A garantia real de "nao pode haver dois professores no
// mesmo material+data+horario" e a constraint @@unique do Postgres (P2002 abaixo),
// nunca este pre-check: um SELECT-antes-do-INSERT teria uma janela de corrida entre
// as duas operacoes. O pre-check aqui so existe para devolver uma mensagem melhor
// no caminho SEM corrida (material/horario inativo ou inexistente) - ver
// schema.prisma, comentario do model Reservation.
export async function createReservation(
  professorId: string,
  input: z.infer<typeof createReservationSchema>,
) {
  if (input.date < todayDateOnlyString()) {
    throw AppError.validation("Nao e possivel reservar uma data no passado.");
  }

  const [material, classPeriod] = await Promise.all([
    prisma.material.findUnique({ where: { id: input.materialId } }),
    prisma.classPeriod.findUnique({ where: { id: input.classPeriodId } }),
  ]);

  if (!material || !material.active) {
    throw AppError.validation("Material nao encontrado ou inativo.");
  }
  if (!classPeriod || !classPeriod.active) {
    throw AppError.validation("Horario nao encontrado ou inativo.");
  }

  try {
    return await prisma.reservation.create({
      data: {
        materialId: input.materialId,
        classPeriodId: input.classPeriodId,
        professorId,
        date: parseDateOnly(input.date),
      },
      include: reservationInclude,
    });
  } catch (err) {
    // P2002 = violacao da @@unique([tenantId, materialId, date, classPeriodId]) - o
    // MECANISMO de corretude sob concorrencia, nao um efeito colateral. Duas
    // requisicoes simultaneas para o mesmo slot: o Postgres serializa as duas
    // gravacoes, a segunda bate aqui.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw AppError.conflict("Este horario ja esta reservado para este material.");
    }
    throw err;
  }
}

// GET / - PROFESSOR ve so as proprias reservas; ADMIN ve todas (visao de
// fiscalizacao/coordenacao). Filtro opcional por data exata.
export async function listReservations(caller: Caller, query: z.infer<typeof listReservationsQuerySchema>) {
  return prisma.reservation.findMany({
    where: {
      ...(caller.role === "PROFESSOR" ? { professorId: caller.id } : {}),
      ...(query.date ? { date: parseDateOnly(query.date) } : {}),
    },
    include: reservationInclude,
    orderBy: [{ date: "asc" }, { classPeriod: { displayOrder: "asc" } }],
  });
}

interface AvailabilitySlot {
  materialId: string;
  materialName: string;
  classPeriodId: string;
  classPeriodName: string;
  reserved: boolean;
  reservedBy?: { id: string; name: string } | null;
}

// GET /availability?date=... - grade completa Material ativo x ClassPeriod ativo
// para uma data, usada pelo catalogo do professor. "reservedBy" so entra na
// resposta para ADMIN - um PROFESSOR nunca ve o nome de outro professor (vazamento
// de privacidade entre colegas), so o booleano reserved.
export async function getAvailability(
  caller: Caller,
  query: z.infer<typeof availabilityQuerySchema>,
): Promise<AvailabilitySlot[]> {
  const date = parseDateOnly(query.date);
  const isAdmin = caller.role === "ADMIN";

  const [materials, classPeriods, reservations] = await Promise.all([
    prisma.material.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.classPeriod.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } }),
    prisma.reservation.findMany({
      where: { date },
      include: { professor: { select: { id: true, name: true } } },
    }),
  ]);

  const reservationByKey = new Map<string, (typeof reservations)[number]>();
  for (const reservation of reservations) {
    reservationByKey.set(`${reservation.materialId}:${reservation.classPeriodId}`, reservation);
  }

  const slots: AvailabilitySlot[] = [];
  for (const material of materials) {
    for (const classPeriod of classPeriods) {
      const reservation = reservationByKey.get(`${material.id}:${classPeriod.id}`);
      slots.push({
        materialId: material.id,
        materialName: material.name,
        classPeriodId: classPeriod.id,
        classPeriodName: classPeriod.name,
        reserved: Boolean(reservation),
        ...(isAdmin
          ? { reservedBy: reservation ? { id: reservation.professor.id, name: reservation.professor.name } : null }
          : {}),
      });
    }
  }

  return slots;
}

// DELETE /:id - cancelar = apagar a linha (ver schema.prisma). So o professor dono
// ou ADMIN pode. Quando existe mas e de outro professor: 404, nunca 403 - o mesmo
// padrao de cancelTrialSubscription na novatech-core (nao confirma pra quem nao e
// dono que a reserva existe).
export async function cancelReservation(caller: Caller, id: string): Promise<void> {
  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) {
    throw AppError.notFound("Reserva nao encontrada.");
  }
  if (caller.role !== "ADMIN" && reservation.professorId !== caller.id) {
    throw AppError.notFound("Reserva nao encontrada.");
  }

  await prisma.reservation.delete({ where: { id } });
}
