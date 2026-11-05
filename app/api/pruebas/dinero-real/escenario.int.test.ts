import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { cobrarAnticipo, darDeAlta } from "@/lib/motor/planes";
import { cobrarVencidas } from "@/lib/motor/barrido";
import { crearPasarelaFalsa } from "@/lib/pasarela/falsa";
import { baseLimpiaConCatalogo, firmarContrato, paquete, unidadLibre } from "@/pruebas/utilidades";
import { leerEscenario, prepararEscenario, vencerSiguiente } from "./escenario";

const DIA = 24 * 60 * 60 * 1000;

beforeEach(baseLimpiaConCatalogo);

describe("escenario de la prueba con dinero real (D-56)", () => {
  it("arma seis planes con contrato y cobros del mínimo de Stripe; el motor calcula los montos", async () => {
    const e = await prepararEscenario({ cuentaConectada: "acct_prueba", comision: 0.15 });

    expect(e.planes.map((p) => p.letra).sort()).toEqual(["A", "B", "C", "D", "E", "F"]);
    const montos = (letra: string) => e.planes.find((p) => p.letra === letra)!.exhibiciones.map((x) => x.monto);
    expect(montos("A")).toEqual([10, ...Array(12).fill(10)]);
    expect(montos("D")[0]).toBe(9);
    expect(montos("E")[0]).toBe(304);
    expect(e.planes.every((p) => p.estado === "COTIZADO")).toBe(true);
    expect(await prisma.contrato.count()).toBe(6);
    expect(e.proyecto).toMatchObject({ cuentaConectada: "acct_prueba", comision: 0.15 });
  });

  it("prepararlo otra vez no duplica nada y actualiza la cuenta y la comisión", async () => {
    await prepararEscenario({ cuentaConectada: "acct_uno", comision: 0.15 });
    const e = await prepararEscenario({ cuentaConectada: "acct_dos", comision: 0.1 });
    expect(e.planes).toHaveLength(6);
    expect(await prisma.proyecto.count({ where: { nombre: "Prueba real" } })).toBe(1);
    expect(e.proyecto).toMatchObject({ cuentaConectada: "acct_dos", comision: 0.1 });
  });

  it("vencer y barrer sólo tocan el proyecto de prueba", async () => {
    const pasarela = crearPasarelaFalsa();

    // Un plan de la demo con su mensualidad 1 vencida: el barrido de la prueba no lo debe cobrar.
    const unidad = await unidadLibre("DEPA 2R (tipo 717)");
    const { plan: ajeno } = await darDeAlta({ nombre: "Ajeno", contacto: "81", unidadId: unidad.id, paqueteId: (await paquete("confort")).id });
    await firmarContrato(unidad.id);
    await cobrarAnticipo(ajeno.id, { pasarela });
    await prisma.exhibicion.updateMany({ where: { planId: ajeno.id, numero: 1 }, data: { fechaProgramada: new Date(Date.now() - DIA) } });
    await expect(vencerSiguiente(ajeno.id)).rejects.toThrow(/Prueba real/);

    const e = await prepararEscenario({ cuentaConectada: "acct_prueba", comision: 0.15 });
    const a = e.planes.find((p) => p.letra === "A")!;
    await cobrarAnticipo(a.id, { pasarela });
    expect(await vencerSiguiente(a.id)).toEqual({ numero: 1, monto: 10 });

    const r = await cobrarVencidas({ pasarela, proyectoId: e.proyecto.id });
    expect(r).toMatchObject({ revisadas: 1, cobradas: 1 });
    const despues = await leerEscenario();
    expect(despues!.planes.find((p) => p.letra === "A")!.exhibiciones[1].estado).toBe("PAGADA");
    const m1Ajena = await prisma.exhibicion.findFirstOrThrow({ where: { planId: ajeno.id, numero: 1 } });
    expect(m1Ajena.estado).not.toBe("PAGADA");
    expect(despues!.eventos.some((x) => x.tipo === "prueba_fecha_adelantada")).toBe(true);
  });
});
