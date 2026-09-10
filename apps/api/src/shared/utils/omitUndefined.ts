// Remove chaves com valor undefined de um objeto - necessario porque o Prisma trata
// "chave presente com undefined" diferente de "chave ausente" em alguns pontos do
// update() parcial (input de validacao opcional que o zod deixou undefined).
//
// O tipo de retorno exclui `undefined` do VALOR de cada chave (nao so `Partial<T>`,
// que so torna a chave opcional mas ainda tipa o valor como `T[K] | undefined`) -
// com exactOptionalPropertyTypes ligado (tsconfig.json), o input do Prisma
// (CreateInput/UpdateInput gerados) recusa um valor formalmente `| undefined`,
// mesmo que em runtime a chave nunca exista. Sem isto, todo chamador precisa de um
// cast manual (`as Prisma.XCreateInput`) so para compilar - bug real encontrado
// pela Teammate B ao integrar materials/classPeriods; corrigido aqui na fonte em
// vez de espalhar o cast em cada service que usar esta funcao no futuro.
export function omitUndefined<T extends Record<string, unknown>>(
  input: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  const result: { [K in keyof T]?: Exclude<T[K], undefined> } = {};
  for (const key of Object.keys(input) as (keyof T)[]) {
    const value = input[key];
    if (value !== undefined) {
      result[key] = value as Exclude<T[typeof key], undefined>;
    }
  }
  return result;
}
