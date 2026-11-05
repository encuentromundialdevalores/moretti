/**
 * Los casos de la prueba con dinero real (docs/sprint-03/prueba-dinero-real.md),
 * en el orden en que se hacen. Cada uno dice para qué es, qué hacer paso a
 * paso (en esta página, en el back office, en Stripe o en la app del banco),
 * qué tiene que pasar y dónde comprobarlo. Los montos salen del escenario
 * «Prueba real» (app/api/pruebas/dinero-real/escenario.ts): $10 por cobro.
 */

import { api, type Escenario, type PlanEscenario, type Resultado } from "./conexiones";

/** Lo menos que Stripe cobra en MXN. */
export const MINIMO_CENTAVOS = 10_00;

/**
 * Tarifa estimada por cargo exitoso: 3.6 % + $3 MXN, más IVA. Stripe no la
 * devuelve al reembolsar. Verificar la vigente en stripe.com/mx/pricing.
 */
export function tarifaEstimada(centavos: number) {
  return Math.round((centavos * 0.036 + 3_00) * 1.16);
}

export type Letra = "A" | "B" | "C" | "D" | "E" | "F";

export type Etapa =
  | "antes"
  | "anticipo"
  | "mensualidades"
  | "plan"
  | "webhook"
  | "devoluciones"
  | "moretti"
  | "captura"
  | "cierre"
  | "no-probar";

export const ETAPAS: { id: Etapa; titulo: string; descripcion: string }[] = [
  { id: "antes", titulo: "1 · Antes de cobrar", descripcion: "Lo que se tiene que frenar sin mover un peso. Si algo de aquí falla, para la prueba." },
  { id: "anticipo", titulo: "2 · El anticipo", descripcion: "El comprador guarda su tarjeta y paga $10 con él presente." },
  { id: "mensualidades", titulo: "3 · Mensualidades", descripcion: "El barrido cobra sin el comprador; el banco a veces dice que no." },
  { id: "plan", titulo: "4 · Cambios al plan", descripcion: "Un abono extraordinario versiona el calendario." },
  { id: "webhook", titulo: "5 · El webhook", descripcion: "Cuando la confirmación de Stripe no llega o llega dos veces." },
  { id: "devoluciones", titulo: "6 · Devoluciones", descripcion: "Reembolsos desde el back office y desde Stripe." },
  { id: "moretti", titulo: "7 · Pagos a Moretti", descripcion: "La transferencia del neto a su cuenta conectada (D-34). Hazla días después." },
  { id: "captura", titulo: "8 · Captura manual (opcional)", descripcion: "Sólo si se va a usar STRIPE_CAPTURE_METHOD=manual." },
  { id: "cierre", titulo: "9 · Cierre", descripcion: "Liquidar lo que quede y volver a poner el candado." },
  { id: "no-probar", titulo: "No se prueba con dinero real", descripcion: "Ya cubierto en modo prueba; aquí sólo se explica por qué no." },
];

export type Contexto = { escenario: Escenario; autoriza: string };

/** Qué le pasa al dinero de la tarjeta. */
export type Movimiento = "cobra" | "devuelve" | "retiene" | "transfiere" | "nada";

export type Accion = {
  etiqueta: string;
  /** Si mueve dinero, se pide confirmar con este texto. */
  confirmar?: string;
  ejecutar: (c: Contexto) => Promise<Resultado>;
};

export type Caso = {
  id: string;
  etapa: Etapa;
  titulo: string;
  /** El plan del escenario en el que se hace. */
  letra?: Letra;
  actor: "Comprador" | "Barrido" | "Back office" | "Banco" | "Stripe";
  movimiento: Movimiento;
  /** Lo que se cobra, devuelve o transfiere. null si depende del plan. */
  centavos: number | null;
  /** Para qué sirve, en una línea. */
  objetivo: string;
  /** Lo que tiene que estar listo antes. */
  antes?: string[];
  pasos: string[];
  /** Un recuadro de captura en la tarjeta del caso: el del anticipo o el de otra tarjeta. */
  panel?: "anticipo" | "tarjeta";
  acciones?: Accion[];
  esperado: { pantalla: string; stripe: string; base: string; dinero: string };
  /** Dónde mirarlo. */
  comprobar: string[];
  costo: string;
  revertir: string;
  /** Algo que puede salir distinto con una tarjeta real. */
  ojo?: string;
};

// ── Ayudas para las acciones ──────────────────────────────────────────────

export function planDe(e: Escenario, letra: Letra): PlanEscenario {
  const plan = e.planes.find((p) => p.letra === letra);
  if (!plan) throw new Error(`No existe el plan ${letra}. Prepara el escenario (paso 0).`);
  return plan;
}

/** La siguiente mensualidad viva (por cobrar), sin un cobro pendiente. */
export function siguienteMensualidad(p: PlanEscenario) {
  const ex = p.exhibiciones.find((e) => e.numero > 0 && (e.estado === "PENDIENTE" || e.estado === "VENCIDA") && !e.pendiente);
  if (!ex) throw new Error(`El plan ${p.letra} ya no tiene mensualidades por cobrar.`);
  return ex;
}

function pagoDe(p: PlanEscenario, numero: number) {
  const ex = p.exhibiciones.find((e) => e.numero === numero && e.pago);
  if (!ex?.pago) throw new Error(`La mensualidad ${numero} del plan ${p.letra} todavía no está pagada. Haz antes los casos que la cobran.`);
  return ex.pago;
}

const vencer: Accion = {
  etiqueta: "Vencer la siguiente mensualidad",
  ejecutar: (c) => api.vencer(planDe(c.escenario, "A").id),
};
const barrido: Accion = {
  etiqueta: "Correr el barrido",
  confirmar: "El barrido cobra a la tarjeta guardada todo lo vencido del proyecto «Prueba real».",
  ejecutar: () => api.barrido(),
};
const cobrarSiguiente: Accion = {
  etiqueta: "Cobrar la siguiente mensualidad",
  confirmar: "Cobra $10 a la tarjeta guardada del plan A.",
  ejecutar: (c) => {
    const ex = siguienteMensualidad(planDe(c.escenario, "A"));
    return api.cobrarExhibicion(ex.id, ex.numero);
  },
};
const transferir: Accion = {
  etiqueta: "Autorizar la transferencia a Moretti",
  confirmar: "Transfiere a la cuenta de Moretti todo lo retenido del proyecto «Prueba real», menos la comisión.",
  ejecutar: (c) => api.transferir(c.escenario.proyecto.id, c.autoriza),
};

