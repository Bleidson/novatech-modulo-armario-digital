// Tenants usados pela suite. Os mesmos UUIDs/slugs de lib/tenants.dev.json - os
// testes de HTTP resolvem o tenant pelo PRIMEIRO SEGMENTO DO PATH (estrutura de
// dominio por path, decisao de 13/09/2026 - nunca mais Host).
//
// Existem DOIS de proposito. Com um unico tenant de teste, um vazamento entre
// escolas e indetectavel: toda consulta "certa" e tambem a unica resposta possivel,
// e um bug de isolamento passa verde. Ver tenantIsolation.test.ts.
export const TENANT_A = "11111111-1111-1111-1111-111111111111";
export const TENANT_B = "22222222-2222-2222-2222-222222222222";

export const SLUG_A = "ceti";
export const SLUG_B = "escolab";
