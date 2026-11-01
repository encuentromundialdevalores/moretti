import type { Rol } from "@prisma/client";
import Modal from "./Modal";
import FaseFila from "./FaseFila";
import ObservacionForm from "./ObservacionForm";
import ActaForm from "./ActaForm";
import { fechaCorta } from "./Chips";
import Factura from "./Factura";
import { Money } from "@/components/ui";
import { detalleUnidad, facturasDeUnidad } from "@/lib/portal-datos";
import { conceptoExhibicion } from "@/lib/motor/recalculo";
import { FASE, FASES, puedeEditarFase, puedeObservar, vistaFases } from "@/lib/fases";
import { ETIQUETA_ROL } from "@/lib/permisos";

const dia = (f: Date | null) => (f ? f.toISOString().slice(0, 10) : null);
const ICONO_DOC = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>;

/**
 * El pop-up de una unidad (Sprint 5): qué se vendió, las 6 fases con sus
 * fechas, las observaciones y los documentos de ese cliente. Cada quien
 * edita sólo sus fases; las demás se ven.
 */
export default async function DetalleUnidad({ unidadId, rol, cerrar, admin = false }: { unidadId: string; rol: Rol; cerrar: string; admin?: boolean }) {
  // El back office escribe por /api/obra/* (sesión de día uno); el portal, por /api/portal/*.
  const api = admin ? "/api/obra" : "/api/portal";
  const x = await detalleUnidad(unidadId);
  if (!x) return null;
  const plan = x.comprador?.planes[0];
  const fases = vistaFases(x.fases, x.estadoOperativo, x.estadoInstalacion);
  const hoy = new Date().toISOString().slice(0, 10);
  // El verificador no ve pagos (D-48): sin facturas.
  const facturas = plan && rol !== "VERIFICADOR" ? await facturasDeUnidad(plan.id) : { complementos: [], comisiones: [] };
  const faltaActa = !admin && rol !== "MORETTI" && !x.actaEntrega && fases.find((f) => f.fase === "REVISION_INSTALACION")?.actual;
  const titulo = `${x.torre} ${x.numero}`;

  return (
    <Modal cerrar={cerrar} titulo={`Unidad ${titulo}`}>
      <header className="pt-det-cab">
        <p className="pt-hola">{x.proyecto.nombre}</p>
        <h2>{titulo}</h2>
        <p>
          {x.comprador?.nombre} · Folio {x.comprador?.folio} · Prototipo {x.prototipo.clave} ({x.prototipo.recamaras} rec.) · Paquete {plan?.paquete.nombre ?? "—"}
        </p>
      </header>

      <section className="pt-det-sec">
        <h3>Fases de obra</h3>
        <ol className="pt-fases">
          {fases.map((f) => {
            const d = FASE[f.fase];
            return (
              <FaseFila
                key={f.fase}
                unidadId={x.id}
                fase={f.fase}
                nombre={d.nombre}
                etiquetaFecha={d.fecha}
                responsable={d.responsable === "MORETTI" ? "Moretti" : "Verificador"}
                ayuda={d.ayuda}
                fecha={dia(f.fechaEstimada)}
                cumplida={f.cumplida}
                cumplidaTexto={f.cumplidaEn ? `Cumplida el ${fechaCorta(f.cumplidaEn)}${f.cumplidaPor ? ` · ${f.cumplidaPor}` : ""}` : "Cumplida"}
                actual={f.actual}
                atrasada={!f.cumplida && !!f.fechaEstimada && dia(f.fechaEstimada)! < hoy}
                editable={puedeEditarFase(rol, f.fase)}
                api={`${api}/fases`}
              />
            );
          })}
        </ol>
        {faltaActa && (
          <div className="pt-det-acta">
            <p><b>Para cerrar la revisión de la instalación hace falta el acta firmada.</b></p>
            <ActaForm unidadId={x.id} />
          </div>
        )}
      </section>

      <section className="pt-det-sec">
        <h3>Lo que se instala <span>{plan?.renglones.length ?? 0} piezas</span></h3>
        <ul className="pt-check">
          {plan?.renglones.map((r, i) => <li key={i}><span>{r.partida.nombre}{r.cantidad > 1 && ` ×${r.cantidad}`} <small>{r.acabado ?? "Acabado por elegir"}</small></span></li>)}
        </ul>
      </section>

      <section className="pt-det-sec">
        <h3>Observaciones <span>{x.observaciones.length}</span></h3>
        {puedeObservar(rol) && <ObservacionForm unidadId={x.id} api={`${api}/observaciones`} fases={FASES.map((f) => ({ valor: f, nombre: FASE[f].nombre }))} />}
        {x.observaciones.length === 0 ? <p className="pt-det-vacio">Sin observaciones todavía.</p> : (
          <ul className="pt-obs">
            {x.observaciones.map((o) => (
              <li key={o.id}>
                <p className="pt-obs-cab"><b>{o.autor}</b> · {ETIQUETA_ROL[o.rol].nombre}{o.fase && <> · {FASE[o.fase].nombre}</>} · {fechaCorta(o.createdAt)}</p>
                <p className="pt-obs-texto">{o.texto}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pt-det-sec">
        <h3>Documentos</h3>
        <div className="pt-docs">
          {[["Contrato", x.contrato], ["Acta de entrega", x.actaEntrega]].map(([n, d]) => {
            const doc = d as { fechaFirma: Date; archivoNombre: string; quienFirmo: string } | null;
            return (
              <article key={n as string} className="pt-doc" data-pendiente={doc ? undefined : true}>
                <span className="ico">{ICONO_DOC}</span>
                <h3>{n as string}</h3>
                <p>{doc ? <>{doc.archivoNombre}<br />Firmó {doc.quienFirmo} · {fechaCorta(doc.fechaFirma)}</> : "Pendiente"}</p>
              </article>
            );
          })}
        </div>
        {facturas.complementos.length + facturas.comisiones.length > 0 && (
          <ul className="pt-pagos">
            {[...facturas.complementos.map((c) => ({ c, tipo: "complemento" as const, monto: Number(c.monto), que: "Complemento de pago" })),
              ...facturas.comisiones.map((c) => ({ c, tipo: "comision" as const, monto: Number(c.total), que: "Factura de comisión" }))]
              .sort((a, b) => +a.c.fechaCobro - +b.c.fechaCobro)
              .map(({ c, tipo, monto, que }) => (
                <li key={c.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <span>
                    {que} · {conceptoExhibicion(c.pago.exhibicion.numero, c.pago.exhibicion.tipo)}
                    <small>
                      Cobrado el {fechaCorta(c.fechaCobro)} · <Money valor={monto} conCentavos />
                      {c.estado === "PENDIENTE" && c.fechaLimite < new Date() && <b className="text-warm"> · vencida</b>}
                    </small>
                  </span>
                  <Factura tipo={tipo} id={c.id} xml={!!c.xmlNombre} pdf={!!c.pdfNombre} subidoPor={c.subidoPor} puedeSubir={rol === "MORETTI"} />
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="pt-det-sec">
        <h3>Conversación <span>día uno, Moretti y el verificador</span></h3>
        {x.mensajes.length === 0 ? <p className="pt-det-vacio">Nadie ha escrito todavía.</p> : (
          <ul className="pt-chat">
            {x.mensajes.map((m) => (
              <li key={m.id} data-mio={m.rol === rol || undefined}>
                <p className="pt-chat-cab"><b>{m.autor}</b> · {ETIQUETA_ROL[m.rol].nombre} · {m.createdAt.toLocaleString("es-MX", { timeZone: "America/Monterrey", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                <p>{m.texto}</p>
              </li>
            ))}
          </ul>
        )}
        {puedeObservar(rol) && <ObservacionForm unidadId={x.id} api={`${api}/mensajes`} mensaje />}
      </section>
    </Modal>
  );
}
