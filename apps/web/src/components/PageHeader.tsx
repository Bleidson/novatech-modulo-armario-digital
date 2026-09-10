import { ThemeToggle } from "./ThemeToggle";

// Barra fina no topo de toda pagina do modulo (Tarefa "Ajustes Visuais e
// Operacionais" secao 5) - hoje so hospeda o interruptor de tema. Deliberadamente
// minima: nada de breadcrumb/busca/avatar aqui, o escopo desta tarefa e so o
// toggle, nao um redesenho do cabecalho.
export function PageHeader() {
  return (
    <header className="page-header">
      <ThemeToggle compact />
    </header>
  );
}
