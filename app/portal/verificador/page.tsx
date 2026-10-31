import { connection } from "next/server";
import { Estado } from "@/components/admin/Bo";
import { Fila, Lista, Saludo, Seccion } from "@/components/portal/Kit";
import BotonAvance from "@/components/portal/BotonAvance";
import { exigirRol } from "@/lib/portal";
import { unidadesParaVerificador } from "@/lib/portal-datos";

/** Por medir (maqueta o-medir). Sin pagos, precios ni contrato. */
export default async function Levantamientos() {
  await connection();
  const u = await exigirRol("VERIFICADOR");
  const unidades = await unidadesParaVerificador();
  const porMedir = unidades.filter((x) => x.estadoOperativo === "PENDIENTE");
  const medidas = unidades.filter((x) => x.estadoOperativo !== "PENDIENTE");

  const fila = (x: (typeof unidades)[number], hecha: boolean) => {
    const plan = x.comprador?.planes[0];
    return (
      <Fila key={x.id} unidad={`${x.torre} ${x.numero}`} detalle={x.proyecto.nombre}
        medio={<>Paquete {plan?.paquete.nombre ?? "—"} · {plan?.renglones.length ?? 0} piezas a medir</>}>
        {hecha ? <span className="chip ok">Medida</span> : <BotonAvance unidadId={x.id} tipo="operativo" hacia="LEVANTAMIENTO_HECHO" texto="Ya la medí" />}
      </Fila>
    );
  };

  return (
    <div className="flex flex-col gap-9">
      <Saludo nombre={u.nombre} titulo="Por medir">Departamentos vendidos que hay que medir al milímetro. Cuando termines, márcalo: desde ahí se cierran los cambios del comprador.</Saludo>

      {porMedir.length > 0
        ? <Estado tipo="aviso" titulo={porMedir.length === 1 ? "Tienes 1 departamento por medir" : `Tienes ${porMedir.length} departamentos por medir`} />
        : <Estado tipo="ok" titulo="No hay nada por medir">Cuando se venda otro departamento aparece aquí.</Estado>}

      {porMedir.length > 0 && <Seccion titulo="Te toca medir" cuenta={porMedir.length}><Lista>{porMedir.map((x) => fila(x, false))}</Lista></Seccion>}

      {medidas.length > 0 && (
        <details className="pt-mas">
          <summary>Ver {medidas.length} ya medidos</summary>
          <Lista>{medidas.map((x) => fila(x, true))}</Lista>
        </details>
      )}

      <p className="bo-nota">Mide un tercero porque nadie califica su propio trabajo.</p>
    </div>
  );
}
