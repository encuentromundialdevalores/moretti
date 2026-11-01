/**
 * Lo que lee cada perfil del portal (D-48). Cada consulta pide sólo los
 * campos que ese perfil puede ver (`select`, no `include`): así un precio, la
 * comisión o un dato del comprador no llegan ni por accidente a la página.
 *
 * - Moretti: unidades vendidas, su etapa y si el plan va pagado (estado, no
 *   montos), y sus pendientes fiscales (con el monto: es lo que factura).
 *   Nunca la comisión del canal.
 * - Verificador: unidades, partidas y acabados. Sin pagos, precios ni contrato.
 * - PISSA: sus unidades con paquete y cómo van. Sin precios ni comprador.
 * - Comprador: su plan, su unidad y sus papeles. Sólo los suyos.
 */

import { EstadoComprobante, EstadoExhibicion, EstadoPlan } from "@prisma/client";
import { prisma } from "./prisma";

/** Un plan cuenta como venta cuando ya se pagó el anticipo. */
const VENDIDO = [EstadoPlan.ACTIVO, EstadoPlan.SUSPENDIDO, EstadoPlan.LIQUIDADO];

const unidadVendida = { comprador: { planes: { some: { estado: { in: VENDIDO } } } } };

const datosUnidad = {
  id: true,
  torre: true,
  numero: true,
  estadoOperativo: true,
  estadoInstalacion: true,
  proyecto: { select: { nombre: true } },
} as const;

const paqueteVendido = {
  planes: { where: { estado: { in: VENDIDO } }, select: { estado: true, paquete: { select: { nombre: true } } }, take: 1 },
} as const;

export async function unidadesParaMoretti() {
  return prisma.unidad.findMany({
    where: unidadVendida,
    select: { ...datosUnidad, estadoFinanciero: true, comprador: { select: paqueteVendido } },
    orderBy: [{ proyecto: { nombre: "asc" } }, { torre: "asc" }, { numero: "asc" }],
  });
}

export async function comprobantesParaMoretti() {
  return prisma.comprobanteFiscal.findMany({
    where: { estado: EstadoComprobante.PENDIENTE },
    select: {
      id: true,
      monto: true,
      fechaCobro: true,
      fechaLimite: true,
      pago: {
        select: {
          exhibicion: { select: { numero: true, tipo: true } },
          plan: { select: { comprador: { select: { unidad: { select: { torre: true, numero: true } } } } } },
        },
      },
    },
    orderBy: [{ fechaLimite: "asc" }, { fechaCobro: "asc" }],
  });
}

export async function unidadesParaVerificador() {
  return prisma.unidad.findMany({
    where: unidadVendida,
    select: {
      ...datosUnidad,
      actaEntrega: { select: { fechaFirma: true, quienFirmo: true } },
      comprador: {
        select: {
          planes: {
            where: { estado: { in: VENDIDO } },
            take: 1,
            select: {
              paquete: { select: { nombre: true } },
              renglones: { select: { cantidad: true, acabado: true, partida: { select: { nombre: true } } }, orderBy: { partida: { orden: "asc" } } },
            },
          },
        },
      },
    },
    orderBy: [{ proyecto: { nombre: "asc" } }, { torre: "asc" }, { numero: "asc" }],
  });
}

export async function unidadesParaDesarrollador(desarrolladorId: string) {
  return prisma.unidad.findMany({
    where: { ...unidadVendida, proyecto: { desarrolladorId } },
    select: { ...datosUnidad, comprador: { select: paqueteVendido } },
    orderBy: [{ proyecto: { nombre: "asc" } }, { torre: "asc" }, { numero: "asc" }],
  });
}

