import { Outlet } from "react-router-dom";
import { LayoutDashboard, Package, CalendarClock, UserCheck } from "lucide-react";
import { BottomNav } from "../../components/BottomNav";

// Casa das 4 secoes principais do ADMIN. "Painel", "Materiais" e "Horarios" sao o
// modulo materials/classPeriods; "Aprovacoes" (fila de professor pendente) e a UI da
// Foundation.
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
