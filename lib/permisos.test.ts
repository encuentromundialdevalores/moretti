import { describe, expect, it } from "vitest";
import { comoVaParaDesarrollador, inicioDe, puedeMarcarInstalacion, puedeMarcarOperativo, puedeRegistrarActa, puedeVerRuta, PANTALLAS } from "./permisos";

describe("Rutas del portal por perfil (D-48)", () => {
  it("cada perfil abre sólo sus pantallas", () => {
    expect(puedeVerRuta("COMPRADOR", "/portal/comprador/documentos")).toBe(true);
    expect(puedeVerRuta("COMPRADOR", "/portal/moretti")).toBe(false);
    expect(puedeVerRuta("MORETTI", "/portal/moretti/fiscal")).toBe(true);
    expect(puedeVerRuta("MORETTI", "/portal/pissa")).toBe(false);
    expect(puedeVerRuta("DESARROLLADOR", "/portal/verificador")).toBe(false);
    expect(puedeVerRuta("VERIFICADOR", "/portal/verificador/instalaciones")).toBe(true);
  });
  it("un prefijo parecido no cuela («/portal/morettix»)", () => {
    expect(puedeVerRuta("MORETTI", "/portal/morettix")).toBe(false);
  });
  it("día uno no usa el portal: entra al back office", () => {
    expect(inicioDe("ADMIN")).toBe("/admin");
    expect(puedeVerRuta("ADMIN", "/portal/moretti")).toBe(false);
  });
  it("la primera pantalla de cada perfil es su inicio y es suya", () => {
    for (const [rol, ps] of Object.entries(PANTALLAS)) {
      expect(inicioDe(rol as never)).toBe(ps[0].href);
      for (const p of ps) expect(puedeVerRuta(rol as never, p.href)).toBe(true);
    }
  });
});

describe("Qué paso de obra marca cada quien", () => {
  it("Moretti fabrica e instala; no mide ni entrega", () => {
    expect(puedeMarcarOperativo("MORETTI", "EN_PRODUCCION")).toBe(true);
    expect(puedeMarcarOperativo("MORETTI", "LEVANTAMIENTO_HECHO")).toBe(false);
    expect(puedeMarcarInstalacion("MORETTI", "INSTALADA")).toBe(true);
    expect(puedeMarcarInstalacion("MORETTI", "ENTREGADA")).toBe(false);
  });
  it("el verificador mide y recibe; no fabrica ni instala", () => {
    expect(puedeMarcarOperativo("VERIFICADOR", "LEVANTAMIENTO_HECHO")).toBe(true);
    expect(puedeMarcarOperativo("VERIFICADOR", "EN_PRODUCCION")).toBe(false);
    expect(puedeMarcarInstalacion("VERIFICADOR", "ENTREGADA")).toBe(true);
    expect(puedeMarcarInstalacion("VERIFICADOR", "INSTALADA")).toBe(false);
    expect(puedeRegistrarActa("VERIFICADOR")).toBe(true);
    expect(puedeRegistrarActa("MORETTI")).toBe(false);
  });
  it("comprador y PISSA no mueven nada", () => {
    for (const rol of ["COMPRADOR", "DESARROLLADOR"] as const) {
      expect(puedeMarcarOperativo(rol, "EN_PRODUCCION")).toBe(false);
      expect(puedeMarcarInstalacion(rol, "INSTALADA")).toBe(false);
      expect(puedeRegistrarActa(rol)).toBe(false);
    }
  });
});

describe("«Cómo va» para PISSA", () => {
  it("resume sin detalle de fabricación", () => {
    expect(comoVaParaDesarrollador("PENDIENTE", "NO_PROGRAMADA")).toBe("Por arrancar");
    expect(comoVaParaDesarrollador("EN_PRODUCCION", "NO_PROGRAMADA")).toBe("En proceso");
    expect(comoVaParaDesarrollador("EN_ALMACEN", "PROGRAMADA")).toBe("Lista para instalar");
    expect(comoVaParaDesarrollador("EN_ALMACEN", "ENTREGADA")).toBe("Entregada");
  });
});
