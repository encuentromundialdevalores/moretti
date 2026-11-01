import { connection } from "next/server";
import { Saludo } from "@/components/portal/Kit";
import Calendario, { mesDe } from "@/components/portal/Calendario";
import DetalleUnidad from "@/components/portal/DetalleUnidad";
import { exigirRol } from "@/lib/portal";

/** Calendario de obra (Sprint 5): las fechas de Moretti y del verificador juntas. */
export default async function CalendarioPagina({ searchParams }: { searchParams: Promise<{ mes?: string; u?: string }> }) {
  await connection();
  const u = await exigirRol("MORETTI");
  const { mes: texto, u: abierta } = await searchParams;
  const mes = mesDe(texto);
  const base = "/portal/moretti/calendario";
  return (
    <div className="flex flex-col gap-9">
      <Saludo nombre={u.nombre} titulo="Calendario de obra">Las fechas de Moretti y del verificador. Dale clic a una para abrir su unidad; sólo cambias las tuyas.</Saludo>
      <Calendario mes={mes} base={base} />
      {abierta && <DetalleUnidad unidadId={abierta} rol={u.rol} cerrar={`${base}?mes=${mes.toISOString().slice(0, 7)}`} />}
    </div>
  );
}
