import { connection } from "next/server";
import { Money } from "@/components/ui";
import { Encabezado } from "@/components/portal/Encabezado";
import { Chip, SinDatos, fechaCorta } from "@/components/portal/Chips";
import { compradorActual } from "@/components/portal/datos-comprador";
import { comprobantesDelPlan } from "@/lib/portal-datos";

/** Mis documentos (maqueta c-doc): contrato, acta y comprobantes. */
export default async function MisDocumentos() {
  await connection();
  const { u, c, plan } = await compradorActual();
  if (!c || !plan) return <><Encabezado rol={u.rol} titulo="Mis documentos" /><SinDatos>Todavía no hay un plan ligado a tu cuenta.</SinDatos></>;
  const comprobantes = await comprobantesDelPlan(plan.id);
  const docs: [string, { fechaFirma: Date; archivoNombre: string } | null][] = [
    ["Contrato", c.unidad.contrato],
    ["Acta de entrega y garantía", c.unidad.actaEntrega],
  ];
  return (
    <div className="flex flex-col gap-8">
      <Encabezado rol={u.rol} titulo="Mis documentos" descripcion={`Folio ${c.folio} · ${c.unidad.torre} ${c.unidad.numero}`} />
      <table className="tbl">
        <thead><tr><th>Documento</th><th>Archivo</th><th>Estado</th></tr></thead>
        <tbody>
          {docs.map(([n, d]) => (
            <tr key={n}>
              <td>{n}</td>
              <td className="text-ink-2">{d?.archivoNombre ?? "—"}</td>
              <td>{d ? <Chip texto={`Firmado · ${fechaCorta(d.fechaFirma)}`} clase="ok" /> : <Chip texto="Pendiente" clase="wait" />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="flex flex-col gap-3">
        <h2 className="text-[18px] font-semibold">Comprobantes fiscales</h2>
        {comprobantes.length === 0 ? (
          <p className="text-[14.5px] text-ink-2">Todavía no hay cobros con comprobante.</p>
        ) : (
          <table className="tbl">
            <thead><tr><th>Cobro</th><th className="r">Monto</th><th>Folio fiscal</th></tr></thead>
            <tbody>
              {comprobantes.map((x) => (
                <tr key={x.id}>
                  <td>{fechaCorta(x.fechaCobro)}</td>
                  <td className="r"><Money valor={Number(x.monto)} conCentavos /></td>
                  <td>{x.folioFiscal ? <span className="font-mono text-[12.5px]">{x.folioFiscal}</span> : <Chip texto="En proceso" clase="wait" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="bo-nota">Todo atado a tu unidad, con fecha y con quién lo firmó. Nunca se borra.</p>
    </div>
  );
}
