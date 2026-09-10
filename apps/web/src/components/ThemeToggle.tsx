import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme";

// Interruptor de tema - mesmo padrao do modulo Restaurante (components/ThemeToggle.tsx).
// <button role="switch"> e nao <input type="checkbox">: liga/desliga algo na hora,
// nao e campo de formulario - aria-checked anuncia "ativado/desativado" pro leitor
// de tela, que e o comportamento real.
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Mudar para tema claro" : "Mudar para tema escuro";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={label}
      title={label}
      onClick={toggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        flex: "none",
        width: compact ? 44 : 52,
        height: compact ? 24 : 28,
        padding: 3,
        cursor: "pointer",
        borderRadius: 999,
        border: "1px solid var(--color-divider)",
        background: "color-mix(in srgb, currentColor 10%, transparent)",
        color: "inherit",
        transition: "background .15s ease",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "grid",
          placeItems: "center",
          width: compact ? 18 : 21,
          height: compact ? 18 : 21,
          borderRadius: "50%",
          background: "var(--color-accent)",
          color: "#fff",
          transform: isDark ? `translateX(${compact ? 20 : 24}px)` : "translateX(0)",
          transition: "transform .18s cubic-bezier(.4,0,.2,1)",
        }}
      >
        {isDark ? <Moon size={compact ? 11 : 13} /> : <Sun size={compact ? 11 : 13} />}
      </span>
    </button>
  );
}
