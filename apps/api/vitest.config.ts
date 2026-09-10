import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setupEnv.ts"],
    // Integracao usa um banco Postgres real compartilhado entre arquivos - execucao
    // paralela entre arquivos causaria condicao de corrida sobre as mesmas tabelas.
    // Testes dentro de um arquivo continuam rodando em sequencia normalmente; isto
    // so serializa a execucao entre arquivos.
    fileParallelism: false,
  },
});
