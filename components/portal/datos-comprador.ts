import { planDelComprador } from "@/lib/portal-datos";
import { exigirRol } from "@/lib/portal";

/** El comprador que está viendo, con su plan. Sólo el suyo: sale de su cuenta, no de la URL. */
export async function compradorActual() {
  const u = await exigirRol("COMPRADOR");
  const c = u.compradorId ? await planDelComprador(u.compradorId) : null;
  return { u, c, plan: c?.planes[0] ?? null };
}
