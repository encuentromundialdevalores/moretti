import { connection } from "next/server";
import { Money } from "@/components/ui";
import { Saludo, Seccion, Vacio } from "@/components/portal/Kit";
import { fechaCorta } from "@/components/portal/Chips";
import { compradorActual } from "@/components/portal/datos-comprador";
import { comprobantesDelPlan } from "@/lib/portal-datos";

const ICONO_DOC = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>;

/** Mis documentos (maqueta c-doc): contrato, acta y facturas, como tarjetas. */
export default async function MisDocumentos() {
  await connection();
  const { u, c, plan } = await compradorActual();
  if (!c || !plan) return <><Saludo nombre={u.nombre} titulo="Tus documentos" /><Vacio>Todavía no hay un plan ligado a tu cuenta.</Vacio></>;
  const comprobantes = await comprobantesDelPlan(plan.id);
  const docs = [
    { nombre: "Contrato", d: c.unidad.contrato, falta: "Se firma al apartar tu departamento." },
    { nombre: "Acta de entrega y garantía", d: c.unidad.actaEntrega, falta: "Se firma el día que recibes tu equipamiento." },
  ];

  return (
    <div className="flex flex-col gap-9">
      <Saludo nombre={u.nombre} titulo="Tus documentos">Folio {c.folio} · Todo queda guardado con su fecha y nunca se borra.</Saludo>

      <div className="pt-docs">
        {docs.map(({ nombre, d, falta }) => (
          <article key={nombre} className="pt-doc" data-pendiente={d ? undefined : true}>
            <span className="ico">{ICONO_DOC}</span>
            <h3>{nombre}</h3>
            {d ? <p>Firmado el {fechaCorta(d.fechaFirma)}<br />{d.archivoNombre}</p> : <p>{falta}</p>}
            <span className={`chip ${d ? "ok" : "wait"} self-start`}>{d ? "Firmado" : "Pendiente"}</span>
          </article>
        ))}
      </div>

      <Seccion titulo="Tus facturas" cuenta={comprobantes.length} nota="Una por cada pago">
        {comprobantes.length === 0 ? <Vacio>Cuando se haga tu primer cobro, aquí aparece su factura.</Vacio> : (
          <ul className="pt-pagos">
            {comprobantes.map((x) => (
              <li key={x.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto auto" }}>
                <span>Pago del {fechaCorta(x.fechaCobro)}{x.folioFiscal && <small className="font-mono">{x.folioFiscal}</small>}</span>
                <span className={`chip ${x.folioFiscal ? "ok" : "wait"}`}>{x.folioFiscal ? "Lista" : "En proceso"}</span>
                <span className="monto"><Money valor={Number(x.monto)} conCentavos /></span>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </div>
  );
}
