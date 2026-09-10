import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

// Cadastro publico de Professor - qualquer um pode chamar (sem sessao), por isso
// entra sempre PENDING (nunca ACTIVE direto), esperando aprovacao de um ADMIN.
//
// WhatsApp (phone) obrigatorio (ajuste de produto, Tarefa "Ajustes Visuais e
// Operacionais" secao 3) - deixou de ser so um dado de contato opcional e virou
// insumo funcional: e o numero usado para montar o link de negociacao de horario
// entre professores (ver reservations.controller.ts negotiateContact). Sem
// WhatsApp cadastrado, um professor nunca poderia ser contatado por um colega.
export const professorSignupSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8, "Informe um WhatsApp valido, com DDD."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
});

export const rejectProfessorSchema = z.object({
  motivo: z.string().trim().min(1).optional(),
});
