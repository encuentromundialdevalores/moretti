import { describe, expect, it } from "vitest";
import { puedeEditarFase, puedeObservar, vistaFases } from "./fases";

describe("Fases de obra (D-52)", () => {
  it("cada quien edita sólo sus fases; día uno, todas", () => {
    expect(puedeEditarFase("VERIFICADOR", "MEDICION")).toBe(true);
    expect(puedeEditarFase("MORETTI", "MEDICION")).toBe(false);
    expect(puedeEditarFase("MORETTI", "INSTALACION")).toBe(true);
    expect(puedeEditarFase("VERIFICADOR", "PEDIDO")).toBe(false);
    expect(puedeEditarFase("ADMIN", "PEDIDO")).toBe(true);
    expect(puedeEditarFase("COMPRADOR", "MEDICION")).toBe(false);
    expect(puedeObservar("DESARROLLADOR")).toBe(false);
  });

  it("deduce lo cumplido del estado de la unidad y marca la que toca", () => {
    const v = vistaFases([], "EN_PRODUCCION", "NO_PROGRAMADA");
    expect(v.map((f) => f.cumplida)).toEqual([true, true, true, false, false, false]);
    expect(v.find((f) => f.actual)?.fase).toBe("LLEGADA_PEDIDO");
    expect(vistaFases([], "EN_ALMACEN", "ENTREGADA").some((f) => f.actual)).toBe(false);
  });
});
