import { describe, expect, it } from "vitest";
import { pasosHechos, quienEntra } from "./portal-etapas";

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

describe("quienEntra", () => {
  it("dice quién visita el edificio", () => {
    expect(quienEntra("PENDIENTE", "NO_PROGRAMADA")).toMatch(/verificador/);
    expect(quienEntra("EN_ALMACEN", "PROGRAMADA")).toMatch(/Moretti/);
    expect(quienEntra("EN_PRODUCCION", "NO_PROGRAMADA")).toBeNull();
  });
});
