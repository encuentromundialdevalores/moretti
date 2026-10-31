import { PageHead } from "@/components/ui";
import { LO_QUE_VE, ETIQUETA_ROL } from "@/lib/permisos";
import type { Rol } from "@prisma/client";

/** Título de la pantalla y, debajo, qué ve este perfil (como en la maqueta). */
export function Encabezado({ rol, titulo, descripcion }: { rol: Rol; titulo: string; descripcion?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHead eyebrow={ETIQUETA_ROL[rol].nombre} titulo={titulo} descripcion={descripcion} />
      <p className="bo-nota">
        <b>{ETIQUETA_ROL[rol].nombre} ve:</b> {LO_QUE_VE[rol]}
      </p>
    </div>
  );
}
