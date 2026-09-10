import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { requireAuth, requireRole } from "../../shared/middlewares/auth.js";
import { AppError } from "../../shared/errors/AppError.js";
import { UPLOADS_ROOT } from "../../shared/uploadsDir.js";
import { requireTenantId } from "../../shared/tenantContext.js";
import { logger } from "../../shared/logger.js";

// Upload de imagem no cadastro de material - unico endpoint desta API que recebe
// multipart/form-data (por isso fora do limite de 200kb do express.json em app.ts).
// Vale so para ADMIN, mesma regra de acesso do cadastro de materiais. Mesmo pipeline
// (multer memoria + sharp -> WebP) ja usado pelo modulo Restaurante.
const MATERIALS_SUBDIR = "materials";

// Arquivo enviado tambem e dado de tenant. RLS protege as LINHAS do banco, nao os
// arquivos em disco - sem separar por escola, as imagens de todos os clientes
// cairiam na mesma pasta publica, servida em /uploads. Exportada (sem o mkdir) para
// o offboarding apagar a pasta do tenant sem precisar recriar o caminho na mao.
export function materialsUploadPathFor(tenantId: string): string {
  return path.join(UPLOADS_ROOT, MATERIALS_SUBDIR, tenantId);
}

function materialsDirFor(tenantId: string): string {
  const dir = materialsUploadPathFor(tenantId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

// Maior lado da imagem depois do processamento - foto de material aparece no maximo
// em cartoes pequenos no catalogo, 1600px sobra folga ate para tela retina.
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 82;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error("Formato de imagem nao suportado. Envie JPEG, PNG ou WEBP."));
      return;
    }
    cb(null, true);
  },
});

export const uploadsRouter = Router();

uploadsRouter.post(
  "/material-image",
  requireAuth,
  requireRole("ADMIN"),
  (req, res, next) => {
    upload.single("image")(req, res, (err: unknown) => {
      if (err) {
        next(AppError.validation(err instanceof Error ? err.message : "Falha no upload da imagem."));
        return;
      }
      next();
    });
  },
  (req, res, next) => {
    void (async () => {
      if (!req.file) {
        next(AppError.validation('Envie o arquivo no campo "image".'));
        return;
      }

      const tenantId = requireTenantId();
      const filename = `${randomUUID()}.webp`;
      const destination = path.join(materialsDirFor(tenantId), filename);

      try {
        const { width, height } = await sharp(req.file.buffer)
          .rotate()
          .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
          .webp({ quality: WEBP_QUALITY, alphaQuality: 100 })
          .toFile(destination);

        logger.info(
          { tenantId, filename, width, height, originalBytes: req.file.size },
          "UPLOAD_IMAGE_CONVERTED",
        );

        res.status(201).json({
          success: true,
          data: { url: `/uploads/${MATERIALS_SUBDIR}/${tenantId}/${filename}` },
        });
      } catch (err) {
        logger.warn({ err, tenantId }, "UPLOAD_IMAGE_DECODE_FAILED");
        next(AppError.validation("Nao foi possivel ler esta imagem. Envie um JPEG, PNG ou WEBP valido."));
      }
    })();
  },
);
