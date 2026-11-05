import { EstadoExhibicion, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { darDeAlta, registrarContrato, ReglaError } from "@/lib/motor/planes";
import { cobrarVencidas } from "@/lib/motor/barrido";

/**
 * El escenario de la prueba con dinero real (docs/sprint-03/prueba-dinero-real.md):
 * un proyecto aparte, «Prueba real», con precios tan bajos que cada cobro es
 * el mínimo de Stripe ($10). Lo que hace esta página (adelantar fechas, correr
 * el barrido) sólo toca ese proyecto: nunca un plan de verdad.
 *
 * Los montos salen del motor, no se escriben a mano:
 * - Prototipo PRUEBA: paquete a $130 y anticipo de 7.69 % → anticipo $10 y
 *   12 mensualidades de $10 (R7: 10 + 12 × 10 = 130).
 * - PRUEBA-MIN: $117 → anticipo $9, debajo del mínimo de Stripe.
 * - PRUEBA-TOPE: $3,950 → anticipo $304, arriba del tope del modo real.
 */

export const NOMBRE_PROYECTO = "Prueba real";
const ANTICIPO = 0.0769;
const PRECIO_LISTA_PARTIDA = 100;

const PROTOTIPOS = [
  { clave: "PRUEBA", precio: 130 },
  { clave: "PRUEBA-MIN", precio: 117 },
  { clave: "PRUEBA-TOPE", precio: 3950 },
] as const;

/** Un plan por escenario. La letra va en el nombre del comprador: así se encuentra. */
export const ESCENARIOS = [
  { letra: "A", prototipo: "PRUEBA", torre: "P", numero: "01", nombre: "Principal: anticipo, mensualidades, reembolsos y Moretti" },
  { letra: "B", prototipo: "PRUEBA", torre: "P", numero: "02", nombre: "3-D Secure" },
  { letra: "C", prototipo: "PRUEBA", torre: "P", numero: "03", nombre: "Captura manual" },
  { letra: "F", prototipo: "PRUEBA", torre: "P", numero: "04", nombre: "Tarjeta: consentimiento y datos mal" },
  { letra: "D", prototipo: "PRUEBA-MIN", torre: "M", numero: "01", nombre: "Debajo del mínimo ($9)" },
  { letra: "E", prototipo: "PRUEBA-TOPE", torre: "T", numero: "01", nombre: "Arriba del tope ($304)" },
] as const;

export type Letra = (typeof ESCENARIOS)[number]["letra"];

const nombreComprador = (letra: string) => `Prueba ${letra}`;

async function proyectoDePrueba() {
  return prisma.proyecto.findFirst({ where: { nombre: NOMBRE_PROYECTO } });
}

/**
 * Crea el proyecto, sus prototipos, precios, unidades y los seis planes con
 * contrato firmado. Si ya existe, sólo actualiza la cuenta de Moretti y la
 * comisión, y da de alta los planes que falten.
 */
export async function prepararEscenario(p: { cuentaConectada: string; comision: number; correo?: string }) {
  const paquete = await prisma.paquete.findFirst({
    where: { esArmable: false, catalogo: { some: {} } },
    orderBy: { nivel: "asc" },
    include: { catalogo: true },
  });
  if (!paquete) {
    throw new ReglaError("La base no tiene paquetes ni partidas. Corre primero `npm run db:seed` en esta base.");
  }
  const partidas = await prisma.partida.findMany();

  let proyecto = await proyectoDePrueba();
  if (proyecto) {
    proyecto = await prisma.proyecto.update({
      where: { id: proyecto.id },
      data: { stripeConnectedAccountId: p.cuentaConectada, porcentajeComision: p.comision },
    });
  } else {
    const desarrollador =
      (await prisma.desarrollador.findFirst({ orderBy: { createdAt: "asc" } })) ??
      (await prisma.desarrollador.create({ data: { nombre: "Prueba" } }));
    proyecto = await prisma.proyecto.create({
      data: {
        desarrolladorId: desarrollador.id,
        nombre: NOMBRE_PROYECTO,
        etapaPipeline: "Prueba",
        numeroUnidades: ESCENARIOS.length,
        porcentajeAnticipo: ANTICIPO,
        porcentajeComision: p.comision,
        minimoPlan: 0,
        stripeConnectedAccountId: p.cuentaConectada,
      },
    });
    for (const proto of PROTOTIPOS) {
      const creado = await prisma.prototipo.create({
        data: { proyectoId: proyecto.id, clave: proto.clave, superficie: 1, recamaras: 0, climasDefault: 1 },
      });
      await prisma.precio.create({ data: { prototipoId: creado.id, paqueteId: paquete.id, monto: proto.precio } });
      // Sólo para repartir el precio del paquete entre sus partidas.
      await prisma.precioPartida.createMany({
        data: partidas.map((x) => ({ prototipoId: creado.id, partidaId: x.id, monto: PRECIO_LISTA_PARTIDA })),
      });
    }
    await prisma.evento.create({
      data: {
        entidadTipo: "proyecto",
        entidadId: proyecto.id,
        tipo: "prueba_dinero_real_preparada",
        comentario: `Proyecto de la prueba con dinero real: cobros de $10, comisión ${(p.comision * 100).toFixed(2)} %, cuenta de Moretti ${p.cuentaConectada}.`,
      },
    });
  }

  const prototipos = await prisma.prototipo.findMany({ where: { proyectoId: proyecto.id } });
  for (const e of ESCENARIOS) {
    const prototipoId = prototipos.find((x) => x.clave === e.prototipo)!.id;
    const unidad =
      (await prisma.unidad.findFirst({
        where: { proyectoId: proyecto.id, torre: e.torre, numero: e.numero },
        include: { comprador: true, contrato: true },
      })) ??
      (await prisma.unidad.create({
        data: { proyectoId: proyecto.id, prototipoId, torre: e.torre, numero: e.numero },
        include: { comprador: true, contrato: true },
      }));
    if (!unidad.comprador) {
      await darDeAlta({
        nombre: nombreComprador(e.letra),
        contacto: p.correo?.includes("@") ? p.correo : "Prueba con dinero real",
        unidadId: unidad.id,
        paqueteId: paquete.id,
      });
    }
    if (!unidad.contrato) {
      await registrarContrato({
        unidadId: unidad.id,
        archivoNombre: `prueba-real-${e.letra}.pdf`,
        quienFirmo: "Prueba con dinero real",
        fechaFirma: new Date(),
      });
    }
  }
  return (await leerEscenario())!;
}

/** Todo lo que la página muestra del escenario, en una sola lectura. */
export async function leerEscenario() {
  const proyecto = await proyectoDePrueba();
  if (!proyecto) return null;

  const planes = await prisma.plan.findMany({
    where: { comprador: { unidad: { proyectoId: proyecto.id } } },
    include: {
      comprador: { include: { unidad: true } },
      exhibiciones: {
        include: { pago: { include: { reembolsos: true, transferencia: true } } },
        orderBy: [{ numero: "asc" }, { version: "asc" }],
      },
    },
    orderBy: { createdAt: "asc" },
  });
  const ids = planes.map((x) => x.id);
  const [eventos, eventosStripe, transferencias] = await Promise.all([
    prisma.evento.findMany({
      where: {
        OR: [
          { entidadTipo: "plan", entidadId: { in: ids } },
          { entidadTipo: "unidad", entidadId: { in: planes.map((x) => x.comprador.unidadId) } },
          { entidadTipo: "proyecto", entidadId: proyecto.id },
        ],
      },
      orderBy: { fecha: "desc" },
      take: 40,
    }),
    prisma.eventoStripe.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.transferenciaMoretti.findMany({ where: { proyectoId: proyecto.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const num = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));
  const planIdDe = new Map(planes.map((x) => [x.comprador.unidadId, x.id]));

  return {
    proyecto: {
      id: proyecto.id,
      cuentaConectada: proyecto.stripeConnectedAccountId,
      comision: Number(proyecto.porcentajeComision),
    },
    planes: planes.map((plan) => {
      const letra = plan.comprador.nombre.replace(/^Prueba /, "");
      return {
        letra,
        nombre: ESCENARIOS.find((e) => e.letra === letra)?.nombre ?? plan.comprador.nombre,
        id: plan.id,
        unidad: `${plan.comprador.unidad.torre}-${plan.comprador.unidad.numero}`,
        estado: plan.estado,
        version: plan.version,
        total: Number(plan.montoCongelado),
        saldo: Number(plan.saldo),
        tarjeta: plan.comprador.stripePaymentMethodId ? (plan.comprador.tarjetaDescripcion ?? "tarjeta") : null,
        tarjetaInvalida: plan.comprador.tarjetaInvalida,
        exhibiciones: plan.exhibiciones.map((e) => ({
          id: e.id,
          numero: e.numero,
          tipo: e.tipo,
          version: e.version,
          monto: Number(e.monto),
          estado: e.estado,
          fecha: e.fechaProgramada.toISOString(),
          intentosRechazados: e.intentosRechazados,
          ultimoCodigoRechazo: e.ultimoCodigoRechazo,
          proximoIntentoEn: e.proximoIntentoEn?.toISOString() ?? null,
          requiereTarjetaNueva: e.requiereTarjetaNueva,
          pendiente: e.referenciaPendiente,
          pago: e.pago && {
            id: e.pago.id,
            referencia: e.pago.referenciaStripe,
            monto: Number(e.pago.monto),
            comision: Number(e.pago.montoComision),
            transferida: e.pago.transferencia?.estado === "ENVIADA" || e.pago.transferencia?.estado === "EN_PROCESO",
            reembolsado: e.pago.reembolsos.reduce((a, r) => a + Number(r.monto), 0),
            reembolsos: e.pago.reembolsos.map((r) => ({
              monto: Number(r.monto),
              origen: r.origen,
              referencia: r.referenciaStripe,
              devolvioComision: r.devolvioComision,
            })),
          },
        })),
      };
    }),
    transferencias: transferencias.map((t) => ({
      id: t.id,
      estado: t.estado,
      bruto: num(t.bruto),
      neto: num(t.neto),
      referencia: t.referencia,
      error: t.error,
      fecha: t.createdAt.toISOString(),
    })),
    eventos: eventos.map((e) => ({
      fecha: e.fecha.toISOString(),
      tipo: e.tipo,
      comentario: e.comentario,
      planId: e.entidadTipo === "plan" ? e.entidadId : e.entidadTipo === "unidad" ? (planIdDe.get(e.entidadId) ?? null) : null,
    })),
    eventosStripe: eventosStripe.map((e) => ({
      fecha: e.createdAt.toISOString(),
      tipo: e.tipo,
      procesado: e.procesado,
      nota: e.error,
    })),
  };
}

export type Escenario = NonNullable<Awaited<ReturnType<typeof leerEscenario>>>;

async function planDePrueba(planId: string) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: { comprador: { include: { unidad: { include: { proyecto: true } } } } },
  });
  if (!plan || plan.comprador.unidad.proyecto.nombre !== NOMBRE_PROYECTO) {
    throw new ReglaError(`Ese plan no es del proyecto «${NOMBRE_PROYECTO}»: esta página sólo toca la prueba.`);
  }
  return plan;
}

/**
 * Pone la fecha de la siguiente mensualidad por cobrar en el pasado (ayer),
 * para que el barrido la tome hoy. Queda en la bitácora.
 */
export async function vencerSiguiente(planId: string) {
  await planDePrueba(planId);
  const siguiente = await prisma.exhibicion.findFirst({
    where: {
      planId,
      numero: { gt: 0 },
      estado: { in: [EstadoExhibicion.PENDIENTE, EstadoExhibicion.VENCIDA] },
      fechaProgramada: { gt: new Date() },
    },
    orderBy: [{ numero: "asc" }, { version: "desc" }],
  });
  if (!siguiente) throw new ReglaError("No queda ninguna mensualidad con fecha futura en este plan.");
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.exhibicion.update({ where: { id: siguiente.id }, data: { fechaProgramada: ayer } });
  await prisma.evento.create({
    data: {
      entidadTipo: "plan",
      entidadId: planId,
      tipo: "prueba_fecha_adelantada",
      comentario: `Prueba con dinero real: la mensualidad ${siguiente.numero} se movió del ${siguiente.fechaProgramada.toLocaleDateString("es-MX")} a ayer para que el barrido la cobre.`,
    },
  });
  return { numero: siguiente.numero, monto: Number(siguiente.monto) };
}

/** El barrido, sólo sobre el proyecto de prueba. Con `veces: 2`, dos a la vez. */
export async function barrerPrueba(veces: 1 | 2) {
  const proyecto = await proyectoDePrueba();
  if (!proyecto) throw new ReglaError(`Todavía no existe el proyecto «${NOMBRE_PROYECTO}». Prepáralo primero.`);
  return Promise.all(Array.from({ length: veces }, () => cobrarVencidas({ proyectoId: proyecto.id })));
}
