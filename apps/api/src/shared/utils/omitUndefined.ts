// Remove chaves com valor undefined de um objeto - necessario porque o Prisma trata
// "chave presente com undefined" diferente de "chave ausente" em alguns pontos do
// update() parcial (input de validacao opcional que o zod deixou undefined).
export function omitUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(input) as (keyof T)[]) {
    if (input[key] !== undefined) {
      result[key] = input[key];
    }
  }
  return result;
}
