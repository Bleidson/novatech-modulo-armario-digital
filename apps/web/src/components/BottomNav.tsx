import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

export interface BottomNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

// Navegacao inferior FIXA - decisao de produto do briefing visual: nunca menu
// hamburguer. E o unico jeito de navegar entre as secoes principais em telas
// pequenas (o publico e professor de escola usando o celular no corredor entre
// aulas, nao um admin num desktop).
export function BottomNav({ items }: { items: BottomNavItem[] }) {
  return (
    <nav className="bottom-nav" aria-label="Navegacao principal">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className="bottom-nav-item" end>
          <Icon size={22} strokeWidth={2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
