export interface MaintenanceResult {
  tenantId: string;
}

// Chamado por POST /internal/maintenance (Core, servidor-a-servidor), tenant por
// tenant. Este modulo nao tem, nesta primeira versao, nenhuma rotina de manutencao
// periodica por tenant (sem log tecnico com retencao, como o Restaurante tem) - o
// endpoint existe para manter o mesmo contrato servidor-a-servidor da plataforma
// (a Core chama o mesmo caminho para qualquer modulo) e fica pronto para receber
// uma rotina futura sem precisar de uma nova rota.
export async function runMaintenanceForTenant(tenantId: string): Promise<MaintenanceResult> {
  return { tenantId };
}
