import { Outlet } from "react-router-dom";
import { LayoutDashboard, Package, CalendarClock, UserCheck } from "lucide-react";
import { BottomNav } from "../../components/BottomNav";

// Casa das 4 secoes principais do ADMIN. "Materiais" e "Horarios" sao
// responsabilidade da Teammate B (materials/classPeriods) - as rotas ja existem
// aqui (App.tsx) apontando para uma pagina placeholder, so trocar o componente
// quando a feature entrar. "Aprovacoes" (fila de professor pendente) e a UI da
// Foundation, ja funcional de ponta a ponta.
const NAV_ITEMS = [
  { to: "/admin", label: "Painel", icon: LayoutDashboard },
  { to: "/admin/materiais", label: "Materiais", icon: Package },
  { to: "/admin/horarios", label: "Horarios", icon: CalendarClock },
  { to: "/admin/aprovacoes", label: "Aprovacoes", icon: UserCheck },
];

export function AdminLayout() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav items={NAV_ITEMS} />
    </div>
  );
}
