import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { useTenantPath } from "../lib/tenantPath";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Coordenação",
  PROFESSOR: "Professor",
};

// Header do modulo - substitui o antigo PageHeader (so tinha o toggle de tema
// "solto"). Junta logo da escola, marca do produto, tema e logout num unico
// lugar organizado, sempre no topo (Tarefa de ajuste: "header mais organizado
// ... o checkbox ficou isolado ... adicionar botao sair").
export function Header() {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const tenantPath = useTenantPath();

  async function handleLogout() {
    await logout();
    navigate(tenantPath("/login"));
  }

  // A arte da logo foi feita para fundo branco (logo-ceti.png e transparente,
  // mas o desenho em si so "funciona" sobre claro) - no tema escuro ela fica
  // desconexa flutuando sobre o fundo escuro do header. logo-ceti-bg.jpg ja traz
  // o proprio fundo branco embutido; so precisa de raio de borda (o arquivo em
  // si e um retangulo reto) para nao destoar do resto da interface, que nunca
  // usa cantos vivos.
  const isDark = theme === "dark";
  const logoSrc = isDark ? "/logo-ceti-bg.jpg" : "/logo-ceti.png";

  return (
    <header className="site-header">
      <div className="site-header-brand">
        <img
          src={logoSrc}
          alt="CETI Dr. Dionisio Rodrigues Nogueira"
          className={isDark ? "site-header-logo site-header-logo-boxed" : "site-header-logo"}
        />
        <div className="site-header-titles">
          <strong>Armário Digital</strong>
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
