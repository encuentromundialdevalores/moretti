-- AlterTable
ALTER TABLE "ComprobanteFiscal" ADD COLUMN     "pdf" BYTEA,
ADD COLUMN     "pdfNombre" TEXT,
ADD COLUMN     "subidoPor" TEXT;

-- CreateTable
CREATE TABLE "FacturaComision" (
    "id" TEXT NOT NULL,
    "pagoId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "base" DECIMAL(12,2) NOT NULL,
    "iva" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "fechaCobro" TIMESTAMP(3) NOT NULL,
    "fechaLimite" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoComprobante" NOT NULL DEFAULT 'PENDIENTE',
    "folioFiscal" TEXT,
    "xml" TEXT,
    "xmlNombre" TEXT,
    "pdf" BYTEA,
    "pdfNombre" TEXT,
    "subidoPor" TEXT,
    "emitidoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacturaComision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensajeUnidad" (
    "id" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensajeUnidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aviso" (
    "id" TEXT NOT NULL,
    "paraRol" "Rol" NOT NULL,
    "texto" TEXT NOT NULL,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aviso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvisoVisto" (
    "clave" TEXT NOT NULL,
    "vistoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvisoVisto_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE UNIQUE INDEX "FacturaComision_pagoId_key" ON "FacturaComision"("pagoId");

-- CreateIndex
CREATE INDEX "FacturaComision_estado_fechaLimite_idx" ON "FacturaComision"("estado", "fechaLimite");

-- CreateIndex
CREATE INDEX "MensajeUnidad_unidadId_createdAt_idx" ON "MensajeUnidad"("unidadId", "createdAt");

-- CreateIndex
CREATE INDEX "Aviso_paraRol_createdAt_idx" ON "Aviso"("paraRol", "createdAt");

-- AddForeignKey
ALTER TABLE "FacturaComision" ADD CONSTRAINT "FacturaComision_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensajeUnidad" ADD CONSTRAINT "MensajeUnidad_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "Unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Los pagos que ya existían también llevan su factura de comisión (D-53):
-- la comisión del pago más 16 % de IVA, con la misma fecha límite que su complemento.
INSERT INTO "FacturaComision" ("id", "pagoId", "planId", "base", "iva", "total", "fechaCobro", "fechaLimite")
SELECT 'fc_' || md5(p."id"), p."id", p."planId", p."montoComision",
       round(p."montoComision" * 0.16, 2), p."montoComision" + round(p."montoComision" * 0.16, 2),
       c."fechaCobro", c."fechaLimite"
FROM "Pago" p
JOIN "ComprobanteFiscal" c ON c."pagoId" = p."id";