/** El plan vigente del comprador y su calendario, sin versiones reemplazadas. */
export async function planDelComprador(compradorId: string) {
  return prisma.comprador.findUnique({
    where: { id: compradorId },
    select: {
      nombre: true,
      folio: true,
      tarjetaDescripcion: true,
      unidad: {
        select: {
          ...datosUnidad,
          contrato: { select: { fechaFirma: true, archivoNombre: true } },
          actaEntrega: { select: { fechaFirma: true, archivoNombre: true } },
        },
      },
      planes: {
        where: { estado: { not: EstadoPlan.CANCELADO } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          estado: true,
          montoCongelado: true,
          saldo: true,
          paquete: { select: { nombre: true } },
          exhibiciones: {
            where: { estado: { notIn: [EstadoExhibicion.REEMPLAZADA, EstadoExhibicion.CANCELADA] } },
            select: { id: true, numero: true, tipo: true, fechaProgramada: true, monto: true, estado: true },
            orderBy: [{ fechaProgramada: "asc" }, { numero: "asc" }],
          },
          renglones: {
            select: { cantidad: true, acabado: true, partida: { select: { nombre: true, familia: true } } },
            orderBy: { partida: { orden: "asc" } },
          },
        },
      },
    },
  });
}

/** Comprobantes del plan del comprador (folio emitido o pendiente). */
export async function comprobantesDelPlan(planId: string) {
  return prisma.comprobanteFiscal.findMany({
    where: { planId },
    select: { id: true, monto: true, fechaCobro: true, estado: true, folioFiscal: true, xmlNombre: true },
    orderBy: { fechaCobro: "asc" },
  });
}

/**
 * Todo lo de una unidad vendida para el pop-up de Moretti, el verificador y
 * día uno: paquete, fases, observaciones y los documentos de ese cliente.
 * Sin montos del plan ni comisión.
 */
export async function detalleUnidad(unidadId: string) {
  return prisma.unidad.findFirst({
    where: { id: unidadId, ...unidadVendida },
    select: {
      ...datosUnidad,
      estadoFinanciero: true,
      prototipo: { select: { clave: true, recamaras: true, superficie: true } },
      contrato: { select: { fechaFirma: true, archivoNombre: true, quienFirmo: true } },
      actaEntrega: { select: { fechaFirma: true, archivoNombre: true, quienFirmo: true } },
      fases: { select: { fase: true, fechaEstimada: true, cumplidaEn: true, cumplidaPor: true } },
      observaciones: { select: { id: true, fase: true, texto: true, autor: true, rol: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      comprador: {
        select: {
          nombre: true,
          folio: true,
          planes: {
            where: { estado: { in: VENDIDO } },
            take: 1,
            select: {
              id: true,
              paquete: { select: { nombre: true } },
              renglones: { select: { cantidad: true, acabado: true, partida: { select: { nombre: true } } }, orderBy: { partida: { orden: "asc" } } },
            },
          },
        },
      },
    },
  });
}

/** Comprobantes de un plan para el detalle de la unidad (con o sin XML). */
export async function comprobantesDeUnidad(planId: string) {
  return prisma.comprobanteFiscal.findMany({
    where: { planId },
    select: { id: true, fechaCobro: true, estado: true, folioFiscal: true, xmlNombre: true },
    orderBy: { fechaCobro: "asc" },
  });
}

/** Las fechas de todas las fases en un rango, para el calendario. */
export async function fechasDeFases(desde: Date, hasta: Date) {
  return prisma.faseUnidad.findMany({
    where: { fechaEstimada: { gte: desde, lt: hasta }, unidad: unidadVendida },
    select: { fase: true, fechaEstimada: true, cumplidaEn: true, unidad: { select: { id: true, torre: true, numero: true, proyecto: { select: { nombre: true } } } } },
    orderBy: { fechaEstimada: "asc" },
  });
}

/** Unidades vendidas con sus fases, para las listas de Moretti y el verificador. */
export async function unidadesConFases() {
  return prisma.unidad.findMany({
    where: unidadVendida,
    select: {
      ...datosUnidad,
      estadoFinanciero: true,
      fases: { select: { fase: true, fechaEstimada: true, cumplidaEn: true, cumplidaPor: true } },
      comprador: { select: paqueteVendido },
    },
    orderBy: [{ proyecto: { nombre: "asc" } }, { torre: "asc" }, { numero: "asc" }],
  });
}
