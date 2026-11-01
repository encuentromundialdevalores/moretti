import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { crearPasarelaFalsa } from "@/lib/pasarela/falsa";
import { cobrarAnticipo, darDeAlta } from "./planes";
import { cumplirFase, observar, ponerFechaFase } from "./fases";
import { baseLimpiaConCatalogo, firmarContrato, paquete, unidadLibre } from "@/pruebas/utilidades";

beforeEach(baseLimpiaConCatalogo);

async function vendida() {
  const unidad = await unidadLibre("DEPA 2R (tipo 717)");
  const { plan } = await darDeAlta({ nombre: "Lucía", contacto: "81", unidadId: unidad.id, paqueteId: (await paquete("casa-lista")).id });
  await firmarContrato(unidad.id);
  await cobrarAnticipo(plan.id, { pasarela: crearPasarelaFalsa() });
  return unidad;
}

describe("Motor de fases (D-52)", () => {
  it("cumplir la medición mueve la unidad y queda firmada", async () => {
    const u = await vendida();
    await cumplirFase({ unidadId: u.id, fase: "MEDICION", usuario: "Vero (Verificador)" });
    expect((await prisma.unidad.findUniqueOrThrow({ where: { id: u.id } })).estadoOperativo).toBe("LEVANTAMIENTO_HECHO");
    const f = await prisma.faseUnidad.findUniqueOrThrow({ where: { unidadId_fase: { unidadId: u.id, fase: "MEDICION" } } });
    expect(f.cumplidaPor).toBe("Vero (Verificador)");
  });

  it("no se salta fases y el pedido pide la unidad liquidada", async () => {
    const u = await vendida();
    await expect(cumplirFase({ unidadId: u.id, fase: "REVISION_PEDIDO", usuario: "x" })).rejects.toThrow(/Primero tiene que cumplirse «Medición»/);
    await cumplirFase({ unidadId: u.id, fase: "MEDICION", usuario: "x" });
    // La revisión del pedido pide los acabados elegidos (regla del motor).
    await expect(cumplirFase({ unidadId: u.id, fase: "REVISION_PEDIDO", usuario: "x" })).rejects.toThrow(/elegir el acabado/);
    await prisma.renglonPlan.updateMany({ where: { plan: { comprador: { unidadId: u.id } } }, data: { acabado: "Blanco" } });
    await cumplirFase({ unidadId: u.id, fase: "REVISION_PEDIDO", usuario: "x" });
    await expect(cumplirFase({ unidadId: u.id, fase: "PEDIDO", usuario: "x" })).rejects.toThrow(/Liquidado/);
    expect(await prisma.faseUnidad.findUnique({ where: { unidadId_fase: { unidadId: u.id, fase: "PEDIDO" } } })).toBeNull();
  });

  it("guarda fechas y observaciones con su bitácora", async () => {
    const u = await vendida();
    await ponerFechaFase({ unidadId: u.id, fase: "INSTALACION", fecha: new Date("2026-12-10T12:00:00Z"), usuario: "M (Moretti)" });
    const f = await prisma.faseUnidad.findUniqueOrThrow({ where: { unidadId_fase: { unidadId: u.id, fase: "INSTALACION" } } });
    expect(f.fechaEstimada?.toISOString().slice(0, 10)).toBe("2026-12-10");
    // Sin la pieza producida, la fecha se guarda pero la instalación no se programa todavía.
    expect((await prisma.unidad.findUniqueOrThrow({ where: { id: u.id } })).estadoInstalacion).toBe("NO_PROGRAMADA");
    await expect(observar({ unidadId: u.id, texto: "  ", autor: "V", rol: "VERIFICADOR" })).rejects.toThrow(/Escribe/);
    await observar({ unidadId: u.id, fase: "MEDICION", texto: "Muro 3 cm menos", autor: "Vero", rol: "VERIFICADOR" });
    expect(await prisma.observacionUnidad.count({ where: { unidadId: u.id } })).toBe(1);
  });
});
