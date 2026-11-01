"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Pop-up que vive en la URL (?u=<unidad>): se puede recargar o compartir, y
 * se cierra con la X, con Esc o tocando fuera.
 */
export default function Modal({ cerrar, titulo, children }: { cerrar: string; titulo: string; children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && router.push(cerrar, { scroll: false });
    document.addEventListener("keydown", tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = antes;
    };
  }, [cerrar, router]);

  return (
    <div className="pt-modal-fondo" onClick={(e) => e.target === e.currentTarget && router.push(cerrar, { scroll: false })}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className="pt-modal">
        <Link href={cerrar} scroll={false} className="pt-modal-x" aria-label="Cerrar">×</Link>
        {children}
      </div>
    </div>
  );
}
