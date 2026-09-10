// O Host chega com porta ("localhost:3401"), as vezes com maiuscula, as vezes como
// IPv6 entre colchetes. Normaliza antes de comparar - sem isto, "Localhost:3401" nao
// casaria com "localhost" e o tenant simplesmente nao seria encontrado. Mesmo padrao
// do modulo Restaurante: normaliza no PONTO DE CHAMADA (shared/middlewares/tenant.ts),
// a Core nao normaliza.
export function normalizeHost(host: string): string {
  const trimmed = host.trim().toLowerCase();
  if (trimmed.startsWith("[")) {
    return trimmed.slice(0, trimmed.indexOf("]") + 1);
  }
  const colon = trimmed.lastIndexOf(":");
  return colon === -1 ? trimmed : trimmed.slice(0, colon);
}
