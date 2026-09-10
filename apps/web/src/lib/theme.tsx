import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// Tema claro/escuro - mesmo padrao do modulo Restaurante (lib/theme.tsx): escolha
// DO DISPOSITIVO, nao do usuario no banco (o mesmo professor pode preferir escuro
// no celular a noite e claro no computador da sala dos professores de dia).
// localStorage, nada de API.
export type ThemeChoice = "light" | "dark";

const STORAGE_KEY = "armario:theme";

interface ThemeContextValue {
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
}

// Exportada porque o mesmo calculo roda duas vezes: aqui, e no script inline do
// index.html que aplica o tema ANTES da primeira pintura (sem ele, toda navegacao
// comecaria clara e piscaria para escuro depois que o React montasse).
export function readStoredTheme(): ThemeChoice | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function applyToDocument(theme: ThemeChoice): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(
    () => readStoredTheme() ?? (systemPrefersDark() ? "dark" : "light"),
  );

  useEffect(() => {
    applyToDocument(theme);
  }, [theme]);

  useEffect(() => {
    if (readStoredTheme() !== null) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setThemeState(e.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemeChoice) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sem persistencia (modo privativo): vale so para esta sessao.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme precisa estar dentro de <ThemeProvider>.");
  return ctx;
}
