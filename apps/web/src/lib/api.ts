// Cliente HTTP fino para a API (apps/api). Desembrulha o envelope
// { success, data } / { success:false, error } que todo endpoint usa, injeta o
// header CSRF em requisicoes mutantes (double-submit cookie). Mesmo padrao do
// modulo Restaurante (apps/web/src/lib/api.ts).
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

export function resolveUploadUrl(url: string | null | undefined): string | null {
  return url ? `${API_BASE_URL}${url}` : null;
}

// Estrutura de dominio por path (decisao de 13/09/2026): o front vive em
// "ntarmario.nthub.online/{slug}/..." - o slug e sempre o PRIMEIRO SEGMENTO
// da URL, o mesmo :tenantSlug que a API espera em "/api/v1/:tenantSlug/...".
// Nao ha Provider/contexto pra isto de proposito: e um dado do proprio
// navegador (window.location), nao um estado de aplicacao.
function currentTenantSlug(): string {
  return window.location.pathname.split("/")[1] ?? "";
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

type QueryValue = string | number | boolean | undefined | null;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function buildQueryString(query?: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

interface Envelope {
  success: boolean;
  data?: unknown;
  error?: ApiErrorBody;
}

async function raw(path: string, options: RequestOptions = {}): Promise<Envelope | null> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};
  let body: string | undefined;

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  if (MUTATING_METHODS.has(method)) {
    const csrf = readCookie("pdp_csrf");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/${currentTenantSlug()}${path}${buildQueryString(options.query)}`, {
    method,
    credentials: "include",
    headers,
    body,
  });

  if (res.status === 204) return null;

  const json = (await res.json().catch(() => null)) as Envelope | null;

  if (!res.ok) {
    const errorBody = json?.error ?? { code: "UNKNOWN_ERROR", message: "Erro inesperado. Tente novamente." };
    throw new ApiError(res.status, errorBody);
  }

  return json;
}

async function get<T>(path: string, query?: RequestOptions["query"]): Promise<T> {
  const envelope = await raw(path, { method: "GET", query });
  return envelope?.data as T;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const envelope = await raw(path, { method: "POST", body });
  return envelope?.data as T;
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  const envelope = await raw(path, { method: "PATCH", body });
  return envelope?.data as T;
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const envelope = await raw(path, { method: "PUT", body });
  return envelope?.data as T;
}

async function del<T>(path: string, body?: unknown): Promise<T> {
  const envelope = await raw(path, { method: "DELETE", body });
  return envelope?.data as T;
}

// Upload de imagem de material (multipart/form-data) - unico endpoint da API que nao
// manda JSON, por isso fora do helper `raw` acima (que sempre serializa o body em
// JSON). Mesma regra de CSRF (double-submit cookie) das outras mutacoes.
export async function uploadMaterialImage(file: File): Promise<{ url: string }> {
  const csrf = readCookie("pdp_csrf");
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch(`${API_BASE_URL}/api/v1/${currentTenantSlug()}/uploads/material-image`, {
    method: "POST",
    credentials: "include",
    headers: csrf ? { "X-CSRF-Token": csrf } : {},
    body: formData,
  });

  const json = (await res.json().catch(() => null)) as Envelope | null;

  if (!res.ok) {
    const errorBody = json?.error ?? { code: "UNKNOWN_ERROR", message: "Não foi possível enviar a imagem." };
    throw new ApiError(res.status, errorBody);
  }

  return json?.data as { url: string };
}

export const api = { get, post, put, patch, delete: del };
