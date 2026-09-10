import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3401),
  APP_URL: z.string().url(),
  // Producao: front e API em subdominios separados - sem isto, os cookies de
  // sessao/CSRF ficam host-only e o JS do front nunca consegue ler pdp_csrf via
  // document.cookie pra ecoar no header X-CSRF-Token (mesmo padrao do Restaurante).
  // Em desenvolvimento fica indefinido (ambos em localhost, nao precisa).
  COOKIE_DOMAIN: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  DATABASE_MIGRATION_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  // Imagem de material enviada pelo painel admin - diretorio local (relativo a
  // localizacao do proprio modulo, nao ao cwd do processo, ver shared/uploadsDir.ts).
  UPLOADS_DIR: z.string().default("uploads"),
  // Token compartilhado servidor-a-servidor com a Core: autentica as rotas internas
  // (POST /internal/offboard, /internal/maintenance, GET /internal/setup-schema,
  // POST /internal/setup). Mesmo valor configurado do lado da Core.
  CORE_INTERNAL_TOKEN: z.string().min(16),
  // Endereco da Core real (HttpCoreClient, lib/core-client.ts). Ausente -> continua
  // MockCoreClient, exatamente como no Restaurante.
  //
  // preprocess trata "" como ausente, nao so "chave nunca definida" - docker
  // compose SEMPRE define a chave no container quando ela aparece no bloco
  // "environment", mesmo se a variavel de origem (.env.production) estiver
  // vazia ou nao setada (vira string vazia, nunca "undefined" de verdade).
  // Sem isto, rodar em modo local (Mock, sem Core real ainda) faz o processo
  // recusar subir com CORE_API_URL="" falhando .url() - bug real encontrado
  // montando o deploy de producao, nunca aparece em dev (onde a chave
  // simplesmente nao existe no .env).
  CORE_API_URL: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),
  CORE_CLIENT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  CORE_MOCK_TENANTS_FILE: z.string().optional(),
  // Cache de resolucao de tenant do HttpCoreClient - so conecta de fato quando
  // CORE_API_URL esta definido (MockCoreClient nunca usa Redis).
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  CORE_TENANT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variaveis de ambiente invalidas ou ausentes:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Configuracao de ambiente invalida - verifique o .env (ver .env.example)");
}

export const env = parsed.data;
