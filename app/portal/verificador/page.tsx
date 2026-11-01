import { connection } from "next/server";
import { Saludo } from "@/components/portal/Kit";
import ListaObra from "@/components/portal/ListaObra";
import DetalleUnidad from "@/components/portal/DetalleUnidad";
import { exigirRol } from "@/lib/portal";

/** Mis unidades (verificador): las 4 fases que revisa; clic en una abre su detalle. */
export default async function UnidadesVerificador({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  await connection();
  const u = await exigirRol("VERIFICADOR");
  const { u: abierta } = await searchParams;
  return (
    <div className="flex flex-col gap-9">
      <Saludo nombre={u.nombre} titulo="Tus unidades">
        Das el visto bueno en cuatro fases: mides, revisas el pedido, recibes el pedido cuando llega y revisas la instalación.
      </Saludo>
      <ListaObra rol="VERIFICADOR" base="/portal/verificador" />
      <p className="bo-nota">Revisa un tercero porque nadie califica su propio trabajo.</p>
      {abierta && <DetalleUnidad unidadId={abierta} rol={u.rol} cerrar="/portal/verificador" />}
    </div>
  );
}
