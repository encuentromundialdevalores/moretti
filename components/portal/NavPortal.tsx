"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Pantalla } from "@/lib/permisos";

/** Menú del portal: las pantallas del rol, como el «Sus pantallas» de la maqueta. */
export default function NavPortal({ quien, nombre, pantallas }: { quien: string; nombre: string; pantallas: Pantalla[] }) {
  const ruta = usePathname();
  const router = useRouter();
  async function salir() {
    await fetch("/api/salir", { method: "POST" });
    router.push("/entrar");
    router.refresh();
  }
  return (
    <aside className="panel-lateral">
      <div className="panel-marca">
        <span className="font-display text-[22px] font-bold tracking-[-0.02em]">día uno</span>
        <span className="block font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">{quien}</span>
      </div>
      <nav className="panel-nav" aria-label="Tus pantallas">
        {pantallas.map((p) => (
          <Link key={p.href} href={p.href} className="panel-enlace" aria-current={ruta === p.href ? "page" : undefined}>
            {p.texto}
          </Link>
        ))}
      </nav>
      <div className="panel-pie">
        <p className="px-3 pb-2 text-[12.5px] text-muted">{nombre}</p>
        <button type="button" onClick={salir} className="panel-enlace panel-enlace-suave w-full">Salir</button>
      </div>
    </aside>
  );
}
