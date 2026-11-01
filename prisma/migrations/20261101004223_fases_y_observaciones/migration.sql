-- CreateEnum
CREATE TYPE "Fase" AS ENUM ('MEDICION', 'REVISION_PEDIDO', 'PEDIDO', 'LLEGADA_PEDIDO', 'INSTALACION', 'REVISION_INSTALACION');

-- CreateTable
CREATE TABLE "FaseUnidad" (
    "id" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "fase" "Fase" NOT NULL,
    "fechaEstimada" TIMESTAMP(3),
    "cumplidaEn" TIMESTAMP(3),
    "cumplidaPor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaseUnidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservacionUnidad" (
    "id" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "fase" "Fase",
    "texto" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservacionUnidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FaseUnidad_fechaEstimada_idx" ON "FaseUnidad"("fechaEstimada");

-- CreateIndex
CREATE UNIQUE INDEX "FaseUnidad_unidadId_fase_key" ON "FaseUnidad"("unidadId", "fase");

-- CreateIndex
CREATE INDEX "ObservacionUnidad_unidadId_createdAt_idx" ON "ObservacionUnidad"("unidadId", "createdAt");

-- AddForeignKey
ALTER TABLE "FaseUnidad" ADD CONSTRAINT "FaseUnidad_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "Unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservacionUnidad" ADD CONSTRAINT "ObservacionUnidad_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "Unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
