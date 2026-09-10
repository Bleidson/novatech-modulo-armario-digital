import { createApp } from "./app.js";
import { env } from "./shared/env.js";
import { logger } from "./shared/logger.js";
import { prisma } from "./shared/prisma.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API rodando em ${env.APP_URL}:${env.PORT} (${env.NODE_ENV})`);
});

// Erro de requisicao (JSON malformado, excecao dentro de uma rota) ja e tratado por
// errorHandler.ts sem derrubar o processo - isto aqui cobre o que escapa do pipeline
// do Express. Estado pode estar corrompido nesse ponto, entao a resposta correta e
// logar e sair para um gerenciador de processo reiniciar limpo.
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "UNCAUGHT_EXCEPTION");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "UNHANDLED_REJECTION");
  process.exit(1);
});

async function shutdown(signal: string) {
  logger.info(`Recebido ${signal}, encerrando graciosamente...`);
  server.close(() => logger.info("Servidor HTTP encerrado."));
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
