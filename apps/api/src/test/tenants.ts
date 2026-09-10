// Tenants usados pela suite. Os mesmos UUIDs de lib/tenants.dev.json - os testes de
// HTTP resolvem o tenant pelo header Host que o supertest manda.
//
// Existem DOIS de proposito. Com um unico tenant de teste, um vazamento entre
// escolas e indetectavel: toda consulta "certa" e tambem a unica resposta possivel,
// e um bug de isolamento passa verde. Ver tenantIsolation.test.ts.
export const TENANT_A = "11111111-1111-1111-1111-111111111111";
export const TENANT_B = "22222222-2222-2222-2222-222222222222";

// Hosts que o middleware resolveTenant mapeia para cada um (lib/tenants.dev.json).
export const HOST_A = "ceti.localhost";
export const HOST_B = "escolab.localhost";
