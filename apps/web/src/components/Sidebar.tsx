import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

export interface SidebarItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

// Navegacao lateral fixa - troca de padrao com a BottomNav por breakpoint de tela
// (ver index.css, ".sidebar"/".bottom-nav" e o media query em ~1100px), nunca as
// duas juntas. Mesmos itens, mesma logica de rota ativa (NavLink) - so muda a
// disposicao. Referencia visual: .sidebar do prototipo anexado (Tarefa "Ajustes
// Visuais e Operacionais" secao 4).
export function Sidebar({ items }: { items: SidebarItem[] }) {
  return (
    <aside className="sidebar">
      <nav aria-label="Navegacao principal">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className="sidebar-item" end>
            <Icon size={18} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
