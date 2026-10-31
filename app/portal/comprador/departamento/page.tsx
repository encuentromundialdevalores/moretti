import { connection } from "next/server";
import { Encabezado } from "@/components/portal/Encabezado";
import { ChipInstalacion, ChipOperativo, SinDatos } from "@/components/portal/Chips";
import { compradorActual } from "@/components/portal/datos-comprador";

/** Mi departamento: qué compró y en qué va (maqueta c-uni). */
export default async function MiDepartamento() {
  await connection();
  const { u, c, plan } = await compradorActual();
  if (!c || !plan) return <><Encabezado rol={u.rol} titulo="Mi departamento" /><SinDatos>Todavía no hay un plan ligado a tu cuenta.</SinDatos></>;
  return (
    <div className="flex flex-col gap-8">
      <Encabezado rol={u.rol} titulo={`${c.unidad.torre} ${c.unidad.numero}`} descripcion={`${c.unidad.proyecto.nombre} · Paquete ${plan.paquete.nombre} · ${plan.renglones.length} partidas`} />
      <div className="flex flex-wrap gap-6">
        <div><p className="label">Fabricación</p><p className="mt-1"><ChipOperativo estado={c.unidad.estadoOperativo} /></p></div>
        <div><p className="label">Instalación</p><p className="mt-1"><ChipInstalacion estado={c.unidad.estadoInstalacion} /></p></div>
      </div>
      <table className="tbl">
        <thead><tr><th>Partida</th><th className="r">Cantidad</th><th>Acabado elegido</th></tr></thead>
        <tbody>
          {plan.renglones.map((r, i) => (
            <tr key={i}><td>{r.partida.nombre}</td><td className="r">{r.cantidad}</td><td>{r.acabado ?? "—"}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="bo-nota">El acabado lo elegiste al comprar; así va a producción. Se puede cambiar hasta el levantamiento.</p>
    </div>
  );
}
