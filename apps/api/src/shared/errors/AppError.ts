export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown;

  constructor(code: string, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  static notFound(message = "Recurso nao encontrado.") {
    return new AppError("RESOURCE_NOT_FOUND", message, 404);
  }

  static unauthorized(message = "Nao autenticado.") {
    return new AppError("AUTH_UNAUTHORIZED", message, 401);
  }

  static forbidden(message = "Sem permissao para esta operacao.") {
    return new AppError("FORBIDDEN", message, 403);
  }

  static validation(message = "Dados invalidos.", details?: unknown) {
    return new AppError("VALIDATION_ERROR", message, 422, details);
  }

  static conflict(message = "Operacao em conflito com o estado atual.") {
    return new AppError("CONFLICT", message, 409);
  }
}
