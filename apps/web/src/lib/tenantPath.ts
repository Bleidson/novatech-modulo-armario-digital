import { useParams } from "react-router-dom";

// Estrutura de dominio por path (13/09/2026): todo link/navigate interno
// precisa continuar DENTRO do prefixo "/{slug}/..." - usar isto em vez de
// strings absolutas tipo "/admin" (que perderiam o slug e cairiam na raiz).
export function useTenantPath() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  return (path: string) => `/${tenantSlug}${path.startsWith("/") ? path : `/${path}`}`;
}