const DIEZ = MINIMO_CENTAVOS;
const PAGOS_STRIPE = "Stripe (modo real) › Pagos";
const WEBHOOKS_STRIPE = "Stripe › Desarrolladores › Webhooks › tu endpoint (o la terminal de `stripe listen`)";

export const CASOS: Caso[] = [
  // ── 1 · Antes de cobrar ─────────────────────────────────────────────────
  {
    id: "P1",
    etapa: "antes",
    titulo: "Guardar tarjeta sin autorizar los cargos futuros",
    letra: "F",
    actor: "Comprador",
    movimiento: "nada",
    centavos: null,
    objetivo: "Que el servidor no guarde una tarjeta si el comprador no marcó la casilla, aunque alguien se salte el botón.",
    pasos: [
      "Pulsa «Mandar la petición sin la casilla». Hace lo mismo que el navegador al capturar la tarjeta, pero con `consentimiento: false`.",
      "Lee la respuesta que aparece abajo del botón.",
      "Para verlo en el front: abre el plan F (enlace «Abrir el plan F» arriba de los pasos), baja a la tabla de exhibiciones y, en la fila del anticipo, deja la casilla «Autorizo…» sin marcar: el botón «Capturar tarjeta» se queda gris.",
    ],
    acciones: [
      { etiqueta: "Mandar la petición sin la casilla", ejecutar: (c) => api.tarjetaSinConsentimiento(planDe(c.escenario, "F").id) },
    ],
    esperado: {
      pantalla: "«400 · Para guardar la tarjeta, el comprador tiene que autorizar que ahí se le carguen sus mensualidades.»",
      stripe: "Nada: ni Cliente ni SetupIntent.",
      base: "El plan F sigue «sin tarjeta».",
      dinero: "No se mueve nada.",
    },
    comprobar: ["En Stripe › Clientes no aparece «Prueba F».", "En el estado del plan F (abajo de esta tarjeta): Tarjeta = sin tarjeta."],
    costo: "$0.",
    revertir: "Nada que revertir.",
  },
  {
    id: "P2",
    etapa: "antes",
    titulo: "Tarjeta con datos mal (CVC o vencimiento)",
    letra: "F",
    actor: "Comprador",
    movimiento: "nada",
    centavos: null,
    objetivo: "Ver cómo contesta un banco real a datos equivocados, y que no se guarde nada.",
    panel: "tarjeta",
    pasos: [
      "En el recuadro de abajo marca «Autorizo…» y pulsa «Capturar tarjeta». Aparece el formulario de Stripe.",
      "Escribe el número real de tu tarjeta con el CVC equivocado (cambia un dígito). Vencimiento y código postal, los correctos.",
      "Pulsa «Guardar tarjeta» y anota el mensaje que sale en rojo.",
      "Pulsa «Cancelar», vuelve a capturar con el CVC bien pero un mes de vencimiento equivocado, y anota el mensaje.",
      "No pases de 3 intentos fallidos: el banco puede bloquear la tarjeta por seguridad.",
    ],
    esperado: {
      pantalla: "El error sale dentro del formulario de Stripe («El código de seguridad de la tarjeta es incorrecto» o algo sobre la fecha). No avanza.",
      stripe: "Un Cliente «Prueba F» y un SetupIntent que se queda en `requires_payment_method` con `incorrect_cvc` o `invalid_expiry_*`.",
      base: "El plan F sigue sin tarjeta: el servidor sólo registra una tarjeta que Stripe confirmó.",
      dinero: "Algunos bancos verifican la tarjeta con una retención de $0 o $1 que desaparece sola en días.",
    },
    comprobar: [
      "Stripe › Clientes › «Prueba F» › Eventos: el intento fallido con su código.",
      "En el estado del plan F: Tarjeta = sin tarjeta.",
    ],
    costo: "$0.",
    revertir: "Nada que revertir.",
    ojo: "Hay bancos que no validan el CVC en la verificación y dejan guardar la tarjeta. Si se guarda, anótalo: el error saldría hasta el primer cobro.",
  },
  {
    id: "P3",
    etapa: "antes",
    titulo: "Cobro debajo del mínimo ($9)",
    letra: "D",
    actor: "Comprador",
    movimiento: "nada",
    centavos: 9_00,
    objetivo: "Que un cobro menor a $10 MXN se frene en el servidor, antes de llegar a Stripe.",
    panel: "anticipo",
    pasos: [
      "El plan D tiene un anticipo de $9 (prototipo PRUEBA-MIN).",
      "En el recuadro de abajo marca «Autorizo…» y pulsa «Capturar tarjeta».",
      "Captura tu tarjeta real (bien) y pulsa «Guardar tarjeta y pagar anticipo».",
      "La tarjeta sí se guarda; el cobro de $9 no debe salir. Anota el mensaje.",
    ],
    esperado: {
      pantalla: "«No se cobra $9.00: Stripe no acepta cobros menores a $10.00 MXN.»",
      stripe: "Un SetupIntent `succeeded` para «Prueba D» y ningún pago.",
      base: "El anticipo D sigue Programado, sin intentos rechazados.",
      dinero: "No se cobra nada.",
    },
    comprobar: [`${PAGOS_STRIPE}: no hay ningún cargo de «Prueba D».`, "En el estado del plan D: anticipo Programado."],
    costo: "$0.",
    revertir: "Nada que revertir.",
  },
  {
    id: "P4",
    etapa: "antes",
    titulo: "Cobro arriba del tope ($304)",
    letra: "E",
    actor: "Comprador",
    movimiento: "nada",
    centavos: 304_00,
    objetivo: "Que en modo real ningún cobro pase del tope (STRIPE_TOPE_CENTAVOS, $300 por defecto).",
    panel: "anticipo",
    pasos: [
      "El plan E tiene un anticipo de $304 (prototipo PRUEBA-TOPE).",
      "En el recuadro de abajo marca «Autorizo…», «Capturar tarjeta», captura tu tarjeta y pulsa «Guardar tarjeta y pagar anticipo».",
      "Anota el mensaje.",
    ],
    esperado: {
      pantalla: "«Modo real: cobros de $304.00 pasa del tope de $300.00 (STRIPE_TOPE_CENTAVOS). No se llamó a Stripe.»",
      stripe: "Un SetupIntent `succeeded` para «Prueba E» y ningún pago.",
      base: "El anticipo E sigue Programado.",
      dinero: "No se cobra nada.",
    },
    comprobar: [`${PAGOS_STRIPE}: ningún cargo de $304.`],
    costo: "$0.",
    revertir: "Nada que revertir.",
    ojo: "En el ensayo con llaves de prueba no hay tope: ahí el cobro de prueba de $304 sí sale, y está bien.",
  },

  // ── 2 · El anticipo ─────────────────────────────────────────────────────
  {
    id: "C1",
    etapa: "anticipo",
    titulo: "Guardar la tarjeta y pagar el anticipo",
    letra: "A",
    actor: "Comprador",
    movimiento: "cobra",
    centavos: DIEZ,
    objetivo: "El primer cargo real: la tarjeta queda guardada en la plataforma y el anticipo congela el precio.",
    antes: ["Ten abierto Stripe en modo real, en la sección Pagos, en otra pestaña."],
    panel: "anticipo",
    pasos: [
      "En el recuadro de abajo marca «Autorizo que en esta tarjeta se cobre el anticipo…» y pulsa «Capturar tarjeta».",
      "Captura la tarjeta con la que vas a hacer toda la prueba y pulsa «Guardar tarjeta y pagar anticipo».",
      "Si tu banco pide confirmar (app, SMS o NIP), apruébalo: entonces el caso es como C3 y lo anotas así.",
      "Espera el mensaje «Anticipo cobrado». Mientras diga «Esperando la confirmación de Stripe», no vuelvas a pulsar nada.",
      "Pulsa «Actualizar» en el estado del plan A: el anticipo debe salir Pagada.",
    ],
    esperado: {
      pantalla: "«Anticipo cobrado. El precio quedó congelado y la unidad, apartada.» con la referencia `pi_…`.",
      stripe: "Cliente «Prueba A», SetupIntent `off_session` y un pago de MX$10.00 Exitoso, con `transfer_group = proyecto_<id>` y sin comisión de aplicación.",
      base: "Anticipo Pagada; plan Activo con el precio congelado y 12 mensualidades de $10; un pago con su comisión; webhook `payment_intent.succeeded` procesado.",
      dinero: "Se cargan $10.00 a la tarjeta. En Stripe queda «pendiente» unos días antes de estar disponible.",
    },
    comprobar: [
      `${PAGOS_STRIPE}: el cargo de MX$10.00 «día uno · Anticipo · plan …». Ábrelo: en Metadatos viene comisionCentavos y en «Grupo de transferencias» proyecto_….`,
      `${WEBHOOKS_STRIPE}: payment_intent.succeeded entregado con 200.`,
      "Back office › el plan A (enlace arriba): «Precio congelado», chip Activo y la unidad en Apartado.",
      "Back office › Fiscal: un comprobante pendiente por $10.",
    ],
    costo: "La tarifa de este cargo (≈ $3.90).",
    revertir: "Se devuelve al final, en los casos 6 y 9.",
  },
  {
    id: "C2",
    etapa: "anticipo",
    titulo: "3-D Secure abandonado",
    letra: "B",
    actor: "Comprador",
    movimiento: "nada",
    centavos: DIEZ,
    objetivo: "Si el comprador no completa la autenticación del banco, no se cobra y puede volver a intentar.",
    panel: "anticipo",
    pasos: [
      "Usa una tarjeta cuyo banco pida confirmar las compras en línea (casi todas las de débito en México lo hacen).",
      "En el recuadro de abajo marca «Autorizo…», «Capturar tarjeta», captura la tarjeta y pulsa «Guardar tarjeta y pagar anticipo».",
      "Cuando aparezca la ventana del banco, ciérrala o rechaza el cargo en la app.",
      "Espera el mensaje rojo. No vuelvas a pagar todavía: eso es C3.",
    ],
    esperado: {
      pantalla: "«El banco no autorizó el cargo. Puedes intentar de nuevo o usar otra tarjeta.»",
      stripe: "El pago queda Incompleto o Fallido, con `payment_intent_authentication_failure`. Llega `payment_intent.payment_failed`.",
      base: "El anticipo B sigue sin pagar y su contador de intentos sube a 1: el siguiente intento va con llave nueva.",
      dinero: "No se cobra. Si el banco hizo una retención, la suelta solo.",
    },
    comprobar: [`${PAGOS_STRIPE}: el intento de «Prueba B» como Incompleto o Fallido.`, "En el estado del plan B: anticipo con «1 rechazo»."],
    costo: "$0.",
    revertir: "Sigue con C3 en el mismo plan.",
    ojo: "No hay forma de forzar 3-D Secure con una tarjeta real: lo decide el banco. Si no lo pide y el cargo pasa directo, márcalo «No aplicó» y salta C3 (ya cobraste el anticipo B).",
  },
  {
    id: "C3",
    etapa: "anticipo",
    titulo: "Anticipo con 3-D Secure aprobado",
    letra: "B",
    actor: "Comprador",
    movimiento: "cobra",
    centavos: DIEZ,
    objetivo: "El anticipo con autenticación: el cargo lo aplica el webhook, no la pantalla.",
    panel: "anticipo",
    pasos: [
      "Después de C2, en el mismo recuadro pulsa «Cobrar anticipo» (la tarjeta ya está guardada).",
      "Aprueba en la ventana del banco o en su app.",
      "Verás «Esperando la confirmación de Stripe. No vuelvas a pagar.» y luego «Anticipo cobrado».",
    ],
    esperado: {
      pantalla: "«Tu banco pide confirmar el cargo…» → «Esperando la confirmación…» → «Anticipo cobrado».",
      stripe: "Un pago nuevo de MX$10.00 que pasa por «requiere acción» y termina Exitoso. La llave de idempotencia termina en `int_2`.",
      base: "Anticipo B Pagada cuando llega `payment_intent.succeeded`.",
      dinero: "Se cargan $10.00.",
    },
    comprobar: [`${PAGOS_STRIPE}: el cargo de «Prueba B» con 3-D Secure en sus detalles.`, `${WEBHOOKS_STRIPE}: payment_intent.succeeded con 200.`],
    costo: "La tarifa de este cargo (≈ $3.90).",
    revertir: "Reembólsalo desde Stripe al final (paso 9).",
  },

  // ── 3 · Mensualidades ───────────────────────────────────────────────────
  {
    id: "B1",
    etapa: "mensualidades",
    titulo: "Mensualidad cobrada por el barrido",
    letra: "A",
    actor: "Barrido",
    movimiento: "cobra",
    centavos: DIEZ,
    objetivo: "El cobro mensual sin el comprador presente (fuera de sesión).",
    antes: ["C1 hecho: el plan A con anticipo pagado."],
    pasos: [
      "Pulsa «Vencer la siguiente mensualidad». Mueve la fecha de la mensualidad 1 a ayer y lo deja en la bitácora. Es lo único que la página cambia a mano: en producción, la fecha llega sola.",
      "Pulsa «Correr el barrido». Es el mismo barrido del cron, pero sólo sobre «Prueba real».",
      "La respuesta debe decir «cobradas 1».",
    ],
    acciones: [vencer, barrido],
    esperado: {
      pantalla: "«revisadas 1, cobradas 1, pendientes 0, rechazadas 0…».",
      stripe: "Un pago de MX$10.00 «Mensualidad 1» Exitoso, sin que nadie lo haya aprobado en ese momento.",
      base: "Mensualidad 1 Pagada; la 2 sigue Programada.",
      dinero: "Se cargan $10.00.",
    },
    comprobar: [`${PAGOS_STRIPE}: «día uno · Mensualidad 1 · plan …».`, "Back office › Cobranza: el plan A al corriente."],
    costo: "La tarifa de este cargo (≈ $3.90).",
    revertir: "Se reembolsa en A1 + A2.",
    ojo: "Algunos bancos mexicanos rechazan un cargo fuera de sesión con `authentication_required` aunque la tarjeta se haya guardado con 3-D Secure. Si pasa, es el caso B4: anótalo ahí.",
  },
  {
    id: "B2",
    etapa: "mensualidades",
    titulo: "Doble clic en «Cobrar»",
    letra: "A",
    actor: "Back office",
    movimiento: "cobra",
    centavos: DIEZ,
    objetivo: "Dos cobros de la misma mensualidad al mismo tiempo: Stripe cobra una sola vez.",
    pasos: [
      "No hace falta vencer: el botón «Cobrar» del estado de cuenta cobra aunque no haya llegado la fecha.",
      "Pulsa «Cobrar la siguiente mensualidad dos veces a la vez». La página manda dos peticiones al mismo tiempo, como dos clics seguidos.",
      "Revisa que las dos referencias sean la misma, o que la segunda diga «ya está pagada».",
    ],
    acciones: [
      {
        etiqueta: "Cobrar la siguiente mensualidad dos veces a la vez",
        confirmar: "Manda dos cobros de $10 a la vez; sólo uno debe salir.",
        ejecutar: (c) => {
          const ex = siguienteMensualidad(planDe(c.escenario, "A"));
          return api.cobrarDosVeces(ex.id, ex.numero);
        },
      },
    ],
    esperado: {
      pantalla: "Los dos contestan 200 con la misma `pi_…`, o uno 200 y el otro «400 · Esta exhibición ya está pagada». Nunca dos referencias distintas.",
      stripe: "Un solo cargo para la mensualidad 2 (misma llave `…:exh_2:int_1`).",
      base: "Un solo pago para la mensualidad 2.",
      dinero: "Se cargan $10.00 una vez. Revisa el estado de cuenta del banco: no debe haber dos.",
    },
    comprobar: [`${PAGOS_STRIPE}: un solo cargo «Mensualidad 2».`],
    costo: "La tarifa de un cargo (≈ $3.90).",
    revertir: "Si hubo dos cargos es un bug: reembolsa el segundo desde Stripe y avísalo.",
  },
  {
    id: "B3",
    etapa: "mensualidades",
    titulo: "Dos barridos a la vez",
    letra: "A",
    actor: "Barrido",
    movimiento: "cobra",
    centavos: DIEZ,
    objetivo: "Si el cron corre dos veces al mismo tiempo, la mensualidad se cobra una vez.",
    pasos: ["Pulsa «Vencer la siguiente mensualidad».", "Pulsa «Correr dos barridos a la vez».", "Entre los dos deben sumar una cobrada."],
    acciones: [
      vencer,
      {
        etiqueta: "Correr dos barridos a la vez",
        confirmar: "Dos barridos simultáneos sobre «Prueba real»: sólo uno debe cobrar.",
        ejecutar: () => api.dosBarridos(),
      },
    ],
    esperado: {
      pantalla: "«Barrido 1: … cobradas 1 … Barrido 2: … omitidas 1 (o revisadas 0)… Entre los dos: 1 cobrada(s).»",
      stripe: "Un solo cargo «Mensualidad 3».",
      base: "Un pago. El barrido que perdió no la tocó.",
      dinero: "Se cargan $10.00 una vez.",
    },
    comprobar: [`${PAGOS_STRIPE}: un solo cargo «Mensualidad 3».`],
    costo: "La tarifa de un cargo (≈ $3.90).",
    revertir: "Nada que revertir.",
  },
  {
    id: "B4",
    etapa: "mensualidades",
    titulo: "El banco rechaza la mensualidad",
    letra: "A",
    actor: "Banco",
    movimiento: "nada",
    centavos: DIEZ,
    objetivo: "Ver el primer código de rechazo real y que la cobranza aplique su regla.",
    pasos: [
      "Abre la app de tu banco y bloquea (o congela, o apaga las compras en línea de) la tarjeta.",
      "Pulsa «Vencer la siguiente mensualidad».",
      "Pulsa «Correr el barrido».",
      "Copia a la nota el código que sale en la respuesta y en el estado del plan (p. ej. `card_declined`, `do_not_honor`).",
      "Desbloquea la tarjeta en la app del banco.",
      "No la cobres a mano: lo que sigue depende del código. Sigue con C4.",
    ],
    acciones: [
      vencer,
      { ...barrido, confirmar: "La tarjeta debe estar bloqueada en el banco: el barrido intentará cobrarle $10." },
    ],
    esperado: {
      pantalla: "«rechazadas 1». El estado del plan muestra la mensualidad Vencida con el código.",
      stripe: "Un pago Fallido con el código de rechazo del banco; llega `payment_intent.payment_failed`.",
      base: "Mensualidad Vencida con su código y la regla de docs/integracion-stripe.md: fecha de reintento (`generic_decline`, `insufficient_funds`…), «pide tarjeta nueva» o tarjeta inválida (`lost_card`, `stolen_card`). El plan sigue Activo con un solo rechazo.",
      dinero: "No se cobra.",
    },
    comprobar: [
      `${PAGOS_STRIPE}: el intento Fallido; al abrirlo, «Motivo del rechazo».`,
      "Back office › Cobranza: la alerta del plan A con el rechazo.",
      "En el estado del plan A: «próximo intento» o «pide tarjeta nueva».",
    ],
    costo: "$0 (Stripe no cobra tarifa por un cargo rechazado; verificar).",
    revertir: "Desbloquea la tarjeta y haz C4.",
    ojo: "Es la primera vez que se ve un código real: anótalo exacto. Si llega uno que la tabla no conoce, el motor no reintenta y pide revisarlo en Stripe.",
  },
  {
    id: "C4",
    etapa: "mensualidades",
    titulo: "Registrar la tarjeta otra vez",
    letra: "A",
    actor: "Comprador",
    movimiento: "cobra",
    centavos: DIEZ,
    objetivo: "Con una tarjeta nueva (o la misma ya desbloqueada), la mensualidad rechazada vuelve al barrido.",
    panel: "tarjeta",
    pasos: [
      "Con la tarjeta ya desbloqueada, en el recuadro de abajo marca «Autorizo…» y pulsa «Capturar tarjeta».",
      "Captura otra tarjeta, o la misma, y pulsa «Guardar tarjeta».",
      "Pulsa «Correr el barrido»: la mensualidad que rebotó en B4 se cobra ahora.",
    ],
    acciones: [barrido],
    esperado: {
      pantalla: "«Tarjeta guardada: visa terminación ####.» y después «cobradas 1».",
      stripe: "Un SetupIntent nuevo en «Prueba A» y un cargo de MX$10.00 por la mensualidad rechazada (llave `int_2`).",
      base: "Se limpian «pide tarjeta nueva», la fecha de reintento y la tarjeta inválida; la bitácora dice que la mensualidad vuelve al barrido. Queda Pagada.",
      dinero: "Se cargan $10.00.",
    },
    comprobar: [`${PAGOS_STRIPE}: el cargo de la mensualidad que había rebotado.`, "En el estado del plan A: la mensualidad Pagada."],
    costo: "La tarifa de este cargo (≈ $3.90).",
    revertir: "Nada que revertir.",
  },
  {
    id: "B5",
    etapa: "mensualidades",
    titulo: "El banco pide autenticación fuera de sesión",
    letra: "A",
    actor: "Banco",
    movimiento: "nada",
    centavos: DIEZ,
    objetivo: "Si el banco no deja cobrar sin el comprador, la cobranza pide registrar la tarjeta otra vez.",
    pasos: [
      "No se provoca: sólo pasa si en B1, B3 o C4 el banco contestó `authentication_required`.",
      "Si pasó, mira el estado del plan A: la mensualidad dice «pide tarjeta nueva».",
      "Haz C4 otra vez (registrar la tarjeta, ahora con 3-D Secure) y corre el barrido.",
    ],
    esperado: {
      pantalla: "«rechazadas 1» con `authentication_required`.",
      stripe: "Pago Fallido con `authentication_required`.",
      base: "La mensualidad deja de reintentarse sola hasta que el comprador registre la tarjeta con él presente.",
      dinero: "No se cobra.",
    },
    comprobar: ["En el estado del plan A: «pide tarjeta nueva»."],
    costo: "$0.",
    revertir: "C4.",
    ojo: "Si nunca pasa, márcalo «No aplicó». Es buena señal: el banco acepta los cargos fuera de sesión.",
  },

  // ── 4 · Cambios al plan ─────────────────────────────────────────────────
  {
    id: "R1",
    etapa: "plan",
    titulo: "Abono extraordinario de $10",
    letra: "A",
    actor: "Back office",
    movimiento: "cobra",
    centavos: DIEZ,
    objetivo: "Un adelanto se cobra y versiona el plan: la siguiente mensualidad queda pagada por adelantado.",
    pasos: [
      "Pulsa «Cobrar un adelanto de $10».",
      "En el front es lo mismo que: plan A › «Adelanto, liquidación anticipada o upgrade» › Adelanto › escribe 10 › «Ver cómo queda» › «Confirmar y cobrar el adelanto».",
      "Abre el plan A y mira «Versiones del plan»: debe haber una versión 2.",
    ],
    acciones: [
      {
        etiqueta: "Cobrar un adelanto de $10",
        confirmar: "Cobra $10 a la tarjeta del plan A y crea una versión nueva del plan.",
        ejecutar: (c) => api.adelanto(planDe(c.escenario, "A").id, "10"),
      },
    ],
    esperado: {
      pantalla: "«200 · Adelanto cobrado. El plan va en la versión 2.»",
      stripe: "Un pago de MX$10.00 Exitoso.",
      base: "La mensualidad que cubre queda Reemplazada y nace la fila del adelanto pagada. Anticipo + vivas + pagadas sigue sumando $130 (R7).",
      dinero: "Se cargan $10.00.",
    },
    comprobar: ["Back office › plan A › «Versiones del plan»: versión 1 y versión 2.", `${PAGOS_STRIPE}: el cargo del adelanto.`],
    costo: "La tarifa de este cargo (≈ $3.90).",
    revertir: "El calendario no se regresa solo: queda así para el resto de la prueba.",
  },

  // ── 5 · El webhook ──────────────────────────────────────────────────────
  {
    id: "W1",
    etapa: "webhook",
    titulo: "El webhook no llega a tiempo",
    letra: "A",
    actor: "Stripe",
    movimiento: "cobra",
    centavos: DIEZ,
    objetivo: "Si Stripe no puede avisar, el cobro no se pierde ni se duplica cuando por fin llega el aviso.",
    pasos: [
      "Apaga el webhook: en Stripe › Desarrolladores › Webhooks › tu endpoint › «Deshabilitar». Si usas `stripe listen`, deténlo con Ctrl+C.",
      "Pulsa «Cobrar la siguiente mensualidad».",
      "Mira el estado del plan A: la mensualidad ya sale Pagada (el cobro sin 3-D Secure es inmediato; no depende del webhook).",
      "En Stripe › Desarrolladores › Eventos, el `payment_intent.succeeded` de ese cargo sale con entrega pendiente o fallida.",
      "Vuelve a habilitar el endpoint (o arranca `stripe listen` otra vez) y, en ese evento, pulsa «Reenviar».",
      "Pulsa «Actualizar»: el evento sale procesado y la mensualidad sigue con un solo pago.",
    ],
    acciones: [cobrarSiguiente],
    esperado: {
      pantalla: "«200 · Mensualidad N cobrado.»",
      stripe: "El cargo sale; el evento se queda sin entregar hasta que reactivas el endpoint.",
      base: "El pago se aplica una vez. Cuando llega el evento, no se duplica.",
      dinero: "Se cargan $10.00 una vez.",
    },
    comprobar: [`${WEBHOOKS_STRIPE}: el intento fallido y, después, el reenvío con 200.`, "En «Eventos de Stripe» de esta página: el evento procesado."],
    costo: "La tarifa de este cargo (≈ $3.90).",
    revertir: "Vuelve a habilitar el endpoint. No olvides este paso.",
  },
  {
    id: "W2",
    etapa: "webhook",
    titulo: "El mismo evento llega dos veces",
    actor: "Stripe",
    movimiento: "nada",
    centavos: null,
    objetivo: "Un evento repetido no hace nada.",
    pasos: [
      "En Stripe › Desarrolladores › Eventos, abre cualquier `payment_intent.succeeded` que ya se procesó.",
      "Pulsa «Reenviar» y elige tu endpoint.",
      "Pulsa «Actualizar» en esta página.",
    ],
    esperado: {
      pantalla: "Nada cambia en el back office.",
      stripe: "La entrega sale con 200 y el cuerpo `{ received: true, duplicate: true }`.",
      base: "Ningún pago nuevo.",
      dinero: "No se mueve nada.",
    },
    comprobar: [`${WEBHOOKS_STRIPE}: la respuesta del reenvío dice duplicate: true.`],
    costo: "$0.",
    revertir: "Nada que revertir.",
  },

  // ── 6 · Devoluciones ────────────────────────────────────────────────────
  {
    id: "A1",
    etapa: "devoluciones",
    titulo: "Reembolso parcial sin devolver la comisión",
    letra: "A",
    actor: "Back office",
    movimiento: "devuelve",
    centavos: 5_00,
    objetivo: "Devolver una parte: queda un registro nuevo y el pago original no se toca (R3).",
    pasos: [
      "Pulsa «Reembolsar $5 de la mensualidad 1». Manda `devolverComision: false` y `montoCentavos: 500`.",
      "El back office no tiene botón de reembolso: esta acción usa la misma ruta que tendría (`/api/pagos/<id>/reembolsar`).",
    ],
    acciones: [
      {
        etiqueta: "Reembolsar $5 de la mensualidad 1",
        confirmar: "Devuelve $5.00 a la tarjeta.",
        ejecutar: (c) =>
          api.reembolsar(pagoDe(planDe(c.escenario, "A"), 1).id, {
            devolverComision: false,
            motivo: "Prueba con dinero real · A1",
            montoCentavos: 5_00,
          }),
      },
    ],
    esperado: {
      pantalla: "«200 · Reembolso de $5.00 enviado a Stripe.» con `re_…`.",
      stripe: "El cargo de la mensualidad 1 «Reembolsado parcialmente» MX$5.00, con `devolverComision = false` en los metadatos del reembolso; llega `charge.refunded`.",
      base: "Un reembolso nuevo (BACK_OFFICE). El pago sigue en $10.",
      dinero: "Regresan $5.00 a la tarjeta en 5 a 10 días hábiles.",
    },
    comprobar: [`${PAGOS_STRIPE} › el cargo de la mensualidad 1: «Reembolsado parcialmente».`, "En el estado del plan A: «reembolsado $5»."],
    costo: "La tarifa del cargo original no regresa.",
    revertir: "El resto se devuelve en A2.",
  },
  {
    id: "A2",
    etapa: "devoluciones",
    titulo: "Reembolso del resto devolviendo la comisión",
    letra: "A",
    actor: "Back office",
    movimiento: "devuelve",
    centavos: 5_00,
    objetivo: "Devolver lo que queda; un tercer reembolso ya no debe pasar.",
    pasos: [
      "Pulsa «Reembolsar el resto de la mensualidad 1» (sin monto: lo que quede, con `devolverComision: true`).",
      "Pulsa «Intentar un reembolso más»: debe contestar que ya no queda nada.",
    ],
    acciones: [
      {
        etiqueta: "Reembolsar el resto de la mensualidad 1",
        confirmar: "Devuelve los $5.00 restantes.",
        ejecutar: (c) =>
          api.reembolsar(pagoDe(planDe(c.escenario, "A"), 1).id, { devolverComision: true, motivo: "Prueba con dinero real · A2" }),
      },
      {
        etiqueta: "Intentar un reembolso más",
        ejecutar: (c) =>
          api.reembolsar(pagoDe(planDe(c.escenario, "A"), 1).id, {
            devolverComision: true,
            motivo: "Prueba con dinero real · A2 de más",
            montoCentavos: 1_00,
          }),
      },
    ],
    esperado: {
      pantalla: "Primero «200 · Reembolso de $5.00…»; después «400 · … quedan $0.00…».",
      stripe: "El cargo queda «Reembolsado». El tercer intento no llega a Stripe.",
      base: "Dos reembolsos para el pago; el pago sigue igual.",
      dinero: "Regresan los otros $5.00.",
    },
    comprobar: [`${PAGOS_STRIPE} › mensualidad 1: «Reembolsado».`],
    costo: "La tarifa del cargo original no regresa.",
    revertir: "Nada que revertir.",
  },
  {
    id: "A3",
    etapa: "devoluciones",
    titulo: "Reembolso hecho desde el Dashboard de Stripe",
    letra: "A",
    actor: "Back office",
    movimiento: "devuelve",
    centavos: DIEZ,
    objetivo: "Un reembolso que alguien hace fuera del sistema también queda registrado.",
    pasos: [
      "En el estado del plan A copia la referencia `pi_…` de la mensualidad 2.",
      "En Stripe › Pagos, pégala en el buscador y abre el cargo.",
      "Pulsa «Reembolsar», deja el monto completo (MX$10.00), motivo «Solicitado por el cliente», y confirma.",
      "Pulsa «Actualizar» en esta página.",
    ],
    esperado: {
      pantalla: "En el estado del plan A, la mensualidad 2 dice «reembolsado $10 (Dashboard)».",
      stripe: "Reembolso Exitoso y `charge.refunded` al webhook.",
      base: "Un reembolso con origen DASHBOARD_MORETTI y «devolvió comisión» sin dato (nadie lo dijo).",
      dinero: "Regresan $10.00.",
    },
    comprobar: [`${WEBHOOKS_STRIPE}: charge.refunded con 200.`],
    costo: "La tarifa del cargo original no regresa.",
    revertir: "Nada que revertir.",
  },

  // ── 7 · Pagos a Moretti ─────────────────────────────────────────────────
  {
    id: "M1",
    etapa: "moretti",
    titulo: "Transferir antes de que haya saldo disponible",
    letra: "A",
    actor: "Back office",
    movimiento: "nada",
    centavos: null,
    objetivo: "Lo que pasa si se autoriza el pago a Moretti antes de que Stripe libere el dinero (sólo se ve con dinero real).",
    pasos: [
      "Hazlo el mismo día de los cobros, antes de que Stripe › Saldos muestre el dinero como «Disponible».",
      "Escribe tu nombre en «Quién autoriza» (arriba, en el paso 0) y pulsa «Autorizar la transferencia a Moretti».",
      "En el front es: Back office › Pagos a Moretti › Prueba real › «¿Quién autoriza?» › «Pagar a Moretti».",
    ],
    acciones: [transferir],
    esperado: {
      pantalla: "«400 · No se pudo transferir: … insufficient … Los pagos siguen retenidos.»",
      stripe: "No se crea transferencia (`balance_insufficient`).",
      base: "Una transferencia FALLIDA en el registro y los pagos otra vez retenidos.",
      dinero: "No se mueve nada.",
    },
    comprobar: ["Back office › Pagos a Moretti: el historial con la transferencia fallida.", "Stripe › Saldos: «Pendiente» con lo cobrado."],
    costo: "$0.",
    revertir: "Espera a que el saldo esté disponible y haz M2.",
    ojo: "Si sólo queda un cobro retenido, Stripe sí acepta la transferencia y la detiene hasta que ese cobro esté disponible. Entonces este caso se vuelve M2: anótalo así.",
  },
  {
    id: "M2",
    etapa: "moretti",
    titulo: "Transferencia del neto a Moretti",
    letra: "A",
    actor: "Back office",
    movimiento: "transfiere",
    centavos: null,
    objetivo: "Que la cuenta real de Moretti reciba lo cobrado menos la comisión (D-34).",
    antes: ["Stripe › Saldos: el «Disponible» alcanza el neto (en México tarda unos días después de cobrar)."],
    pasos: [
      "Revisa en el estado del escenario cuánto está retenido: los pagos sin reembolso y sin transferir.",
      "Pulsa «Autorizar la transferencia a Moretti».",
      "Pide a Moretti que confirme que la ve en su Dashboard.",
    ],
    acciones: [transferir],
    esperado: {
      pantalla: "«201 · Transferencia enviada a Moretti por $X» con `tr_…`.",
      stripe: "Una transferencia a la `acct_…` de Moretti por cobrado − comisión, con el grupo `proyecto_<id>`.",
      base: "Los pagos transferidos quedan ligados a la transferencia. Los reembolsados no entran.",
      dinero: "El neto sale del saldo de la plataforma y llega a Moretti; a su CLABE, según su calendario de depósitos.",
    },
    comprobar: [
      "Stripe › Connect › Cuentas › Moretti › Transferencias: la `tr_…`.",
      "Back office › Pagos a Moretti: «Enviada», con el neto.",
    ],
    costo: "Revisa si Connect cobra por cuenta activa o por depósito en México.",
    revertir: "Pedirle a Moretti que lo regrese, o en Stripe › la transferencia › «Revertir».",
  },
  {
    id: "M3",
    etapa: "moretti",
    titulo: "Reembolsar un pago ya transferido",
    letra: "A",
    actor: "Back office",
    movimiento: "nada",
    centavos: DIEZ,
    objetivo: "No se puede devolver al comprador dinero que ya se le pagó a Moretti sin revertir antes.",
    antes: ["M2 hecho."],
    pasos: ["Pulsa «Reembolsar un pago transferido». Intenta devolver $10 de uno de los pagos que entraron en M2."],
    acciones: [
      {
        etiqueta: "Reembolsar un pago transferido",
        ejecutar: (c) => {
          const pago = planDe(c.escenario, "A").exhibiciones.find((e) => e.pago?.transferida)?.pago;
          if (!pago) throw new Error("Todavía no hay pagos transferidos. Haz M2 primero.");
          return api.reembolsar(pago.id, { devolverComision: true, motivo: "Prueba con dinero real · M3", montoCentavos: 10_00 });
        },
      },
    ],
    esperado: {
      pantalla: "«400 · Este pago ya se le transfirió a Moretti: para reembolsarlo primero hay que revertir la transferencia…»",
      stripe: "No se crea ningún reembolso.",
      base: "Sin cambios.",
      dinero: "No se mueve nada.",
    },
    comprobar: [`${PAGOS_STRIPE}: ningún reembolso nuevo.`],
    costo: "$0.",
    revertir: "Nada que revertir.",
  },

  // ── 8 · Captura manual ──────────────────────────────────────────────────
  {
    id: "K1",
    etapa: "captura",
    titulo: "Autorizar el anticipo y liberarlo",
    letra: "C",
    actor: "Back office",
    movimiento: "retiene",
    centavos: DIEZ,
    objetivo: "Con captura manual el anticipo sólo aparta el dinero; liberarlo lo suelta sin cobrar.",
    antes: ["En el .env: STRIPE_CAPTURE_METHOD=manual, y reinicia `npm run dev`. Arriba debe decir «Captura: manual»."],
    panel: "anticipo",
    pasos: [
      "En el recuadro de abajo: «Autorizo…», «Capturar tarjeta», captura y «Guardar tarjeta y pagar anticipo».",
      "La pantalla se queda «esperando» o dice que no confirma: es correcto, el cargo está autorizado, no cobrado. Pulsa «Actualizar».",
      "Pulsa «Liberar la autorización».",
    ],
    acciones: [{ etiqueta: "Liberar la autorización", ejecutar: (c) => api.liberar(planDe(c.escenario, "C").id) }],
    esperado: {
      pantalla: "«200 · Autorización liberada.»",
      stripe: "Pago «No capturado» → Cancelado. Eventos `amount_capturable_updated` y `canceled`.",
      base: "El anticipo C sigue sin pagar, con un intento cerrado (`autorizacion_liberada`): el siguiente va con llave nueva.",
      dinero: "El banco retiene $10 y los suelta al liberar (puede tardar unos días en verse).",
    },
    comprobar: [`${PAGOS_STRIPE}: el cargo de «Prueba C» Cancelado.`],
    costo: "$0 (una autorización liberada no paga tarifa; verificar).",
    revertir: "Ya quedó revertido. Sigue con K2.",
  },
  {
    id: "K2",
    etapa: "captura",
    titulo: "Autorizar el anticipo y capturarlo",
    letra: "C",
    actor: "Back office",
    movimiento: "cobra",
    centavos: DIEZ,
    objetivo: "Capturar convierte la autorización en cobro.",
    panel: "anticipo",
    pasos: [
      "En el recuadro de abajo pulsa «Cobrar anticipo» (la tarjeta ya quedó guardada en K1).",
      "Pulsa «Actualizar» y luego «Capturar el anticipo».",
      "Al terminar, regresa STRIPE_CAPTURE_METHOD=automatic (o quítalo) y reinicia.",
    ],
    acciones: [
      {
        etiqueta: "Capturar el anticipo",
        confirmar: "Convierte la autorización de $10 en cargo.",
        ejecutar: (c) => api.capturar(planDe(c.escenario, "C").id),
      },
    ],
    esperado: {
      pantalla: "«200 · Anticipo cobrado.»",
      stripe: "Pago «No capturado» → Exitoso.",
      base: "Anticipo C Pagada; plan Activo con precio congelado.",
      dinero: "La retención se vuelve cargo de $10.00.",
    },
    comprobar: [`${PAGOS_STRIPE}: el cargo de «Prueba C» Exitoso.`],
    costo: "La tarifa de este cargo (≈ $3.90).",
    revertir: "Reembólsalo desde Stripe al final.",
  },

  // ── 9 · Cierre ──────────────────────────────────────────────────────────
  {
    id: "Z1",
    etapa: "cierre",
    titulo: "Liquidación anticipada",
    letra: "A",
    actor: "Back office",
    movimiento: "cobra",
    centavos: null,
    objetivo: "Cobrar todo el saldo en un cargo y cerrar el plan. Va al final: después el plan A ya no sirve.",
    pasos: [
      "Revisa el saldo del plan A en el estado del escenario: debe ser $300 o menos (el tope).",
      "Pulsa «Liquidar el plan A».",
      "En el front es: plan A › «Adelanto, liquidación anticipada o upgrade» › «Liquidación anticipada» › «Ver cómo queda» › «Confirmar y cobrar la liquidación».",
    ],
    acciones: [
      {
        etiqueta: "Liquidar el plan A",
        confirmar: "Cobra todo el saldo del plan A en un solo cargo.",
        ejecutar: (c) => api.liquidar(planDe(c.escenario, "A").id),
      },
    ],
    esperado: {
      pantalla: "«200 · Plan liquidado.»",
      stripe: "Un pago por todo el saldo, sin descuento.",
      base: "Plan Liquidado, saldo $0, las mensualidades que quedaban Canceladas.",
      dinero: "Se carga el saldo completo.",
    },
    comprobar: ["Back office › plan A: chip Liquidado.", `${PAGOS_STRIPE}: el cargo de la liquidación.`],
    costo: "La tarifa sobre el saldo (3.6 % + $3 + IVA).",
    revertir: "Reembólsalo desde Stripe si no se va a transferir a Moretti.",
  },
  {
    id: "Z2",
    etapa: "cierre",
    titulo: "Volver a poner el candado",
    actor: "Back office",
    movimiento: "nada",
    centavos: null,
    objetivo: "Al terminar, el ambiente ya no acepta nada real (D-44).",
    pasos: [
      "Reembolsa desde Stripe lo que no se le vaya a transferir a Moretti.",
      "En el .env borra STRIPE_MODO_REAL y las llaves reales; reinicia.",
      "Arriba debe decir «Stripe apagado».",
      "En Stripe › Eventos reenvía cualquier evento real a tu endpoint.",
      "Borra la llave restringida (Desarrolladores › Claves de API) y deshabilita el endpoint real.",
      "Copia la bitácora (botón arriba) y guárdala en el expediente.",
    ],
    esperado: {
      pantalla: "Chip «Stripe apagado».",
      stripe: "El reenvío sale con 500 «Webhook de Stripe sin configurar».",
      base: "Sin cambios.",
      dinero: "No se mueve nada.",
    },
    comprobar: [`${WEBHOOKS_STRIPE}: el reenvío con 500.`],
    costo: "$0.",
    revertir: "No aplica.",
  },

  // ── No se prueba ────────────────────────────────────────────────────────
  {
    id: "X1",
    etapa: "no-probar",
    titulo: "Contracargo (disputa)",
    actor: "Banco",
    movimiento: "nada",
    centavos: null,
    objetivo: "No se provoca.",
    pasos: ["No le pidas al banco desconocer ningún cargo de la prueba."],
    esperado: {
      pantalla: "—",
      stripe: "Una disputa real cobra una comisión aparte, aunque se gane, y cuenta en contra de la cuenta de la plataforma.",
      base: "Ya se cubrió en E10 (abierta, ganada y perdida) con la tarjeta 0259 en modo prueba.",
      dinero: "Se perdería la comisión de disputa además de la tarifa.",
    },
    comprobar: [],
    costo: "No aplica.",
    revertir: "No aplica.",
  },
  {
    id: "X2",
    etapa: "no-probar",
    titulo: "MSI, SPEI y OXXO",
    actor: "Stripe",
    movimiento: "nada",
    centavos: null,
    objetivo: "No hay código para estos métodos: el sistema sólo cobra con tarjeta.",
    pasos: ["Nada que hacer."],
    esperado: { pantalla: "—", stripe: "Existen en Stripe (sondeos E7 y E8), pero el sistema no los pide.", base: "—", dinero: "—" },
    comprobar: [],
    costo: "No aplica.",
    revertir: "No aplica.",
  },
];
