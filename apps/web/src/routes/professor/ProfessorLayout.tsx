import { Outlet } from "react-router-dom";
import { Grid2x2, CalendarCheck2, UserCircle } from "lucide-react";
import { BottomNav } from "../../components/BottomNav";

// Casa das secoes do PROFESSOR. "Catalogo" (escolher material+horario+data) e
// "Minhas Reservas" (agenda pessoal + cancelamento) sao responsabilidade da
// Teammate C (reservations) - rotas ja existem aqui, so trocar o componente.
const NAV_ITEMS = [
  { to: "/professor", label: "Catalogo", icon: Grid2x2 },
  { to: "/professor/reservas", label: "Minhas reservas", icon: CalendarCheck2 },
  { to: "/professor/conta", label: "Conta", icon: UserCircle },
];

export function ProfessorLayout() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav items={NAV_ITEMS} />
    </div>
  );
}
