import type { TenantInfo } from "../lib/core-client.js";
import type { Role } from "@prisma/client";

// Aumenta os tipos do Express com os campos que os middlewares desta API preenchem -
// mesmo padrao do modulo Restaurante (resolveTenant preenche req.tenant,
// requireAuth/requireRole preenchem req.user).
declare global {
  namespace Express {
    interface Request {
      tenant?: TenantInfo;
      user?: { id: string; name: string; email: string; role: Role };
    }
  }
}
