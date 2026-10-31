"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { avisar } from "@/components/admin/avisar";
import Liga from "./Liga";

export default function AccionesCuenta({ id, activo }: { id: string; activo: boolean }) {
  const router = useRouter();
  const [liga, setLiga] = useState<string | null>(null);
  async function accion(a: "invitar" | "desactivar" | "activar") {
    const res = await fetch(`/api/usuarios/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: a }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return avisar.error(data.error ?? "No se pudo.");
    if (data.liga) setLiga(data.liga);
    else avisar.exito(a === "desactivar" ? "Cuenta desactivada: ya no puede entrar." : "Cuenta reactivada.");
    router.refresh();
  }
  if (liga) return <Liga liga={liga} alCerrar={() => setLiga(null)} />;
  return (
    <div className="flex flex-col items-start gap-1 text-[13px]">
      {activo && <button type="button" className="text-accent hover:underline" onClick={() => accion("invitar")}>Nueva liga</button>}
      <button type="button" className="text-warm hover:underline" onClick={() => accion(activo ? "desactivar" : "activar")}>{activo ? "Desactivar" : "Reactivar"}</button>
    </div>
  );
}
