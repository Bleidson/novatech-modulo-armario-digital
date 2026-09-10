// Marcador de secao ainda nao construida pela Foundation - troque pelo componente
// real quando a feature (Teammate B: materiais/horarios; Teammate C:
// catalogo/reservas) entrar. Mantido simples de proposito: so confirma que a rota,
// o layout e a navegacao inferior ja funcionam.
export function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1>{title}</h1>
      <p className="text-muted">Esta secao ainda vai ser construida.</p>
    </div>
  );
}
