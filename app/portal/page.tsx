import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/portal";
import { inicioDe } from "@/lib/permisos";

/** Reparte a cada quien a su primera pantalla. */
export default async function PortalInicio() {
  const u = await usuarioActual();
  redirect(u ? inicioDe(u.rol) : "/entrar");
}
