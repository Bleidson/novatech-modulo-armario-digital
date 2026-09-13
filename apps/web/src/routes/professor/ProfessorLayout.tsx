import { Outlet } from "react-router-dom";
import { Package, CalendarCheck2, UserCircle } from "lucide-react";
import { BottomNav } from "../../components/BottomNav";
import { Sidebar } from "../../components/Sidebar";
import { Header } from "../../components/Header";
import { useTenantPath } from "../../lib/tenantPath";

// Casa das secoes do PROFESSOR. "Materiais" (vitrine de cards, ver Materials.tsx -
// renomeado de "Catalogo", Tarefa "Ajustes Visuais e Operacionais" secao 1) e
// "Minhas Reservas" (agenda pessoal + cancelamento). Funcao (nao array fixo)
// porque precisa de useTenantPath, um hook - so pode ser chamado no componente.
function navItems(tenantPath: (path: string) => string) {
  return [
    { to: tenantPath("/professor"), label: "Materiais", icon: Package },
    { to: tenantPath("/professor/reservas"), label: "Minhas reservas", icon: CalendarCheck2 },
    { to: tenantPath("/professor/conta"), label: "Conta", icon: UserCircle },
  ];
}

// Mesmo padrao responsivo do AdminLayout - Sidebar/BottomNav sempre renderizadas,
// o CSS decide qual aparece por breakpoint (index.css).
export function ProfessorLayout() {
  const tenantPath = useTenantPath();
  const NAV_ITEMS = navItems(tenantPath);
  return (
    <div className="app-shell">
      <Sidebar items={NAV_ITEMS} />
      <div className="app-content">
        <Header />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      <BottomNav items={NAV_ITEMS} />
    </div>
  );
}
