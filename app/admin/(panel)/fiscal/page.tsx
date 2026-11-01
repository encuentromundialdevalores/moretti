import Link from "next/link";
import { connection } from "next/server";
import { EstadoComprobante } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PageHead, Money } from "@/components/ui";
import Factura from "@/components/portal/Factura";
import { mesDe } from "@/components/portal/Calendario";
import { conceptoExhibicion } from "@/lib/motor/recalculo";
import "../../../portal/portal.css";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const clave = (d: Date) => d.toISOString().slice(0, 7);
const fecha = (f: Date) => f.toLocaleDateString("es-MX", { timeZone: "UTC", day: "numeric", month: "short" });

/**
 * Fiscal, mes por mes (D-53): por cada cobro del mes, el complemento de pago
 * que Moretti emite para el comprador y la factura de comisión (comisión +
 * IVA) que Moretti le hace a día uno. Organizado por unidad.
 */
export default async function FiscalPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await connection();
  const mes = mesDe((await searchParams).mes);
  const siguiente = new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth() + 1, 1));
  const anterior = new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth() - 1, 1));

  const pagos = await prisma.pago.findMany({
    where: { fecha: { gte: mes, lt: siguiente }, OR: [{ comprobante: { isNot: null } }, { facturaComision: { isNot: null } }] },
    select: {
      id: true,
      monto: true,
      fecha: true,
      exhibicion: { select: { numero: true, tipo: true } },
      plan: { select: { id: true, comprador: { select: { nombre: true, unidad: { select: { torre: true, numero: true } } } } } },
      comprobante: { select: { id: true, estado: true, xmlNombre: true, pdfNombre: true, subidoPor: true } },
      facturaComision: { select: { id: true, estado: true, base: true, total: true, xmlNombre: true, pdfNombre: true, subidoPor: true } },
    },
    orderBy: [{ fecha: "asc" }],
  });
  const pendientes = await Promise.all([
    prisma.comprobanteFiscal.count({ where: { estado: EstadoComprobante.PENDIENTE, fechaCobro: { gte: mes, lt: siguiente } } }),
    prisma.facturaComision.count({ where: { estado: EstadoComprobante.PENDIENTE, fechaCobro: { gte: mes, lt: siguiente } } }),
  ]);
  const totalComision = pagos.reduce((a, p) => a + Number(p.facturaComision?.total ?? 0), 0);
  const cobrado = pagos.reduce((a, p) => a + Number(p.monto), 0);

  // Por unidad, como pidió Ana Cris: cada venta con todos sus pagos del mes.
  const porUnidad = new Map<string, typeof pagos>();
  for (const p of pagos) {
    const k = `${p.plan.comprador.unidad.torre} ${p.plan.comprador.unidad.numero}`;
    porUnidad.set(k, [...(porUnidad.get(k) ?? []), p]);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHead eyebrow="Fiscal" titulo="Facturas, mes por mes" descripcion="Por cada cobro, Moretti emite el complemento de pago (PPD) para el comprador y te factura su comisión más IVA." />

      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/admin/fiscal?mes=${clave(anterior)}`} className="btn btn-sm btn-ghost" aria-label="Mes anterior">←</Link>
        <h2 className="m-0 text-[22px] font-semibold capitalize">{MESES[mes.getUTCMonth()]} {mes.getUTCFullYear()}</h2>
        <Link href={`/admin/fiscal?mes=${clave(siguiente)}`} className="btn btn-sm btn-ghost" aria-label="Mes siguiente">→</Link>
      </div>

      <div className="bo-hero" style={{ gridTemplateColumns: "1.35fr repeat(2, 1fr)" }}>
        <div className="bo-principal">
          <p className="bo-k">Por subir</p>
          <p className="bo-v">{pendientes[0] + pendientes[1]}</p>
          <p className="bo-nota">{pendientes[0]} complementos · {pendientes[1]} de comisión</p>
        </div>
        <div><p className="bo-k">Cobrado en el mes</p><p className="bo-v"><Money valor={cobrado} /></p><p className="bo-nota">{pagos.length} pagos</p></div>
        <div><p className="bo-k">Comisión + IVA</p><p className="bo-v"><Money valor={totalComision} /></p><p className="bo-nota">Lo que Moretti te factura</p></div>
      </div>

      {pagos.length === 0 ? <div className="pt-vacio">No hubo cobros este mes.</div> : (
        [...porUnidad].map(([unidad, deU]) => (
          <section key={unidad} className="bo-seccion">
            <div className="bo-seccion-t"><h2>{unidad}</h2><span>{deU[0].plan.comprador.nombre} · <Link href={`/admin/planes/${deU[0].plan.id}`} className="text-accent">ver plan</Link></span></div>
            <div className="card overflow-x-auto p-5">
              <table className="tbl">
                <thead><tr><th>Pago</th><th className="r">Monto</th><th>Complemento de pago</th><th className="r">Comisión + IVA</th><th>Factura de comisión</th></tr></thead>
                <tbody>
                  {deU.map((p) => (
                    <tr key={p.id}>
                      <td>{conceptoExhibicion(p.exhibicion.numero, p.exhibicion.tipo)}<br /><span className="text-[12px] text-muted">{fecha(p.fecha)}</span></td>
                      <td className="r"><Money valor={Number(p.monto)} conCentavos /></td>
                      <td>{p.comprobante ? <Factura tipo="complemento" id={p.comprobante.id} xml={!!p.comprobante.xmlNombre} pdf={!!p.comprobante.pdfNombre} subidoPor={p.comprobante.subidoPor} puedeSubir={false} /> : "—"}</td>
                      <td className="r">{p.facturaComision ? <Money valor={Number(p.facturaComision.total)} conCentavos /> : "—"}</td>
                      <td>{p.facturaComision ? <Factura tipo="comision" id={p.facturaComision.id} xml={!!p.facturaComision.xmlNombre} pdf={!!p.facturaComision.pdfNombre} subidoPor={p.facturaComision.subidoPor} puedeSubir={false} /> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
      <p className="bo-nota">Las facturas las sube Moretti desde su portal; aquí se descargan. La verificación contra el SAT queda pendiente.</p>
    </div>
  );
}
