-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'MORETTI', 'VERIFICADOR', 'DESARROLLADOR', 'COMPRADOR');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "contrasenaHash" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "compradorId" TEXT,
    "desarrolladorId" TEXT,
    "invitacionHash" TEXT,
    "invitacionVence" TIMESTAMP(3),
    "ultimoAcceso" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "Usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_invitacionHash_key" ON "Usuario"("invitacionHash");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_compradorId_fkey" FOREIGN KEY ("compradorId") REFERENCES "Comprador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_desarrolladorId_fkey" FOREIGN KEY ("desarrolladorId") REFERENCES "Desarrollador"("id") ON DELETE SET NULL ON UPDATE CASCADE;
