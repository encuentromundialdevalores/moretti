import Link from "next/link";
import { connection } from "next/server";
import { Money } from "@/components/ui";
import { Estado } from "@/components/admin/Bo";
import { Saludo, Seccion, Vacio } from "@/components/portal/Kit";
import { fechaCorta } from "@/components/portal/Chips";
import Factura from "@/components/portal/Factura";
import { exigirRol } from "@/lib/portal";
import { facturasPendientesDelMes } from "@/lib/portal-datos";
import { diasParaVencer, urgenciaComprobante } from "@/lib/motor/fiscal";
import { conceptoExhibicion } from "@/lib/motor/recalculo";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/**
 * Facturas del mes (D-53): por cada cobro, el complemento de pago (PPD) para
 * el comprador y la factura de la comisión para día uno. Sólo lo del mes; lo
 * anterior y lo ya subido vive en el detalle de cada unidad.
 */
export default async function FiscalMoretti() {
  await connection();
  const u = await exigirRol("MORETTI");
  const hoy = new Date();
  const desde = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const hasta = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 1));
  const { complementos, comisiones, atrasadas } = await facturasPendientesDelMes(desde, hasta);
  const total = complementos.length + comisiones.length;

  type Fila = (typeof complementos)[number] | (typeof comisiones)[number];
  const fila = (tipo: "complemento" | "comision", c: Fila, monto: React.ReactNode) => {
    const un = c.pago.plan.comprador.unidad;
    const d = diasParaVencer(c.fechaLimite, hoy);
    const urg = urgenciaComprobante(c.fechaLimite, hoy);
    return (
      <li key={c.id} className="pt-fila">
        <div className="pt-unidad">
          <Link href={`/portal/moretti?u=${un.id}`} className="hover:text-accent"><b>{un.torre} {un.numero}</b></Link>
          <span>{conceptoExhibicion(c.pago.exhibicion.numero, c.pago.exhibicion.tipo)} · cobrado el {fechaCorta(c.fechaCobro)}</span>
        </div>
        <div className="pt-medio">
          <b className="text-[16px] text-ink">{monto}</b>
          <span className={`chip ${urg === "vencido" ? "late" : urg === "por_vencer" ? "warn" : "wait"}`}>
            {urg === "vencido" ? `Venció hace ${-d} d` : d === 0 ? "Vence hoy" : `Vence en ${d} d`}
          </span>
        </div>
        <div className="pt-accion">
          <Factura tipo={tipo} id={c.id} xml={!!c.xmlNombre} pdf={!!c.pdfNombre} subidoPor={c.subidoPor} puedeSubir />
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-9">
      <Saludo nombre={u.nombre} titulo={`Facturas de ${MESES[desde.getUTCMonth()]}`}>
        Por cada pago del mes: el complemento de pago para el comprador y la factura de tu comisión para día uno. Sube el XML y el PDF de cada una.
      </Saludo>

      {total > 0
        ? <Estado tipo="aviso" titulo={total === 1 ? "1 factura por subir este mes" : `${total} facturas por subir este mes`}>Tienes hasta el día 5 del mes siguiente.</Estado>
        : <Estado tipo="ok" titulo="Este mes estás al día">No hay facturas pendientes de los cobros del mes.</Estado>}
      {atrasadas > 0 && (
        <p className="bo-falta" style={{ maxWidth: "none" }}>
          Hay {atrasadas} {atrasadas === 1 ? "factura pendiente" : "facturas pendientes"} de meses anteriores. Las encuentras en el detalle de cada unidad, en <Link href="/portal/moretti" className="text-accent underline">Mis unidades</Link>.
        </p>
      )}

      <Seccion titulo="Complementos de pago" cuenta={complementos.length} nota="PPD · para el comprador; los descarga en su portal">
        {complementos.length === 0 ? <Vacio>Nada pendiente.</Vacio> : <ul className="pt-lista">{complementos.map((c) => fila("complemento", c, <Money valor={Number(c.monto)} conCentavos />))}</ul>}
      </Seccion>

      <Seccion titulo="Facturas de comisión" cuenta={comisiones.length} nota="Para día uno · la comisión del pago más IVA">
        {comisiones.length === 0 ? <Vacio>Nada pendiente.</Vacio> : (
          <ul className="pt-lista">
            {comisiones.map((c) => fila("comision", c, <><Money valor={Number(c.total)} conCentavos /> <small className="font-normal text-muted">(<Money valor={Number(c.base)} conCentavos /> + IVA)</small></>))}
          </ul>
        )}
      </Seccion>

      <p className="bo-nota">Por ahora se revisa que el XML traiga su folio (UUID); la verificación contra el SAT queda pendiente.</p>
    </div>
  );
}
