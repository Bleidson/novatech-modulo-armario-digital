import { fileURLToPath } from "node:url";
import path from "node:path";
import { env } from "./env.js";

// Ancorado na localizacao do proprio modulo, nunca em process.cwd() - sempre resolve
// pra apps/api/uploads, nao importa de onde o processo foi iniciado (mesmo bug real
// ja encontrado e corrigido no modulo Restaurante). rootDir=src/outDir=dist
// (tsconfig.json) espelham a mesma estrutura de pastas, entao "../.." sobe pra
// apps/api/ tanto rodando via tsx (src/) quanto compilado (dist/).
const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const UPLOADS_ROOT = path.isAbsolute(env.UPLOADS_DIR) ? env.UPLOADS_DIR : path.join(API_ROOT, env.UPLOADS_DIR);
