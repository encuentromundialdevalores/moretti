"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { avisar } from "@/components/admin/avisar";
import CobrarConStripe from "@/components/pagos/CobrarConStripe";
import CapturarTarjeta from "./CapturarTarjeta";
import { CASOS, ETAPAS, tarifaEstimada, type Caso, type Contexto, type Etapa, type Movimiento } from "./casos";
import { api, type Escenario, type PlanEscenario, type Resultado } from "./conexiones";

export type Ambiente = {
  modo: "prueba" | "real" | "apagado";
  apagadoPorque: string | null;
  tope: number | null;
  cobroEnLinea: boolean;
  webhook: boolean;
  captura: string;
};

type Veredicto = "pendiente" | "paso" | "fallo" | "no-aplico";

type Registro = {
  veredicto: Veredicto;
  nota: string;
  /** Lo que contestaron las acciones, la última primero. */
  respuestas?: { accion: string; ok: boolean; mensaje: string; referencia?: string; en: string }[];
};

const VEREDICTOS: { id: Veredicto; texto: string; clase: string }[] = [
  { id: "pendiente", texto: "Pendiente", clase: "wait" },
  { id: "paso", texto: "Pasó", clase: "ok" },
  { id: "fallo", texto: "Falló", clase: "late" },
  { id: "no-aplico", texto: "No aplicó", clase: "info" },
];

const MOVIMIENTO: Record<Movimiento, { texto: string; clase: string }> = {
  cobra: { texto: "Cobra", clase: "late" },
  devuelve: { texto: "Devuelve", clase: "ok" },
  retiene: { texto: "Retiene", clase: "warn" },
  transfiere: { texto: "Transfiere", clase: "info" },
  nada: { texto: "Sin cargo", clase: "wait" },
};

const ESTADO_EXH: Record<string, { texto: string; clase: string }> = {
  PAGADA: { texto: "Pagada", clase: "ok" },
  VENCIDA: { texto: "Vencida", clase: "late" },
  PENDIENTE: { texto: "Programada", clase: "wait" },
  REEMPLAZADA: { texto: "Reemplazada", clase: "info" },
  CANCELADA: { texto: "Cancelada", clase: "info" },
};

const LLAVE = "dinero-real:v2";

const pesos = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const centavos = (c: number) => pesos(c / 100);
const montoDe = (c: Caso) => (c.centavos === null ? "según el plan" : centavos(c.centavos));
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type Guardado = { registro: Record<string, Registro>; listos: string[]; autoriza: string };

// El navegador puede negar el almacenamiento (ventana privada): la página sigue igual.
function leer(): Guardado {
  try {
    const crudo = localStorage.getItem(LLAVE);
    if (crudo) return { registro: {}, listos: [], autoriza: "", ...(JSON.parse(crudo) as Partial<Guardado>) };
  } catch {}
  return { registro: {}, listos: [], autoriza: "" };
}

/**
 * La prueba con dinero real: el paso 0 (ambiente y escenario), el estado en
 * vivo de los seis planes y los casos en orden, cada uno con sus botones.
 */
export default function PruebasDineroReal({ ambiente }: { ambiente: Ambiente }) {
  // Lo guardado sólo existe en el navegador: se arma hasta estar en el cliente.
  const enCliente = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  return enCliente ? <Prueba ambiente={ambiente} /> : null;
}

