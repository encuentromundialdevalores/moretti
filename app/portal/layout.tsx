import type { Metadata } from "next";
import NavPortal from "@/components/portal/NavPortal";
import Avisos from "@/components/admin/Avisos";
import { usuarioActual } from "@/lib/portal";
import { ETIQUETA_ROL, PANTALLAS } from "@/lib/permisos";
import { contarNuevos } from "@/lib/avisos";
import "../admin/(panel)/panel.css";
import "./portal.css";

export const metadata: Metadata = { title: "día uno · portal", robots: { index: false, follow: false } };

/** Portal de comprador, Moretti, verificador y PISSA (D-48). */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const u = await usuarioActual();
  if (!u || u.rol === "ADMIN") return <>{children}</>;
  const nuevos = u.rol === "MORETTI" || u.rol === "VERIFICADOR" ? await contarNuevos(u.id, u.rol) : 0;
  return (
    <div className="panel">
      <NavPortal quien={ETIQUETA_ROL[u.rol].nombre} nombre={u.nombre} pantallas={PANTALLAS[u.rol]} nuevos={nuevos} />
      <main className="panel-contenido">
        <div className="mx-auto w-full max-w-[980px] px-5 py-10 sm:px-10 sm:py-14">{children}</div>
        <footer className="mx-auto w-full max-w-[980px] px-5 pb-8 text-[12.5px] text-muted sm:px-10">
          Prototipo académico · ambiente de pruebas · ningún dato real
        </footer>
      </main>
      <Avisos />
    </div>
  );
}
