import { z } from "zod";

// tenantId sempre no CORPO da chamada, nunca inferido de dominio/sessao - quem decide
// qual tenant processar e a Core, o modulo so executa.
export const internalTenantSchema = z.object({
  tenantId: z.string().uuid("tenantId precisa ser um UUID."),
});

// POST /internal/setup - provisionamento inicial de um tenant recem-criado, chamado
// pelo wizard de setup (novatech-site) logo apos POST /api/tenants na Core. Nomes de
// campo batendo EXATAMENTE com os declarados em setupSchema.ts (etapa "grade-horaria").
export const internalSetupSchema = z.object({
  tenantId: z.string().uuid("tenantId precisa ser um UUID."),
  periodos: z.array(z.object({ name: z.string().trim().min(1) })).default([]),
});
