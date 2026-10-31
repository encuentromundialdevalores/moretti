import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { EstadoExhibicion, EstadoPlan } from "@prisma/client";
import { PageHead, Money, ChipEstadoFinanciero } from "@/components/ui";
import Graficas from "@/components/admin/Graficas";
import { datosGraficas } from "@/lib/motor/graficas";

export default async function PanelPage() {
  // En cada visita, no al compilar: lee la base.
  await connection();
  const [planes, unidadesLibres, pagos, graficas] = await Promise.all([
    prisma.plan.findMany({
      where: { estado: { not: EstadoPlan.CANCELADO } },
      include: {
        comprador: { include: { unidad: { include: { proyecto: true } } } },
        paquete: true,
        exhibiciones: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.unidad.count({ where: { comprador: null } }),
    prisma.pago.findMany(),
    datosGraficas(),
  ]);
  const cobrado = pagos.reduce((acc, p) => acc + Number(p.monto), 0);
  const comision = pagos.reduce((acc, p) => acc + Number(p.montoComision), 0);
  const porCobrar = planes
    .filter((p) => p.estado === EstadoPlan.ACTIVO || p.estado === EstadoPlan.SUSPENDIDO)
    .reduce((acc, p) => acc + Number(p.saldo), 0);
  const cotizaciones = planes.filter((p) => p.estado === EstadoPlan.COTIZADO);

  return (
    <div className="flex flex-col gap-10">
      <PageHead
        eyebrow="Inicio"
        titulo="La cartera, de un vistazo."
        descripcion="Quién ya apartó, cuánto se ha cobrado y qué ventas faltan por cerrar."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="panel-kpi" data-destacado="">
          <p className="k">Cobrado</p>
          <p className="v"><Money valor={cobrado} /></p>
        </div>
        <div className="panel-kpi">
          <p className="k">Por cobrar</p>
          <p className="v"><Money valor={porCobrar} /></p>
        </div>
        <div className="panel-kpi">
          <p className="k">Comisión devengada</p>
          <p className="v"><Money valor={comision} /></p>
        </div>
        <div className="panel-kpi">
          <p className="k">Planes vivos · unidades libres</p>
          <p className="v">{planes.length} · {unidadesLibres}</p>
        </div>
      </div>

      <Graficas {...graficas} />

      {cotizaciones.length > 0 && (
        <section className="bo-cotiza">
          <div className="bo-cotiza-cab">
            <span className="bo-cotiza-n">{cotizaciones.length}</span>
            <div>
              <h2>{cotizaciones.length === 1 ? "Una cotización espera cerrarse" : `${cotizaciones.length} cotizaciones esperan cerrarse`}</h2>
              <p>Para apartar: contrato firmado → tarjeta guardada → cobrar anticipo. Hasta entonces el precio no queda congelado.</p>
            </div>
          </div>
          <ul className="bo-cotiza-lista">
            {cotizaciones.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/planes/${p.id}`}>
                  <span><b>{p.comprador.nombre}</b><small>{p.comprador.unidad.torre} {p.comprador.unidad.numero} · {p.paquete.nombre}</small></span>
                  <span className="bo-cotiza-ir">Cerrar venta →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <h2 className="-mb-4 text-[24px]">Compradores</h2>
      {planes.length === 0 ? (
        <div className="card flex flex-col items-start gap-4 p-8">
          <div>
            <h2 className="text-[22px]">Todavía no hay ningún plan</h2>
            <p className="mt-2 max-w-[52ch] text-ink-2">
              Hay {unidadesLibres} unidades sin comprador. Entra a un proyecto, elige una
              unidad libre y registra a su comprador para generar la primera cotización.
            </p>
          </div>
          <Link href="/admin/proyectos" className="btn">
            Ver proyectos
          </Link>
        </div>
      ) : (
        <div className="card overflow-x-auto p-5">
          <table className="tbl">
            <thead>
              <tr>
                <th>Comprador</th>
                <th>Unidad</th>
                <th>Paquete</th>
                <th className="r">Cobrado</th>
                <th className="r">Saldo</th>
                <th className="r">Estado</th>
              </tr>
            </thead>
            <tbody>
              {planes.map((plan) => {
                const pagadas = plan.exhibiciones.filter(
                  (e) => e.estado === EstadoExhibicion.PAGADA
                );
                const cobradoPlan = pagadas.reduce((acc, e) => acc + Number(e.monto), 0);
                const unidad = plan.comprador.unidad;
                return (
                  <tr key={plan.id}>
                    <td>
                      <Link href={`/admin/planes/${plan.id}`} className="hover:text-accent">
                        {plan.comprador.nombre}
                      </Link>
                      <span className="ml-2 font-mono text-[11px] text-muted">
                        {plan.comprador.folio}
                      </span>
                    </td>
                    <td>
                      {unidad.torre} {unidad.numero}
                      <span className="block text-[12px] text-muted">
                        {unidad.proyecto.nombre}
                      </span>
                    </td>
                    <td>{plan.paquete.nombre}</td>
                    <td className="r">
                      <Money valor={cobradoPlan} />
                    </td>
                    <td className="r">
                      <Money valor={Number(plan.saldo)} />
                    </td>
                    <td className="r">
                      <ChipEstadoFinanciero estado={unidad.estadoFinanciero} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
