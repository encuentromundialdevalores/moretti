import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { crearPasarelaFalsa } from "@/lib/pasarela/falsa";
import { cobrarAnticipo, darDeAlta } from "./planes";
import { subirFactura } from "./comprobantes";
import { contarNuevos, marcarVistos } from "@/lib/avisos";
import { baseLimpiaConCatalogo, firmarContrato, paquete, unidadLibre } from "@/pruebas/utilidades";

beforeEach(baseLimpiaConCatalogo);

async function vendida(contacto = "81") {
  const unidad = await unidadLibre("DEPA 2R (tipo 717)");
  const { plan } = await darDeAlta({ nombre: "Lucía Garza", contacto, unidadId: unidad.id, paqueteId: (await paquete("casa-lista")).id });
  await firmarContrato(unidad.id);
  await cobrarAnticipo(plan.id, { pasarela: crearPasarelaFalsa() });
  return { unidad, plan };
}
const FOLIO = "6F9619FF-8B86-D011-B42D-00C04FC964FF";
const xml = (uuid: string) => `<cfdi:Comprobante><tfd:TimbreFiscalDigital UUID="${uuid}"/></cfdi:Comprobante>`;
const PDF = new TextEncoder().encode("%PDF-1.4 prueba");

describe("Facturas de Moretti (D-53)", () => {
  it("cada pago nace con su factura de comisión: la comisión más 16 % de IVA", async () => {
    const { plan } = await vendida();
    const pago = await prisma.pago.findFirstOrThrow({ where: { planId: plan.id } });
    const f = await prisma.facturaComision.findUniqueOrThrow({ where: { pagoId: pago.id } });
    const base = Number(pago.montoComision);
    expect(Number(f.base)).toBe(base);
    expect(Number(f.iva)).toBeCloseTo(base * 0.16, 2);
    expect(Number(f.total)).toBeCloseTo(base * 1.16, 2);
    expect(f.estado).toBe("PENDIENTE");
  });

  it("el XML emite la factura; el PDF se sube aparte y se valida", async () => {
    const { plan } = await vendida();
    const c = await prisma.comprobanteFiscal.findFirstOrThrow({ where: { planId: plan.id } });
    await expect(subirFactura({ tipo: "complemento", id: c.id, usuario: "M", pdf: new TextEncoder().encode("hola") })).rejects.toThrow(/no es un PDF/);
    await subirFactura({ tipo: "complemento", id: c.id, usuario: "M", pdf: PDF, pdfNombre: "c.pdf" });
    expect((await prisma.comprobanteFiscal.findUniqueOrThrow({ where: { id: c.id } })).estado).toBe("PENDIENTE");
    await subirFactura({ tipo: "complemento", id: c.id, usuario: "Ana (Moretti)", xml: xml(FOLIO), xmlNombre: "c.xml" });
    const listo = await prisma.comprobanteFiscal.findUniqueOrThrow({ where: { id: c.id } });
    expect(listo).toMatchObject({ estado: "EMITIDO", folioFiscal: FOLIO, pdfNombre: "c.pdf", xmlNombre: "c.xml", subidoPor: "Ana (Moretti)" });
    await expect(subirFactura({ tipo: "complemento", id: c.id, usuario: "M", xml: xml(FOLIO) })).rejects.toThrow(/ya tiene su XML/);

    const fc = await prisma.facturaComision.findFirstOrThrow({ where: { planId: plan.id } });
    await subirFactura({ tipo: "comision", id: fc.id, usuario: "M", xml: xml("11111111-2222-3333-4444-555555555555") });
    expect((await prisma.facturaComision.findUniqueOrThrow({ where: { id: fc.id } })).estado).toBe("EMITIDO");
  });
});

describe("Cuenta del comprador al cobrar el anticipo (D-55)", () => {
  it("con correo se crea sola, sin contraseña, y día uno recibe el aviso", async () => {
    const { plan } = await vendida("Lucia@Correo.MX");
    const u = await prisma.usuario.findUniqueOrThrow({ where: { correo: "lucia@correo.mx" } });
    expect(u).toMatchObject({ rol: "COMPRADOR", compradorId: plan.compradorId, contrasenaHash: null });
    expect(await contarNuevos("admin", "ADMIN")).toBeGreaterThan(0);
    await marcarVistos("admin");
    expect(await contarNuevos("admin", "ADMIN")).toBe(0);
  });

  it("sin correo no se crea, pero se avisa", async () => {
    await vendida("81 1234 5678");
    expect(await prisma.usuario.count()).toBe(0);
    expect((await prisma.aviso.findFirstOrThrow({ where: { paraRol: "ADMIN" } })).texto).toMatch(/no es un correo/);
  });
});
