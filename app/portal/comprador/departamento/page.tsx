import { connection } from "next/server";
import { Avance, Saludo, Seccion, Vacio } from "@/components/portal/Kit";
import { compradorActual } from "@/components/portal/datos-comprador";
import { queSigueParaComprador } from "@/lib/portal-etapas";

/** Mi departamento (maqueta c-uni): en qué paso va y qué compró. */
export default async function MiDepartamento() {
  await connection();
  const { u, c, plan } = await compradorActual();
  if (!c || !plan) return <><Saludo nombre={u.nombre} titulo="Tu departamento" /><Vacio>Todavía no hay un plan ligado a tu cuenta.</Vacio></>;
  const sigue = queSigueParaComprador(c.unidad.estadoOperativo, c.unidad.estadoInstalacion);
  const cambiable = c.unidad.estadoOperativo === "PENDIENTE";

  return (
    <div className="flex flex-col gap-9">
      <Saludo nombre={u.nombre} titulo={`Tu departamento ${c.unidad.torre} ${c.unidad.numero}`}>
        {c.unidad.proyecto.nombre} · Paquete {plan.paquete.nombre}
      </Saludo>

      <div className="pt-tarjeta">
        <Avance op={c.unidad.estadoOperativo} ins={c.unidad.estadoInstalacion} grande />
        <div>
          <p className="text-[19px] font-semibold">{sigue.titulo}</p>
          <p className="mt-1 text-[15px] text-ink-2">{sigue.texto}</p>
        </div>
      </div>

      <Seccion titulo="Lo que compraste" cuenta={plan.renglones.length} nota={cambiable ? "Puedes cambiar acabados hasta que se haga la medición." : "Ya se midió: así va a fabricación."}>
        <ul className="pt-pagos">
          {plan.renglones.map((r, i) => (
            <li key={i} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <span>{r.partida.nombre}{r.cantidad > 1 && <small>{r.cantidad} piezas</small>}</span>
              <span className="text-[13.5px] text-ink-2">{r.acabado ?? "Acabado por elegir"}</span>
            </li>
          ))}
        </ul>
      </Seccion>
    </div>
  );
}
