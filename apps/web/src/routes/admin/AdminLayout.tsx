import { Outlet } from "react-router-dom";
import { LayoutDashboard, Package, CalendarClock, UserCheck } from "lucide-react";
import { BottomNav } from "../../components/BottomNav";
import { Sidebar } from "../../components/Sidebar";
import { Header } from "../../components/Header";

// Casa das 4 secoes principais do ADMIN. "Painel", "Materiais" e "Horarios" sao o
// modulo materials/classPeriods; "Aprovacoes" (fila de professor pendente) e a UI da
// Foundation.
const NAV_ITEMS = [
  { to: "/admin", label: "Painel", icon: LayoutDashboard },
  { to: "/admin/materiais", label: "Materiais", icon: Package },
  { to: "/admin/horarios", label: "Horarios", icon: CalendarClock },
  { to: "/admin/aprovacoes", label: "Aprovacoes", icon: UserCheck },
];

// Abaixo do breakpoint (ver index.css, ~1100px): BottomNav fixa embaixo, sem
// Sidebar. Acima: Sidebar fixa a esquerda, sem BottomNav. As duas SEMPRE sao
// renderizadas - e o CSS (nao JS) que decide qual aparece, sem listener de
// resize nem duplicacao de logica de rota ativa (Tarefa secao 4).
export function AdminLayout() {
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
