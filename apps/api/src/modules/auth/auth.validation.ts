import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

// Cadastro publico de Professor - qualquer um pode chamar (sem sessao), por isso
// entra sempre PENDING (nunca ACTIVE direto), esperando aprovacao de um ADMIN.
export const professorSignupSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1).optional(),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
});

export const rejectProfessorSchema = z.object({
  motivo: z.string().trim().min(1).optional(),
});
