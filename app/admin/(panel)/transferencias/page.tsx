import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { PageHead, Money } from "@/components/ui";
import { Estado, IconoAviso } from "@/components/admin/Bo";
import { retenidoPorProyecto } from "@/lib/motor/transferencias";
import Link from "next/link";
import { EstadoPago } from "@prisma/client";
import AutorizarForm from "./AutorizarForm";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const ESTADO = { EN_PROCESO: ["warn", "En proceso"], ENVIADA: ["ok", "Enviada"], FALLIDA: ["late", "Fallida"] } as const;

/**
 * D-34: lo que la plataforma tiene retenido de cada proyecto y las
 * transferencias a Moretti. Ana Cris decide cuándo pagar. Cada proyecto se
 * lee como una cuenta: cobrado − comisión = a transferir (D-47).
 */
export default async function TransferenciasPage() {
  await connection();
  const [retenido, historial, pagos] = await Promise.all([
    retenidoPorProyecto(),
    prisma.transferenciaMoretti.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.pago.findMany({
      where: { estado: EstadoPago.CONFIRMADO },
      select: {
        fecha: true,
        monto: true,
        montoComision: true,
        transferencia: { select: { estado: true } },
        plan: { select: { comprador: { select: { unidad: { select: { id: true, torre: true, numero: true } } } } } },
      },
      orderBy: { fecha: "desc" },
    }),
  ]);

  // Por mes y, dentro, por unidad (Sprint 5): cuánto le toca a Moretti de cada venta.
  type Renglon = { unidadId: string; unidad: string; pagos: number; cobrado: number; comision: number; transferido: number };
  const porMes = new Map<string, Map<string, Renglon>>();
  for (const p of pagos) {
    const mes = p.fecha.toISOString().slice(0, 7);
    const u = p.plan.comprador.unidad;
    const deMes = porMes.get(mes) ?? new Map<string, Renglon>();
    const r = deMes.get(u.id) ?? { unidadId: u.id, unidad: `${u.torre} ${u.numero}`, pagos: 0, cobrado: 0, comision: 0, transferido: 0 };
    r.pagos += 1;
    r.cobrado += Number(p.monto);
    r.comision += Number(p.montoComision);
    if (p.transferencia?.estado === "ENVIADA") r.transferido += Number(p.monto) - Number(p.montoComision);
    deMes.set(u.id, r);
    porMes.set(mes, deMes);
  }
  const nombre = new Map(retenido.map((r) => [r.proyectoId, r.proyecto]));

  const total = (k: "bruto" | "comision" | "neto" | "pagos") => retenido.reduce((a, r) => a + r[k], 0);
  const sinCuenta = retenido.filter((r) => r.pagos > 0 && !r.cuentaConfigurada);
  const enviado = historial.filter((t) => t.estado === "ENVIADA").reduce((a, t) => a + Number(t.neto), 0);

  return (
    <div className="flex flex-col gap-8">
      <PageHead
        eyebrow="Pagos a Moretti"
        titulo="Lo retenido y lo transferido."
        descripcion="La plataforma cobra y retiene. Moretti recibe lo cobrado menos la comisión del canal cuando lo autorizas aquí."
      />

      <div className="bo-hero">
        <div className="bo-principal">
          <p className="bo-k">Listo para transferir</p>
          <p className="bo-v"><Money valor={total("neto")} conCentavos /></p>
          <p className="bo-nota">{total("pagos")} cobros retenidos</p>
        </div>
        <div>
          <p className="bo-k">Cobrado</p>
          <p className="bo-v"><Money valor={total("bruto")} /></p>
          <p className="bo-nota">Retenido hoy</p>
        </div>
        <div>
          <p className="bo-k">Comisión del canal</p>
          <p className="bo-v"><Money valor={total("comision")} /></p>
          <p className="bo-nota">Se queda en la plataforma</p>
        </div>
        <div>
          <p className="bo-k">Ya transferido</p>
          <p className="bo-v"><Money valor={enviado} /></p>
          <p className="bo-nota">{historial.length} {historial.length === 1 ? "transferencia" : "transferencias"}</p>
        </div>
      </div>

      {sinCuenta.length > 0 && (
        <Estado tipo="aviso" titulo="Falta conectar la cuenta de Stripe de Moretti">
          Sin ella no se puede transferir lo de {sinCuenta.map((r) => r.proyecto).join(" y ")}. Se configura en el proyecto.
        </Estado>
      )}

      <section className="bo-seccion">
        <div className="bo-seccion-t">
          <h2>Por proyecto</h2>
          <span>Lo que la plataforma tiene de cada uno.</span>
        </div>
        {retenido.map((r) => (
          <div key={r.proyectoId} className="bo-card bo-mor">
            <div>
              <div className="bo-mor-cab">
                <h3>{r.proyecto}</h3>
                <span>{r.pagos} {r.pagos === 1 ? "cobro" : "cobros"}</span>
              </div>
              <div className="bo-cuenta">
                <div><p className="bo-k">Cobrado</p><p className="bo-v"><Money valor={r.bruto} conCentavos /></p></div>
                <span className="op" aria-hidden="true">−</span>
                <div><p className="bo-k">Comisión</p><p className="bo-v text-muted"><Money valor={r.comision} conCentavos /></p></div>
                <span className="op" aria-hidden="true">=</span>
                <div className="total"><p className="bo-k">A transferir</p><p className="bo-v"><Money valor={r.neto} conCentavos /></p></div>
              </div>
            </div>
            {r.pagos === 0 ? (
              <p className="bo-nada">Nada retenido por ahora.</p>
            ) : !r.cuentaConfigurada ? (
              <p className="bo-falta"><IconoAviso />Falta la cuenta de Stripe de Moretti para este proyecto.</p>
            ) : (
              <AutorizarForm proyectoId={r.proyectoId} neto={`$${r.neto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`} />
            )}
          </div>
        ))}
      </section>

      <section className="bo-seccion">
        <div className="bo-seccion-t">
          <h2>Transferencias</h2>
          <span>Las últimas 50.</span>
        </div>
        {historial.length === 0 ? (
          <p className="note">Todavía no se ha transferido nada a Moretti.</p>
        ) : (
          <ol className="bo-lista bo-hist">
            {historial.map((t) => (
              <li key={t.id}>
                <span className={`bo-hist-punto ${ESTADO[t.estado][0]}`} aria-hidden="true" />
                <div className="bo-quien">
                  <b>{nombre.get(t.proyectoId) ?? "—"} · <Money valor={Number(t.neto)} conCentavos /></b>
                  <span>
                    {t.createdAt.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · autorizó {t.autorizadaPor}
                    {(t.referencia ?? t.error) && <> · <span className="font-mono text-[11px]">{t.referencia ?? t.error}</span></>}
                  </span>
                </div>
                <span className={`chip ${ESTADO[t.estado][0]}`}>{ESTADO[t.estado][1]}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="bo-seccion">
        <div className="bo-seccion-t">
          <h2>Por mes y por unidad</h2>
          <span>Lo cobrado de cada venta, la comisión y lo que le toca a Moretti</span>
        </div>
        {porMes.size === 0 ? <p className="note">Todavía no hay cobros.</p> : [...porMes].map(([mes, deMes]) => {
          const filas = [...deMes.values()].sort((a, b) => a.unidad.localeCompare(b.unidad));
          const suma = (k: "cobrado" | "comision" | "transferido") => filas.reduce((a, f) => a + f[k], 0);
          return (
            <details key={mes} className="bo-plegable" open={mes === [...porMes.keys()][0]}>
              <summary>
                <span>{MESES[Number(mes.slice(5)) - 1]} {mes.slice(0, 4)}</span>
                <small>{filas.length} {filas.length === 1 ? "unidad" : "unidades"} · a Moretti <Money valor={suma("cobrado") - suma("comision")} conCentavos /></small>
              </summary>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Unidad</th><th className="r">Pagos</th><th className="r">Cobrado</th><th className="r">Comisión</th><th className="r">A Moretti</th><th className="r">Transferido</th></tr></thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.unidadId}>
                        <td><Link href={`/admin/obra?u=${f.unidadId}`} className="btn btn-sm btn-ghost">{f.unidad}</Link></td>
                        <td className="r">{f.pagos}</td>
                        <td className="r"><Money valor={f.cobrado} conCentavos /></td>
                        <td className="r text-ink-2"><Money valor={f.comision} conCentavos /></td>
                        <td className="r font-semibold"><Money valor={f.cobrado - f.comision} conCentavos /></td>
                        <td className="r">{f.transferido > 0 ? <Money valor={f.transferido} conCentavos /> : <span className="chip wait">Retenido</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </section>
    </div>
  );
}
