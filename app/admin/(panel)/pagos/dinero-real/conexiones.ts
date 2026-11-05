import type { Escenario } from "@/app/api/pruebas/dinero-real/escenario";

/**
 * Lo que la página de la prueba con dinero real le pide al servidor. Son las
 * mismas rutas que usa el back office (con la sesión de admin); lo único
 * propio es /api/pruebas/dinero-real, que prepara el escenario, adelanta
 * fechas y corre el barrido sólo sobre el proyecto «Prueba real».
 *
 * Ninguna lanza por un error de la ruta: un 400 o un 402 también es un
 * resultado que hay que anotar. Sólo lanzan si no hay red.
 */

export type { Escenario };
export type PlanEscenario = Escenario["planes"][number];

export type Resultado = {
  /** Si la ruta contestó 2xx. */
  ok: boolean;
  /** Lo que contestó, en una línea. */
  mensaje: string;
  /** `pi_…`, `re_…`, `tr_…`, si hubo. */
  referencia?: string;
  /** La respuesta completa, para la bitácora. */
  respuesta?: unknown;
};

type Respuesta = { status: number; ok: boolean; data: Record<string, unknown> };

async function pedir(url: string, cuerpo?: unknown): Promise<Respuesta> {
  const res = await fetch(url, {
    method: cuerpo === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, ok: res.ok, data };
}

const texto = (v: unknown) => (typeof v === "string" ? v : undefined);

/** Una respuesta de cobro de las rutas del motor (200 · 202 · 402 · 400 · 502). */
function deCobro(r: Respuesta, que: string): Resultado {
  const referencia = texto(r.data.referencia);
  if (r.status === 200) return { ok: true, mensaje: `200 · ${que} cobrado.`, referencia, respuesta: r.data };
  if (r.status === 202) {
    return { ok: true, mensaje: `202 · Pendiente: ${texto(r.data.mensaje) ?? "esperando al banco"}.`, referencia, respuesta: r.data };
  }
  if (r.status === 402) return { ok: false, mensaje: `402 · ${texto(r.data.error) ?? "El banco lo rechazó."}`, respuesta: r.data };
  return { ok: false, mensaje: `${r.status} · ${texto(r.data.error) ?? "Sin detalle."}`, respuesta: r.data };
}

function simple(r: Respuesta, bien: string): Resultado {
  if (r.ok) return { ok: true, mensaje: `${r.status} · ${bien}`, referencia: texto(r.data.referencia), respuesta: r.data };
  return { ok: false, mensaje: `${r.status} · ${texto(r.data.error) ?? "Sin detalle."}`, respuesta: r.data };
}

const pesos = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

type Barrido = { revisadas: number; cobradas: number; pendientes: number; rechazadas: number; omitidas: number; errores: { numero: number; mensaje: string }[] };

function deBarridos(r: Respuesta): Resultado {
  if (!r.ok) return simple(r, "");
  const barridos = (r.data.barridos ?? []) as Barrido[];
  const partes = barridos.map((b, i) => {
    const errores = b.errores.map((e) => `mensualidad ${e.numero}: ${e.mensaje}`).join(" · ");
    return `${barridos.length > 1 ? `Barrido ${i + 1}: ` : ""}revisadas ${b.revisadas}, cobradas ${b.cobradas}, pendientes ${b.pendientes}, rechazadas ${b.rechazadas}, omitidas ${b.omitidas}${errores ? ` (${errores})` : ""}`;
  });
  const cobradas = barridos.reduce((a, b) => a + b.cobradas, 0);
  return { ok: true, mensaje: `${partes.join(". ")}.${barridos.length > 1 ? ` Entre los dos: ${cobradas} cobrada(s).` : ""}`, respuesta: r.data };
}

const URL_PRUEBA = "/api/pruebas/dinero-real";

export const api = {
  async escenario(): Promise<Escenario | null> {
    const r = await pedir(URL_PRUEBA);
    if (!r.ok) throw new Error(texto(r.data.error) ?? "No se pudo leer el escenario.");
    return (r.data.escenario as Escenario | null) ?? null;
  },

  async preparar(p: { cuentaConectada: string; comision: number; correo?: string }): Promise<Resultado> {
    return simple(await pedir(URL_PRUEBA, { accion: "preparar", ...p }), "Escenario listo.");
  },

  async vencer(planId: string): Promise<Resultado> {
    const r = await pedir(URL_PRUEBA, { accion: "vencer", planId });
    if (!r.ok) return simple(r, "");
    return { ok: true, mensaje: `La mensualidad ${r.data.numero} (${pesos(Number(r.data.monto))}) ya venció: ayer.`, respuesta: r.data };
  },

  async barrido(): Promise<Resultado> {
    return deBarridos(await pedir(URL_PRUEBA, { accion: "barrido" }));
  },

  async dosBarridos(): Promise<Resultado> {
    return deBarridos(await pedir(URL_PRUEBA, { accion: "dos-barridos" }));
  },

  /** El botón «Cobrar» del estado de cuenta. */
  async cobrarExhibicion(exhibicionId: string, numero: number): Promise<Resultado> {
    return deCobro(await pedir(`/api/exhibiciones/${exhibicionId}/cobrar`, {}), `Mensualidad ${numero}`);
  },

  /** Dos clics en «Cobrar» al mismo tiempo. */
  async cobrarDosVeces(exhibicionId: string, numero: number): Promise<Resultado> {
    const [a, b] = await Promise.all([
      pedir(`/api/exhibiciones/${exhibicionId}/cobrar`, {}),
      pedir(`/api/exhibiciones/${exhibicionId}/cobrar`, {}),
    ]);
    const ra = deCobro(a, `Mensualidad ${numero}`);
    const rb = deCobro(b, `Mensualidad ${numero}`);
    const misma = ra.referencia && ra.referencia === rb.referencia;
    return {
      ok: ra.ok || rb.ok,
      mensaje: `Clic 1 → ${ra.mensaje} ${ra.referencia ?? ""} · Clic 2 → ${rb.mensaje} ${rb.referencia ?? ""}${misma ? " · Misma referencia: un solo cargo." : ""}`,
      referencia: ra.referencia ?? rb.referencia,
      respuesta: { clic1: a.data, clic2: b.data },
    };
  },

  async tarjetaSinConsentimiento(planId: string): Promise<Resultado> {
    return simple(await pedir(`/api/planes/${planId}/tarjeta`, { consentimiento: false }), "El servidor preparó la tarjeta (no debió).");
  },

  async adelanto(planId: string, monto: string): Promise<Resultado> {
    const r = await pedir(`/api/planes/${planId}/recalculo`, { accion: "adelanto", monto, confirmar: true });
    if (r.ok && r.status === 200) return { ok: true, mensaje: `200 · Adelanto cobrado. El plan va en la versión ${r.data.version}.`, respuesta: r.data };
    return deCobro(r, "Adelanto");
  },

  async liquidar(planId: string): Promise<Resultado> {
    const r = await pedir(`/api/planes/${planId}/recalculo`, { accion: "liquidacion", confirmar: true });
    if (r.ok && r.status === 200) return { ok: true, mensaje: `200 · Plan liquidado (versión ${r.data.version}).`, respuesta: r.data };
    return deCobro(r, "Liquidación");
  },

  async reembolsar(pagoId: string, p: { devolverComision: boolean; motivo: string; montoCentavos?: number }): Promise<Resultado> {
    const r = await pedir(`/api/pagos/${pagoId}/reembolsar`, p);
    if (!r.ok) return simple(r, "");
    return {
      ok: true,
      mensaje: `200 · Reembolso de ${pesos(Number(r.data.montoCentavos) / 100)} enviado a Stripe.`,
      referencia: texto(r.data.referencia),
      respuesta: r.data,
    };
  },

  async liberar(planId: string): Promise<Resultado> {
    return simple(await pedir(`/api/planes/${planId}/anticipo/liberar`, {}), "Autorización liberada.");
  },

  async capturar(planId: string): Promise<Resultado> {
    return deCobro(await pedir(`/api/planes/${planId}/anticipo/capturar`, {}), "Anticipo");
  },

  async transferir(proyectoId: string, autorizadaPor: string): Promise<Resultado> {
    const r = await pedir("/api/transferencias", { proyectoId, autorizadaPor });
    if (!r.ok) return simple(r, "");
    return {
      ok: true,
      mensaje: `${r.status} · Transferencia enviada a Moretti por ${pesos(Number(r.data.neto))}.`,
      referencia: texto(r.data.referencia),
      respuesta: r.data,
    };
  },
};