function Prueba({ ambiente }: { ambiente: Ambiente }) {
  const [guardado, setGuardado] = useState<Guardado>(leer);
  const [escenario, setEscenario] = useState<Escenario | null | undefined>(undefined);
  const [etapa, setEtapa] = useState<Etapa | "todas">("todas");

  useEffect(() => {
    try {
      localStorage.setItem(LLAVE, JSON.stringify(guardado));
    } catch {}
  }, [guardado]);

  const refrescar = useCallback(async () => {
    try {
      setEscenario(await api.escenario());
    } catch (err) {
      avisar.error(err instanceof Error ? err.message : "No se pudo leer el escenario.");
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    api.escenario().then(
      (e) => vivo && setEscenario(e),
      () => vivo && setEscenario(null)
    );
    return () => {
      vivo = false;
    };
  }, []);

  const anotar = (id: string, cambio: (r: Registro) => Registro) =>
    setGuardado((g) => ({ ...g, registro: { ...g.registro, [id]: cambio(g.registro[id] ?? { veredicto: "pendiente", nota: "" }) } }));

  function copiarBitacora() {
    const filas = CASOS.map((c) => {
      const r = guardado.registro[c.id];
      const v = VEREDICTOS.find((x) => x.id === (r?.veredicto ?? "pendiente"))!.texto;
      const ultima = r?.respuestas?.[0];
      const limpio = (s: string) => s.replace(/\|/g, "/").replace(/\n/g, " ");
      return `| ${c.id} | ${c.titulo} | ${montoDe(c)} | ${v} | ${ultima?.referencia ?? ""} | ${limpio(ultima?.mensaje ?? "")} | ${limpio(r?.nota ?? "")} |`;
    });
    const t = totales(escenario ?? null);
    const texto = [
      `# Prueba con dinero real · ${new Date().toLocaleDateString("es-MX", { dateStyle: "long" })}`,
      "",
      `Modo: ${ambiente.modo} · cobrado ${pesos(t.cobrado)} · devuelto ${pesos(t.devuelto)} · transferido a Moretti ${pesos(t.transferido)} · tarifas estimadas ${pesos(t.tarifas)}`,
      "",
      "| Caso | Qué | Monto | Resultado | Referencia | Respuesta | Nota |",
      "|---|---|---|---|---|---|---|",
      ...filas,
    ].join("\n");
    navigator.clipboard.writeText(texto).then(
      () => avisar.exito("Bitácora copiada en Markdown."),
      () => avisar.error("El navegador no dejó copiar.")
    );
  }

  const t = totales(escenario ?? null);
  const marcados = CASOS.filter((c) => (guardado.registro[c.id]?.veredicto ?? "pendiente") !== "pendiente").length;
  const contexto: Contexto | null = escenario ? { escenario, autoriza: guardado.autoriza.trim() || "Prueba con dinero real" } : null;

  return (
    <>
      <PasoCero
        ambiente={ambiente}
        escenario={escenario}
        listos={guardado.listos}
        onMarcar={(id) =>
          setGuardado((g) => ({ ...g, listos: g.listos.includes(id) ? g.listos.filter((x) => x !== id) : [...g.listos, id] }))
        }
        autoriza={guardado.autoriza}
        onAutoriza={(autoriza) => setGuardado((g) => ({ ...g, autoriza }))}
        onPreparado={setEscenario}
      />

      <div className="bo-hero">
        <div className="bo-principal">
          <p className="bo-k">Casos marcados</p>
          <p className="bo-v">
            {marcados} de {CASOS.length}
          </p>
          <p className="bo-nota">Marca cada uno según lo que pasó de verdad.</p>
        </div>
        <div>
          <p className="bo-k">Cobrado</p>
          <p className="bo-v">{pesos(t.cobrado)}</p>
          <p className="bo-nota">{t.cargos} cargos en el proyecto «Prueba real».</p>
        </div>
        <div>
          <p className="bo-k">Devuelto</p>
          <p className="bo-v">{pesos(t.devuelto)}</p>
          <p className="bo-nota">Tarda de 5 a 10 días hábiles en verse en la tarjeta.</p>
        </div>
        <div>
          <p className="bo-k">Tarifas que no regresan</p>
          <p className={`bo-v ${t.tarifas > 0 ? "alerta" : ""}`}>{pesos(t.tarifas)}</p>
          <p className="bo-nota">Estimado: 3.6 % + $3 + IVA por cargo. Compáralo con Stripe › Saldos.</p>
        </div>
      </div>

      {escenario && <PanelEscenario escenario={escenario} onActualizar={refrescar} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por etapa">
          {[{ id: "todas" as const, titulo: "Todas" }, ...ETAPAS].map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={etapa === g.id}
              onClick={() => setEtapa(g.id)}
              className={`btn btn-sm ${etapa === g.id ? "" : "btn-ghost"}`}
            >
              {g.titulo}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm btn-ghost" onClick={copiarBitacora}>
            Copiar bitácora
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => confirm("¿Borrar los resultados y notas de esta página? (La base no cambia.)") && setGuardado((g) => ({ ...g, registro: {} }))}
          >
            Borrar notas
          </button>
        </div>
      </div>

      {ETAPAS.filter((g) => etapa === "todas" || g.id === etapa).map((g) => (
        <section key={g.id} className="bo-seccion">
          <div className="bo-seccion-t">
            <h2>{g.titulo}</h2>
            <span>{g.descripcion}</span>
          </div>
          {CASOS.filter((c) => c.etapa === g.id).map((c) => (
            <TarjetaCaso
              key={c.id}
              caso={c}
              registro={guardado.registro[c.id] ?? { veredicto: "pendiente", nota: "" }}
              contexto={contexto}
              ambiente={ambiente}
              onAnotar={(cambio) => anotar(c.id, cambio)}
              onRefrescar={refrescar}
            />
          ))}
        </section>
      ))}
    </>
  );
}

function totales(e: Escenario | null) {
  const pagos = e?.planes.flatMap((p) => p.exhibiciones.flatMap((x) => (x.pago ? [x.pago] : []))) ?? [];
  return {
    cargos: pagos.length,
    cobrado: pagos.reduce((a, p) => a + p.monto, 0),
    devuelto: pagos.reduce((a, p) => a + p.reembolsado, 0),
    tarifas: pagos.reduce((a, p) => a + tarifaEstimada(Math.round(p.monto * 100)), 0) / 100,
    transferido: (e?.transferencias ?? []).filter((x) => x.estado === "ENVIADA").reduce((a, x) => a + (x.neto ?? 0), 0),
  };
}

// ── Paso 0 ────────────────────────────────────────────────────────────────

const EVENTOS_WEBHOOK =
  "setup_intent.succeeded,payment_method.automatically_updated,payment_intent.succeeded,payment_intent.payment_failed,payment_intent.amount_capturable_updated,payment_intent.canceled,charge.refunded,charge.dispute.created,charge.dispute.closed";

const ENV_REAL = `# Prueba con dinero real (lib/pasarela/modo.ts). Borrar al terminar.
DATABASE_URL="postgresql://TU_USUARIO@localhost:5432/moretti_prueba_real?schema=public"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_SECRET_KEY="rk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_MODO_REAL="1"
# Opcional: tope por cobro en centavos (por defecto 30000 = $300).
STRIPE_TOPE_CENTAVOS="30000"
# Sólo para los casos K1 y K2; si no, déjalo en automatic.
STRIPE_CAPTURE_METHOD="automatic"`;

const PASOS_CERO: { id: string; titulo: string; detalle: React.ReactNode }[] = [
  {
    id: "base",
    titulo: "Una base aparte",
    detalle: (
      <>
        <p>
          Crea una base nueva (por ejemplo <code>moretti_prueba_real</code>) y apunta <code>DATABASE_URL</code> a ella. Así
          el barrido y los cobros nunca tocan los planes de la demo. En WSL, desde <code>/mnt/c/moretti-main</code>:
        </p>
        <Codigo>{`createdb moretti_prueba_real\nnpx prisma migrate deploy\nnpm run db:seed`}</Codigo>
        <p>El seed hace falta: trae los paquetes y las partidas con los que se arma el proyecto de prueba.</p>
      </>
    ),
  },
  {
    id: "llaves",
    titulo: "Las llaves reales",
    detalle: (
      <>
        <p>En el Dashboard de Stripe cambia a <b>modo real</b> (arriba a la derecha, quita «Modo de prueba»).</p>
        <ol className="list-decimal pl-5">
          <li>
            Desarrolladores › Claves de API › <b>Clave publicable</b> (<code>pk_live_…</code>) →{" "}
            <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>.
          </li>
          <li>
            «Crear clave restringida» (<code>rk_live_…</code>) con <b>Escritura</b> en Customers, PaymentIntents, SetupIntents,
            Refunds y Transfers, y <b>Lectura</b> en Charges, Disputes y PaymentMethods → <code>STRIPE_SECRET_KEY</code>. Si
            algún caso contesta que la llave no tiene permiso, agrégale ese recurso y sigue.
          </li>
          <li>
            <code>STRIPE_MODO_REAL=&quot;1&quot;</code>. Sin esta bandera las llaves reales no hacen nada.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "webhook",
    titulo: "El webhook real",
    detalle: (
      <>
        <p>
          <b>Si corres en tu máquina</b>: en otra terminal de WSL, con la Stripe CLI dada de alta en tu cuenta (
          <code>stripe login</code>):
        </p>
        <Codigo>{`stripe listen --live \\\n  --events ${EVENTOS_WEBHOOK} \\\n  --forward-to localhost:3000/api/stripe/webhook`}</Codigo>
        <p>
          Copia el <code>whsec_…</code> que imprime a <code>STRIPE_WEBHOOK_SECRET</code>. Deja esa terminal abierta toda la prueba.
        </p>
        <p>
          <b>Si está desplegado</b>: Desarrolladores › Webhooks › «Agregar destino» › «Tu cuenta», URL{" "}
          <code>https://&lt;dominio&gt;/api/stripe/webhook</code>, con los eventos de arriba. Su secreto de firma va en{" "}
          <code>STRIPE_WEBHOOK_SECRET</code>.
        </p>
      </>
    ),
  },
  {
    id: "env",
    titulo: "El .env completo",
    detalle: (
      <>
        <p>Así queda la parte de Stripe (deja igual lo demás: sesión, contraseña del back office):</p>
        <Codigo>{ENV_REAL}</Codigo>
        <p>
          Reinicia <code>npm run dev</code> (Ctrl+C y otra vez) y recarga esta página. El chip de arriba debe decir{" "}
          <b>Modo real</b>.
        </p>
      </>
    ),
  },
  {
    id: "moretti",
    titulo: "La cuenta real de Moretti",
    detalle: (
      <p>
        Moretti tiene que haber terminado su alta en Connect (datos fiscales y CLABE). En Stripe › Connect › Cuentas, ábrela y
        copia su id <code>acct_…</code>. La necesitas en el formulario de abajo.
      </p>
    ),
  },
];

function Codigo({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 pr-20 font-mono text-[12px] leading-relaxed text-ink">{children}</pre>
      <button
        type="button"
        className="absolute right-2 top-2 rounded border border-line-2 bg-surface px-2 py-0.5 text-[11px] text-ink-2 hover:text-ink"
        onClick={() =>
          navigator.clipboard.writeText(children).then(
            () => avisar.exito("Copiado."),
            () => avisar.error("El navegador no dejó copiar.")
          )
        }
      >
        Copiar
      </button>
    </div>
  );
}

function PasoCero({
  ambiente,
  escenario,
  listos,
  onMarcar,
  autoriza,
  onAutoriza,
  onPreparado,
}: {
  ambiente: Ambiente;
  escenario: Escenario | null | undefined;
  listos: string[];
  onMarcar: (id: string) => void;
  autoriza: string;
  onAutoriza: (v: string) => void;
  onPreparado: (e: Escenario) => void;
}) {
  const [cuenta, setCuenta] = useState("");
  const [comision, setComision] = useState("15");
  const [correo, setCorreo] = useState("");
  const [preparando, setPreparando] = useState(false);
  const listo = Boolean(escenario);

  async function preparar() {
    setPreparando(true);
    try {
      const r = await api.preparar({ cuentaConectada: cuenta.trim(), comision: Number(comision) / 100, correo: correo.trim() || undefined });
      if (!r.ok) return avisar.error(r.mensaje);
      onPreparado((r.respuesta as { escenario: Escenario }).escenario);
      avisar.exito("Escenario listo: seis planes con contrato firmado.");
    } catch {
      avisar.error("Sin conexión con el servidor.");
    } finally {
      setPreparando(false);
    }
  }

  return (
    <details className="bo-card" open={!listo}>
      <summary className="cursor-pointer text-[19px] font-semibold">
        0 · Antes de empezar {listo ? <span className="chip ok ml-2 align-middle">Escenario listo</span> : null}
      </summary>
      <div className="mt-5 flex flex-col gap-6">
        <p className="max-w-[75ch] text-[14px] text-ink-2">
          Una sola vez. Tú pones el <code>.env</code>; la página arma lo demás. Ve marcando cada paso. Si quieres ensayar
          primero, hazlo todo con llaves de prueba (<code>pk_test_</code>, <code>sk_test_</code>, sin <code>STRIPE_MODO_REAL</code>)
          y tarjetas 4242: los casos son los mismos.
        </p>

        <ol className="flex flex-col gap-4">
          {PASOS_CERO.map((p, i) => (
            <li key={p.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[var(--accent)]"
                checked={listos.includes(p.id)}
                onChange={() => onMarcar(p.id)}
                aria-label={`Paso ${i + 1} listo`}
              />
              <div className="flex min-w-0 flex-col gap-2 text-[14px] text-ink-2">
                <p className="font-semibold text-ink">
                  {i + 1}. {p.titulo}
                </p>
                {p.detalle}
              </div>
            </li>
          ))}
        </ol>

        <div className="grid gap-2 rounded-lg border border-line p-4 text-[13.5px]">
          <p className="label">Cómo está este ambiente ahora</p>
          <p>
            Stripe: <b>{ambiente.modo === "real" ? "modo real" : ambiente.modo === "prueba" ? "modo prueba (ensayo)" : "apagado"}</b>
            {ambiente.apagadoPorque ? ` · ${ambiente.apagadoPorque}` : ""}
          </p>
          <p>
            Tope por cobro: <b>{ambiente.tope === null ? "sin tope (sólo hay tope en modo real)" : centavos(ambiente.tope)}</b> · Captura
            del anticipo: <b>{ambiente.captura}</b> · Webhook: <b>{ambiente.webhook ? "con secreto" : "falta STRIPE_WEBHOOK_SECRET"}</b>
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-line p-4">
          <div>
            <p className="font-semibold">6. Preparar el proyecto de prueba</p>
            <p className="mt-1 text-[13.5px] text-ink-2">
              Crea el proyecto «Prueba real» con precios tan bajos que cada cobro es de $10, y seis planes (A–F) con el contrato
              firmado, uno por escenario. No cobra nada. Si ya existe, sólo actualiza la cuenta y la comisión.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="field">
              <span>Cuenta de Moretti</span>
              <input value={cuenta} onChange={(e) => setCuenta(e.target.value)} placeholder="acct_…" className="font-mono" spellCheck={false} />
            </label>
            <label className="field">
              <span>Comisión del canal (%)</span>
              <input type="number" step="0.01" min={0} max={50} value={comision} onChange={(e) => setComision(e.target.value)} />
            </label>
            <label className="field">
              <span>Correo para los recibos (opcional)</span>
              <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tu@correo.com" />
            </label>
          </div>
          <button
            type="button"
            className="btn btn-sm self-start"
            disabled={preparando || !/^acct_[A-Za-z0-9]+$/.test(cuenta.trim())}
            onClick={preparar}
          >
            {preparando ? "Preparando…" : listo ? "Actualizar el proyecto de prueba" : "Preparar el proyecto de prueba"}
          </button>
        </div>

        <label className="field max-w-[360px]">
          <span>Quién autoriza las transferencias</span>
          <input value={autoriza} onChange={(e) => onAutoriza(e.target.value)} placeholder="Tu nombre" />
          <span className="text-[12px] text-muted">Queda en el registro de «Pagos a Moretti» (casos M1 y M2).</span>
        </label>
      </div>
    </details>
  );
}

// ── Estado del escenario ──────────────────────────────────────────────────

function PanelEscenario({ escenario, onActualizar }: { escenario: Escenario; onActualizar: () => Promise<void> }) {
  const [cargando, setCargando] = useState(false);
  return (
    <section className="bo-seccion">
      <div className="bo-seccion-t">
        <h2>Los seis planes</h2>
        <span>
          Proyecto «Prueba real» · comisión {(escenario.proyecto.comision * 100).toFixed(2)} % · Moretti{" "}
          <code>{escenario.proyecto.cuentaConectada ?? "sin cuenta"}</code>
        </span>
        <button
          type="button"
          className="btn btn-sm btn-ghost ml-auto"
          disabled={cargando}
          onClick={async () => {
            setCargando(true);
            await onActualizar();
            setCargando(false);
          }}
        >
          {cargando ? "Actualizando…" : "Actualizar"}
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {escenario.planes.map((p) => (
          <div key={p.id} className="flex flex-col gap-2 rounded-[16px] border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">
                Plan {p.letra} <span className="text-[12px] font-normal text-muted">· {p.unidad}</span>
              </p>
              <span className={`chip ${p.estado === "ACTIVO" || p.estado === "LIQUIDADO" ? "ok" : p.estado === "SUSPENDIDO" ? "late" : "wait"}`}>
                {p.estado.toLowerCase()}
              </span>
            </div>
            <p className="text-[12.5px] text-ink-2">{p.nombre}</p>
            <Cinta plan={p} />
            <p className="text-[12.5px] text-muted">
              Saldo {pesos(p.saldo)} de {pesos(p.total)} · {p.tarjeta ? `${p.tarjeta}${p.tarjetaInvalida ? " (inválida)" : ""}` : "sin tarjeta"}
            </p>
            <Link href={`/admin/planes/${p.id}`} className="text-[12.5px] font-semibold text-accent hover:underline" target="_blank">
              Abrir en el back office ↗
            </Link>
          </div>
        ))}
      </div>
      <details className="rounded-[16px] border border-line bg-surface p-4">
        <summary className="cursor-pointer text-[14px] font-semibold">
          Eventos de Stripe y bitácora ({escenario.eventosStripe.length} · {escenario.eventos.length})
        </summary>
        <div className="mt-3 grid gap-5 lg:grid-cols-2">
          <div>
            <p className="label mb-2">Lo último que llegó al webhook</p>
            <ul className="flex flex-col gap-1 text-[12.5px]">
              {escenario.eventosStripe.length === 0 && <li className="text-muted">Nada todavía.</li>}
              {escenario.eventosStripe.map((e, i) => (
                <li key={i}>
                  <span className="text-muted">{fechaHora(e.fecha)}</span> · <code>{e.tipo}</code> ·{" "}
                  {e.procesado ? <span className="text-accent">procesado</span> : <span className="text-warm">sin procesar</span>}
                  {e.nota && <span className="text-muted"> · {e.nota}</span>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label mb-2">Bitácora del proyecto</p>
            <ul className="flex flex-col gap-1.5 text-[12.5px]">
              {escenario.eventos.map((e, i) => (
                <li key={i}>
                  <span className="text-muted">{fechaHora(e.fecha)}</span> · <code>{e.tipo}</code>
                  {e.comentario && <span className="block text-ink-2">{e.comentario}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
        {escenario.transferencias.length > 0 && (
          <div className="mt-4">
            <p className="label mb-2">Transferencias a Moretti</p>
            <ul className="flex flex-col gap-1 text-[12.5px]">
              {escenario.transferencias.map((x) => (
                <li key={x.id}>
                  {fechaHora(x.fecha)} · {x.estado.toLowerCase()} · neto {pesos(x.neto ?? 0)} {x.referencia && <code>{x.referencia}</code>}
                  {x.error && <span className="text-warm"> · {x.error}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </details>
    </section>
  );
}

function Cinta({ plan }: { plan: PlanEscenario }) {
  const vivas = plan.exhibiciones.filter((e) => e.estado !== "REEMPLAZADA");
  return (
    <div className="flex gap-[3px]" aria-label={`Exhibiciones del plan ${plan.letra}`}>
      {vivas.map((e) => (
        <span
          key={e.id}
          title={`${e.numero === 0 ? "Anticipo" : `#${e.numero}`} · ${ESTADO_EXH[e.estado]?.texto ?? e.estado}`}
          className={`h-2.5 flex-1 rounded-sm ${
            e.estado === "PAGADA"
              ? e.pago && e.pago.reembolsado > 0
                ? "bg-[var(--amber)]"
                : "bg-[var(--accent)]"
              : e.estado === "VENCIDA"
                ? "bg-[var(--warm)]"
                : "bg-surface-2"
          } ${e.numero === 0 ? "max-w-[22px]" : ""}`}
        />
      ))}
    </div>
  );
}

function EstadoPlan({ plan, eventos }: { plan: PlanEscenario; eventos: Escenario["eventos"] }) {
  const suyos = eventos.filter((e) => e.planId === plan.id).slice(0, 5);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-ink-2">
        {plan.estado.toLowerCase()} · versión {plan.version} · saldo {pesos(plan.saldo)} · tarjeta: {plan.tarjeta ?? "sin tarjeta"}
        {plan.tarjetaInvalida ? " (inválida)" : ""}
      </p>
      <div className="overflow-x-auto">
        <table className="tbl text-[12.5px]">
          <thead>
            <tr>
              <th>#</th>
              <th className="r">Monto</th>
              <th>Estado</th>
              <th>Detalle</th>
              <th>Referencia</th>
            </tr>
          </thead>
          <tbody>
            {plan.exhibiciones.map((e) => {
              const detalle = [
                e.intentosRechazados > 0 && `${e.intentosRechazados} rechazo${e.intentosRechazados > 1 ? "s" : ""}`,
                e.ultimoCodigoRechazo && `código ${e.ultimoCodigoRechazo}`,
                e.requiereTarjetaNueva && "pide tarjeta nueva",
                e.proximoIntentoEn && `reintenta ${new Date(e.proximoIntentoEn).toLocaleDateString("es-MX")}`,
                e.pendiente && `pendiente ${e.pendiente}`,
                e.pago && e.pago.reembolsado > 0 &&
                  `reembolsado ${pesos(e.pago.reembolsado)} (${e.pago.reembolsos.map((r) => (r.origen === "BACK_OFFICE" ? "back office" : r.origen === "DASHBOARD_MORETTI" ? "Dashboard" : r.origen)).join(", ")})`,
                e.pago?.transferida && "transferido a Moretti",
                e.estado !== "PAGADA" && e.numero > 0 && new Date(e.fecha) < new Date() && "ya venció",
              ].filter(Boolean);
              return (
                <tr key={e.id}>
                  <td className="text-muted">{e.tipo === "ADELANTO" ? "Adel." : e.tipo === "LIQUIDACION" ? "Liq." : e.numero === 0 ? "Ant." : e.numero}</td>
                  <td className="r">{pesos(e.monto)}</td>
                  <td>
                    <span className={`chip ${ESTADO_EXH[e.estado]?.clase ?? "wait"}`}>{ESTADO_EXH[e.estado]?.texto ?? e.estado}</span>
                  </td>
                  <td className="text-ink-2">{detalle.join(" · ") || "—"}</td>
                  <td className="font-mono text-[11px] text-muted">{e.pago?.referencia ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {suyos.length > 0 && (
        <ul className="flex flex-col gap-1 text-[12px] text-ink-2">
          {suyos.map((e, i) => (
            <li key={i}>
              <span className="text-muted">{fechaHora(e.fecha)}</span> · {e.comentario ?? e.tipo}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Un caso ───────────────────────────────────────────────────────────────

function TarjetaCaso({
  caso,
  registro,
  contexto,
  ambiente,
  onAnotar,
  onRefrescar,
}: {
  caso: Caso;
  registro: Registro;
  contexto: Contexto | null;
  ambiente: Ambiente;
  onAnotar: (cambio: (r: Registro) => Registro) => void;
  onRefrescar: () => Promise<void>;
}) {
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [ejecutando, setEjecutando] = useState<number | null>(null);
  const mov = MOVIMIENTO[caso.movimiento];
  const veredicto = VEREDICTOS.find((v) => v.id === registro.veredicto)!;
  const plan = contexto && caso.letra ? contexto.escenario.planes.find((p) => p.letra === caso.letra) ?? null : null;

  function guardarRespuesta(accion: string, r: Resultado) {
    onAnotar((x) => ({
      ...x,
      respuestas: [{ accion, ok: r.ok, mensaje: r.mensaje, referencia: r.referencia, en: new Date().toISOString() }, ...(x.respuestas ?? [])].slice(0, 6),
    }));
  }

  async function ejecutar(i: number) {
    const accion = caso.acciones![i];
    setConfirmando(null);
    setEjecutando(i);
    try {
      if (!contexto) throw new Error("Primero prepara el escenario (paso 0).");
      guardarRespuesta(accion.etiqueta, await accion.ejecutar(contexto));
    } catch (err) {
      guardarRespuesta(accion.etiqueta, { ok: false, mensaje: err instanceof Error ? err.message : "La acción falló." });
    } finally {
      setEjecutando(null);
      await onRefrescar();
    }
  }

  return (
    <article className="bo-card flex flex-col gap-5" aria-labelledby={`caso-${caso.id}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[12px] text-muted">
            {caso.id} · {caso.actor}
            {caso.letra && ` · plan ${caso.letra}`}
          </p>
          <h3 id={`caso-${caso.id}`} className="mt-1 text-[17px] font-semibold">
            {caso.titulo}
          </h3>
          <p className="mt-1 max-w-[70ch] text-[14px] text-ink-2">{caso.objetivo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${mov.clase}`}>
            {mov.texto} · {montoDe(caso)}
          </span>
          <span className={`chip ${veredicto.clase}`}>{veredicto.texto}</span>
        </div>
      </header>

      {caso.antes && (
        <div className="note text-[13.5px]">
          <b>Antes:</b> {caso.antes.join(" ")}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="label">Paso a paso</p>
          {plan && (
            <Link href={`/admin/planes/${plan.id}`} target="_blank" className="text-[12.5px] font-semibold text-accent hover:underline">
              Abrir el plan {plan.letra} en el back office ↗
            </Link>
          )}
        </div>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[14px] text-ink-2">
          {caso.pasos.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
      </div>

      {caso.panel && (
        <div className="rounded-lg border border-dashed border-line-2 p-4">
          <p className="label mb-3">{caso.panel === "anticipo" ? `El anticipo del plan ${caso.letra}` : `Tarjeta del plan ${caso.letra}`}</p>
          {!plan ? (
            <p className="text-[13px] text-muted">Prepara el escenario (paso 0) para que aparezca.</p>
          ) : caso.panel === "anticipo" ? (
            <PanelAnticipo plan={plan} cobroEnLinea={ambiente.cobroEnLinea} onCambio={onRefrescar} />
          ) : (
            <CapturarTarjeta planId={plan.id} habilitado={ambiente.cobroEnLinea} onGuardada={() => void onRefrescar()} />
          )}
        </div>
      )}

      {caso.acciones && (
        <div className="flex flex-wrap items-center gap-3">
          {caso.acciones.map((a, i) =>
            confirmando === i ? (
              <span key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-warm-soft px-3 py-2 text-[13px]">
                <span>
                  {ambiente.modo === "real" ? <b>Dinero real. </b> : null}
                  {a.confirmar} ¿Seguimos?
                </span>
                <button type="button" className="btn btn-sm btn-warm" onClick={() => ejecutar(i)}>
                  Sí
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmando(null)}>
                  No
                </button>
              </span>
            ) : (
              <button
                key={i}
                type="button"
                className="btn btn-sm"
                disabled={ejecutando !== null || !contexto}
                onClick={() => (a.confirmar ? setConfirmando(i) : ejecutar(i))}
              >
                {ejecutando === i ? "Ejecutando…" : `${caso.acciones!.length > 1 ? `${i + 1}. ` : ""}${a.etiqueta}`}
              </button>
            )
          )}
          {!contexto && <span className="text-[12.5px] text-warm">Primero prepara el escenario (paso 0).</span>}
        </div>
      )}

      {registro.respuestas && registro.respuestas.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-lg bg-surface-2 p-3 text-[13px]" role="status">
          {registro.respuestas.map((r, i) => (
            <li key={i} className={i > 0 ? "text-muted" : ""}>
              <span className={`mr-2 font-semibold ${r.ok ? "text-accent" : "text-warm"}`}>{r.accion}</span>
              {r.mensaje}
              {r.referencia && <code className="ml-2 text-[11.5px]">{r.referencia}</code>}
              <span className="ml-2 text-[11px] text-muted">{fechaHora(r.en)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="label">Qué tiene que pasar</p>
          <dl className="grid grid-cols-[80px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13.5px]">
            <dt className="text-muted">Pantalla</dt>
            <dd className="text-ink-2">{caso.esperado.pantalla}</dd>
            <dt className="text-muted">Stripe</dt>
            <dd className="text-ink-2">{caso.esperado.stripe}</dd>
            <dt className="text-muted">Base</dt>
            <dd className="text-ink-2">{caso.esperado.base}</dd>
            <dt className="text-muted">Tu dinero</dt>
            <dd className="font-medium text-ink">{caso.esperado.dinero}</dd>
          </dl>
        </div>
        <div className="flex flex-col gap-4 text-[13.5px]">
          {caso.comprobar.length > 0 && (
            <div>
              <p className="label mb-2">Dónde comprobarlo</p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-ink-2">
                {caso.comprobar.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          <p>
            <span className="label block">Costo que no regresa</span>
            <span className="text-ink-2">{caso.costo}</span>
          </p>
          <p>
            <span className="label block">Cómo se revierte</span>
            <span className="text-ink-2">{caso.revertir}</span>
          </p>
        </div>
      </div>

      {caso.ojo && (
        <p className="note blocked text-[13.5px]">
          <b>Ojo:</b> {caso.ojo}
        </p>
      )}

      {plan && (
        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-[13px] font-semibold">Estado del plan {plan.letra} ahora</summary>
          <div className="mt-3">
            <EstadoPlan plan={plan} eventos={contexto!.escenario.eventos} />
          </div>
        </details>
      )}

      <footer className="flex flex-col gap-3 border-t border-line pt-4">
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={`Resultado de ${caso.id}`}>
          <span className="label mr-1">¿Pasó lo que tenía que pasar?</span>
          {VEREDICTOS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={registro.veredicto === v.id}
              onClick={() => onAnotar((x) => ({ ...x, veredicto: v.id }))}
              className={`btn btn-sm ${registro.veredicto === v.id ? "" : "btn-ghost"}`}
            >
              {v.texto}
            </button>
          ))}
        </div>
        <textarea
          rows={2}
          value={registro.nota}
          onChange={(e) => onAnotar((x) => ({ ...x, nota: e.target.value }))}
          placeholder="Qué pasó de verdad: código del banco, lo que se vio en el estado de cuenta, lo que no cuadró…"
          aria-label={`Nota de ${caso.id}`}
          className="text-[13.5px]"
        />
      </footer>
    </article>
  );
}

/** El mismo componente que cobra el anticipo en el back office y en el sitio. */
function PanelAnticipo({ plan, cobroEnLinea, onCambio }: { plan: PlanEscenario; cobroEnLinea: boolean; onCambio: () => Promise<void> }) {
  const anticipo = plan.exhibiciones.find((e) => e.numero === 0)!;
  if (anticipo.estado === "PAGADA") {
    return (
      <p className="text-[13px] text-ink-2">
        El anticipo del plan {plan.letra} ya está pagado (<code>{anticipo.pago?.referencia}</code>).
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <CobrarConStripe
        // Se vuelve a montar cuando cambia el anticipo: después de un rechazo o una autorización liberada.
        key={`${anticipo.id}:${anticipo.intentosRechazados}:${anticipo.pendiente ?? ""}`}
        planId={plan.id}
        exhibicionId={anticipo.id}
        bloqueado={false}
        stripeTestConfigurado={cobroEnLinea}
        tarjetaRegistrada={plan.tarjeta}
        onPagado={() => void onCambio()}
      />
      {anticipo.pendiente && (
        <p className="text-[12.5px] text-muted">
          Hay un cobro autorizado sin capturar (<code>{anticipo.pendiente}</code>): usa los botones de captura o liberación.
        </p>
      )}
      <button type="button" className="self-start text-[12px] text-muted hover:text-ink" onClick={() => void onCambio()}>
        Actualizar el estado
      </button>
    </div>
  );
}
