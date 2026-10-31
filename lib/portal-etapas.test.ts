import { describe, expect, it } from "vitest";
import { pasosHechos, quienEntra, tareaMoretti } from "./portal-etapas";

describe("pasosHechos", () => {
  it("cuenta los cinco pasos de la unidad", () => {
    expect(pasosHechos("PENDIENTE", "NO_PROGRAMADA")).toBe(0);
    expect(pasosHechos("LEVANTAMIENTO_HECHO", "NO_PROGRAMADA")).toBe(1);
    expect(pasosHechos("EN_PRODUCCION", "NO_PROGRAMADA")).toBe(2);
    expect(pasosHechos("EN_ALMACEN", "PROGRAMADA")).toBe(3);
    expect(pasosHechos("EN_ALMACEN", "INSTALADA")).toBe(4);
    expect(pasosHechos("EN_ALMACEN", "ENTREGADA")).toBe(5);
  });
});

describe("tareaMoretti", () => {
  it("no ofrece producir sin liquidar", () => {
    expect(tareaMoretti("ACABADOS_ELEGIDOS", "NO_PROGRAMADA", "AL_CORRIENTE")).toMatchObject({ tipo: "esperar" });
    expect(tareaMoretti("ACABADOS_ELEGIDOS", "NO_PROGRAMADA", "LIQUIDADO")).toMatchObject({ tipo: "hacer", hacia: "EN_PRODUCCION" });
  });
  it("pausa una unidad suspendida", () => {
    expect(tareaMoretti("EN_PRODUCCION", "NO_PROGRAMADA", "SUSPENDIDO")).toMatchObject({ tipo: "esperar" });
  });
  it("le toca instalar lo programado y nada más después", () => {
    expect(tareaMoretti("EN_ALMACEN", "PROGRAMADA", "LIQUIDADO")).toMatchObject({ tipo: "hacer", hacia: "INSTALADA" });
    expect(tareaMoretti("EN_ALMACEN", "INSTALADA", "LIQUIDADO")).toMatchObject({ tipo: "esperar" });
    expect(tareaMoretti("EN_ALMACEN", "ENTREGADA", "LIQUIDADO")).toEqual({ tipo: "lista" });
  });
});

describe("quienEntra", () => {
  it("dice quién visita el edificio", () => {
    expect(quienEntra("PENDIENTE", "NO_PROGRAMADA")).toMatch(/verificador/);
    expect(quienEntra("EN_ALMACEN", "PROGRAMADA")).toMatch(/Moretti/);
    expect(quienEntra("EN_PRODUCCION", "NO_PROGRAMADA")).toBeNull();
  });
});
