import { connection } from "next/server";
import { PageHead } from "@/components/ui";
import ListaAvisos from "@/components/portal/ListaAvisos";
import "../../../portal/portal.css";

/** Avisos para día uno: fechas, fases, mensajes, facturas y cuentas nuevas (D-54). */
export default async function AvisosAdmin() {
  await connection();
  return (
    <div className="flex flex-col gap-8">
      <PageHead eyebrow="Avisos" titulo="Lo que pasó en la obra" descripcion="Fechas que se movieron, fases cumplidas, mensajes, facturas subidas y cuentas nuevas. Dale clic a uno para abrir la unidad." />
      <ListaAvisos clave="admin" rol="ADMIN" />
    </div>
  );
}
