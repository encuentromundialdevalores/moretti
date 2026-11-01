import { connection } from "next/server";
import { Saludo } from "@/components/portal/Kit";
import ListaObra from "@/components/portal/ListaObra";
import DetalleUnidad from "@/components/portal/DetalleUnidad";
import { exigirRol } from "@/lib/portal";

/** Mis unidades (Moretti): por fase de obra; clic en una abre su detalle. */
export default async function UnidadesMoretti({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  await connection();
  const u = await exigirRol("MORETTI");
  const { u: abierta } = await searchParams;
  return (
    <div className="flex flex-col gap-9">
      <Saludo nombre={u.nombre} titulo="Tus unidades">Lo vendido y en qué fase va. Tú haces el pedido a fábrica y la instalación; el verificador mide y revisa.</Saludo>
      <ListaObra rol="MORETTI" base="/portal/moretti" />
      <p className="bo-nota">Ningún pedido sale a fábrica sin que la unidad esté pagada por completo: el sistema no lo deja.</p>
      {abierta && <DetalleUnidad unidadId={abierta} rol={u.rol} cerrar="/portal/moretti" />}
    </div>
  );
}
