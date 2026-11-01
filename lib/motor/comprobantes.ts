import { uuidDeXml } from "../cfdi";
import { EstadoComprobante, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { ReglaError, mx } from "./errores";
import { fechaLimiteComprobante } from "./fiscal";
import { avisar } from "../avisos";

/**
 * Los pendientes de comprobante fiscal (actividad S, R8). Nacen dentro de la
 * misma transacción que el pago, por cualquiera de los dos caminos de cobro:
 * no puede existir un pago sin su pendiente.
 */

type Tx = Prisma.TransactionClient;

/** Feriados que el SAT agregue a los de ley, «AAAA-MM-DD» separados por coma. */
function feriadosExtra(): string[] {
  return (process.env.FERIADOS_FISCALES ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
}

export async function crearPendienteFiscal(
  tx: Tx,
  pago: { id: string; planId: string; monto: Prisma.Decimal | number; fecha: Date }
) {
  const fechaLimite = fechaLimiteComprobante(pago.fecha, feriadosExtra());
  const comprobante = await tx.comprobanteFiscal.create({
    data: {
      pagoId: pago.id,
      planId: pago.planId,
      monto: pago.monto,
      fechaCobro: pago.fecha,
      fechaLimite,
    },
  });
  await tx.evento.create({
    data: {
      entidadTipo: "plan",
      entidadId: pago.planId,
      tipo: "comprobante_pendiente",
      comentario: `Comprobante fiscal pendiente por ${mx(Number(pago.monto))}: se emite a más tardar el ${fechaLimite.toLocaleDateString("es-MX", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })} (R8).`,
    },
  });
  // D-53: la factura de la comisión (Moretti → día uno) nace con el pago.
  const conComision = await tx.pago.findUniqueOrThrow({ where: { id: pago.id }, select: { montoComision: true, exhibicion: { select: { tipo: true } } } });
  const base = Number(conComision.montoComision);
  const iva = redondear(base * IVA);
  await tx.facturaComision.create({
    data: { pagoId: pago.id, planId: pago.planId, base, iva, total: redondear(base + iva), fechaCobro: pago.fecha, fechaLimite },
  });
  // D-55: con el anticipo cobrado, el comprador ya tiene su cuenta (sin liga: la manda día uno).
  if (conComision.exhibicion.tipo === "ANTICIPO") await crearCuentaDelComprador(tx, pago.planId);
  return comprobante;
}

/** El IVA de la factura de comisión. */
export const IVA = 0.16;
const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * La cuenta de portal del comprador, al cobrarse su anticipo (D-55). Sólo si
 * su contacto es un correo y todavía no tiene cuenta; queda sin contraseña
 * hasta que día uno le mande su liga desde Usuarios.
 */
async function crearCuentaDelComprador(tx: Tx, planId: string) {
  const plan = await tx.plan.findUniqueOrThrow({
    where: { id: planId },
    select: { comprador: { select: { id: true, nombre: true, contacto: true, usuarios: { select: { id: true } }, unidad: { select: { torre: true, numero: true } } } } },
  });
  const c = plan.comprador;
  const correo = c.contacto.trim().toLowerCase();
  const esCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
  const unidad = `${c.unidad.torre} ${c.unidad.numero}`;
  if (c.usuarios.length > 0) return;
  if (!esCorreo || (await tx.usuario.findUnique({ where: { correo } }))) {
    await avisar(tx, ["ADMIN"], `${c.nombre} (${unidad}) pagó su anticipo, pero no se pudo crear su cuenta: ${esCorreo ? "ese correo ya tiene otra cuenta" : "su contacto no es un correo"}. Créala en Usuarios.`);
    return;
  }
  await tx.usuario.create({ data: { correo, nombre: c.nombre, rol: "COMPRADOR", compradorId: c.id } });
  await avisar(tx, ["ADMIN"], `${c.nombre} (${unidad}) pagó su anticipo: su cuenta ya está creada. Mándale su liga desde Usuarios.`);
}

export type TipoFactura = "complemento" | "comision";
const MAX_PDF = 2_000_000;

/**
 * Moretti sube la factura de un pago: el complemento de pago (PPD) para el
 * comprador o la factura de la comisión para día uno (D-53). Puede subir el
 * XML, el PDF o los dos, en el orden que quiera. Con el XML (o el folio a
 * mano) queda emitida; el XML no se cambia después, el PDF sí.
 */
export async function subirFactura(params: {
  tipo: TipoFactura;
  id: string;
  usuario: string;
  folio?: string;
  xml?: string;
  xmlNombre?: string;
  pdf?: Uint8Array;
  pdfNombre?: string;
}) {
  const actual =
    params.tipo === "complemento"
      ? await prisma.comprobanteFiscal.findUnique({ where: { id: params.id } })
      : await prisma.facturaComision.findUnique({ where: { id: params.id } });
  if (!actual) throw new ReglaError("No existe esa factura.");
  if (!params.xml && !params.pdf && !params.folio) throw new ReglaError("Sube el XML, el PDF o escribe el folio.");

  let folio = params.folio?.trim().toUpperCase() || null;
  if (params.xml !== undefined) {
    if (actual.xml) throw new ReglaError("Esta factura ya tiene su XML. Si hay un error, pídele a día uno que lo revise.");
    const delXml = uuidDeXml(params.xml);
    if (!delXml) throw new ReglaError("Ese archivo no trae el timbre fiscal (UUID). ¿Es el XML timbrado?");
    if (folio && folio !== delXml) throw new ReglaError("El folio no coincide con el del XML.");
    if (actual.folioFiscal && actual.folioFiscal !== delXml) throw new ReglaError("Ese XML trae otro folio que el ya registrado para este pago.");
    folio = delXml;
  }
  if (folio && !/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(folio)) {
    throw new ReglaError("El folio fiscal es el UUID del CFDI: 36 caracteres, como 6F9619FF-8B86-D011-B42D-00C04FC964FF.");
  }
  if (folio && actual.folioFiscal && folio !== actual.folioFiscal) throw new ReglaError("Este pago ya tiene otro folio registrado.");
  if (params.pdf) {
    if (params.pdf.byteLength > MAX_PDF) throw new ReglaError("El PDF pesa más de 2 MB.");
    if (new TextDecoder().decode(params.pdf.slice(0, 5)) !== "%PDF-") throw new ReglaError("Ese archivo no es un PDF.");
  }

  const emitir = !!folio && actual.estado === EstadoComprobante.PENDIENTE;
  const data = {
    ...(folio ? { folioFiscal: folio } : {}),
    ...(params.xml !== undefined ? { xml: params.xml, xmlNombre: params.xmlNombre?.slice(0, 120) || `${folio}.xml` } : {}),
    ...(params.pdf ? { pdf: Buffer.from(params.pdf), pdfNombre: params.pdfNombre?.slice(0, 120) || `${folio ?? "factura"}.pdf` } : {}),
    ...(emitir ? { estado: EstadoComprobante.EMITIDO, emitidoEn: new Date() } : {}),
    subidoPor: params.usuario,
  };
  const que = params.tipo === "complemento" ? "Complemento de pago" : "Factura de comisión";
  await prisma.$transaction(async (tx) => {
    if (params.tipo === "complemento") await tx.comprobanteFiscal.update({ where: { id: params.id }, data });
    else await tx.facturaComision.update({ where: { id: params.id }, data });
    await tx.evento.create({
      data: {
        entidadTipo: "plan",
        entidadId: actual.planId,
        tipo: params.tipo === "complemento" ? "comprobante_emitido" : "factura_comision",
        usuario: params.usuario,
        comentario: `${que}${emitir ? " emitido" : " actualizado"}${folio ? `, folio ${folio}` : ""}${params.xml ? " · XML" : ""}${params.pdf ? " · PDF" : ""}.`,
      },
    });
    if (emitir) await avisar(tx, ["ADMIN"], `${params.usuario} subió ${que.toLowerCase()} por ${mx(Number("total" in actual ? actual.total : actual.monto))}.`);
  });
}

/**
 * Cierra el pendiente con el folio fiscal (UUID del CFDI). Si viene el XML,
 * se guarda para que el comprador lo descargue, y su timbre tiene que traer
 * el mismo folio: así no se cuelga el XML de otro cobro.
 */
export async function marcarComprobanteEmitido(params: { id: string; folioFiscal: string; usuario?: string; xml?: string; xmlNombre?: string }) {
  const folio = params.folioFiscal.trim().toUpperCase();
  if (params.xml !== undefined && uuidDeXml(params.xml) !== folio) {
    throw new ReglaError("Ese XML no trae el timbre fiscal con este folio. ¿Es el CFDI de este cobro?");
  }
  if (!/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(folio)) {
    throw new ReglaError("El folio fiscal es el UUID del CFDI: 36 caracteres, como 6F9619FF-8B86-D011-B42D-00C04FC964FF.");
  }
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.comprobanteFiscal.updateMany({
      where: { id: params.id, estado: EstadoComprobante.PENDIENTE },
      data: {
        estado: EstadoComprobante.EMITIDO,
        folioFiscal: folio,
        emitidoEn: new Date(),
        ...(params.xml !== undefined ? { xml: params.xml, xmlNombre: params.xmlNombre?.slice(0, 120) || `${folio}.xml` } : {}),
      },
    });
    if (count === 0) throw new ReglaError("Ese comprobante ya estaba emitido o no existe.");
    const c = await tx.comprobanteFiscal.findUniqueOrThrow({ where: { id: params.id } });
    await tx.evento.create({
      data: {
        entidadTipo: "plan",
        entidadId: c.planId,
        tipo: "comprobante_emitido",
        usuario: params.usuario ?? "back office",
        comentario: `Comprobante fiscal emitido por ${mx(Number(c.monto))}, folio ${folio}${c.xml ? " (con XML)" : ""}.`,
      },
    });
    return c;
  });
}
