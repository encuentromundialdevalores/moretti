"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { avisar } from "@/components/admin/avisar";
import Liga from "./Liga";
import NuevaCuenta, { type DatosCuenta, type Opcion } from "./NuevaCuenta";

/** Editar, nueva liga, desactivar o borrar una cuenta. */
export default function AccionesCuenta({ cuenta, activo, compradores, desarrolladores }: { cuenta: DatosCuenta; activo: boolean; compradores: Opcion[]; desarrolladores: Opcion[] }) {
  const router = useRouter();
  const [liga, setLiga] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);

  async function accion(a: "invitar" | "desactivar" | "activar") {
    const res = await fetch(`/api/usuarios/${cuenta.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: a }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return avisar.error(data.error ?? "No se pudo.");
    if (data.liga) setLiga(data.liga);
    else avisar.exito(a === "desactivar" ? "Cuenta desactivada: ya no puede entrar." : "Cuenta reactivada.");
    router.refresh();
  }

  async function borrar() {
    if (!confirm(`¿Borrar la cuenta de ${cuenta.nombre}? Ya no podrá entrar. Su historial en la bitácora se queda.`)) return;
    const res = await fetch(`/api/usuarios/${cuenta.id}`, { method: "DELETE" }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return avisar.error(data.error ?? "No se pudo borrar.");
    avisar.exito("Cuenta borrada.");
    router.refresh();
  }

  if (liga) return <Liga liga={liga} alCerrar={() => setLiga(null)} />;
  return (
    <>
      <div className="flex flex-col items-start gap-1 text-[13px]">
        <button type="button" className="text-accent hover:underline" onClick={() => setEditando(true)}>Editar</button>
        {activo && <button type="button" className="text-accent hover:underline" onClick={() => accion("invitar")}>Nueva liga</button>}
        <button type="button" className="text-ink-2 hover:underline" onClick={() => accion(activo ? "desactivar" : "activar")}>{activo ? "Desactivar" : "Reactivar"}</button>
        <button type="button" className="text-warm hover:underline" onClick={borrar}>Borrar</button>
      </div>
      {editando && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={(e) => e.target === e.currentTarget && setEditando(false)}>
          <div role="dialog" aria-modal="true" aria-label={`Editar cuenta de ${cuenta.nombre}`} className="card w-full max-w-[640px] p-6">
            <h2 className="mb-4 text-[20px] font-semibold">Editar cuenta</h2>
            <NuevaCuenta cuenta={cuenta} compradores={compradores} desarrolladores={desarrolladores} alTerminar={() => setEditando(false)} />
          </div>
        </div>
      )}
    </>
  );
}
