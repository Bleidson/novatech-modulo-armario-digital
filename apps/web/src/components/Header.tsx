import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../lib/auth";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Coordenacao",
  PROFESSOR: "Professor",
};

// Header do modulo - substitui o antigo PageHeader (so tinha o toggle de tema
// "solto"). Junta logo da escola, marca do produto, tema e logout num unico
// lugar organizado, sempre no topo (Tarefa de ajuste: "header mais organizado
// ... o checkbox ficou isolado ... adicionar botao sair").
export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="site-header">
      <div className="site-header-brand">
        <img src="/logo-ceti.png" alt="CETI Dr. Dionisio Rodrigues Nogueira" className="site-header-logo" />
        <div className="site-header-titles">
          <strong>Armario Digital</strong>
          <span>CETI Dr. Dionisio Rodrigues Nogueira</span>
        </div>
      </div>

      <div className="site-header-actions">
        <ThemeToggle compact />
        {user && (
          <>
            <span className="site-header-user">
              {user.name}
              <em>{ROLE_LABEL[user.role] ?? user.role}</em>
            </span>
            <button type="button" className="btn btn-secondary" onClick={handleLogout}>
              <LogOut size={15} /> Sair
            </button>
          </>
        )}
      </div>
    </header>
  );
}
