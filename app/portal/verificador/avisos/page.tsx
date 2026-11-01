import { connection } from "next/server";
import { Saludo } from "@/components/portal/Kit";
import ListaAvisos from "@/components/portal/ListaAvisos";
import { exigirRol } from "@/lib/portal";

/** Avisos automáticos del equipo de obra (D-54). */
export default async function Avisos() {
  await connection();
  const u = await exigirRol("VERIFICADOR");
  return (
    <div className="flex flex-col gap-9">
      <Saludo nombre={u.nombre} titulo="Avisos">Lo que hicieron día uno y el resto del equipo en tus unidades. Dale clic a uno para abrir la unidad.</Saludo>
      <ListaAvisos clave={u.id} rol={u.rol} />
    </div>
  );
}
