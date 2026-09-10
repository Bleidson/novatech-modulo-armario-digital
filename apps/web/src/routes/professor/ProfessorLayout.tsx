import { Outlet } from "react-router-dom";
import { Package, CalendarCheck2, UserCircle } from "lucide-react";
import { BottomNav } from "../../components/BottomNav";
import { Sidebar } from "../../components/Sidebar";
import { Header } from "../../components/Header";

// Casa das secoes do PROFESSOR. "Materiais" (vitrine de cards, ver Materials.tsx -
// renomeado de "Catalogo", Tarefa "Ajustes Visuais e Operacionais" secao 1) e
// "Minhas Reservas" (agenda pessoal + cancelamento).
const NAV_ITEMS = [
  { to: "/professor", label: "Materiais", icon: Package },
  { to: "/professor/reservas", label: "Minhas reservas", icon: CalendarCheck2 },
  { to: "/professor/conta", label: "Conta", icon: UserCircle },
];

// Mesmo padrao responsivo do AdminLayout - Sidebar/BottomNav sempre renderizadas,
// o CSS decide qual aparece por breakpoint (index.css).
export function ProfessorLayout() {
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
