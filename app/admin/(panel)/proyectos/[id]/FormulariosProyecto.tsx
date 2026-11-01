"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SubirImagen from "@/components/SubirImagen";
import { avisar } from "@/components/admin/avisar";

type Opcion = { id: string; nombre?: string; clave?: string };

export type DatosProyecto = {
  nombre: string;
  numeroUnidades: number;
  porcentajeAnticipo: number;
  porcentajeComision: number;
  minimoPlan: number;
  fechaEntregaUnidades: string | null;
  imagen: string | null;
  stripeConnectedAccountId: string | null;
};


export default function FormulariosProyecto({
  proyectoId,
  prototipos,
  paquetes,
  tablas,
  datos,
}: {
  proyectoId: string;
  prototipos: Opcion[];
  paquetes: Opcion[];
  tablas: { unidades: React.ReactNode; precios: React.ReactNode };
  datos: DatosProyecto;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);

  async function enviar(
    url: string,
    cuerpo: unknown,
    form: HTMLFormElement | null,
    metodo: string,
    listo: (r: Record<string, unknown>) => string
  ) {
    setGuardando(true);
    const res = await fetch(url, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    }).catch(() => null);
    const data = ((await res?.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    setGuardando(false);
    if (!res || !res.ok) {
      avisar.error(typeof data.error === "string" ? data.error : "Revisa tu conexión e intenta de nuevo.");
      return;
    }
    form?.reset();
    avisar.exito(listo(data));
    router.refresh();
  }

  const sinPrototipos = prototipos.length === 0;

  return (
    <section className="flex flex-col gap-10">
      <section className="bo-seccion">
        <div className="bo-seccion-t"><h2>Unidades</h2><span>Paquete comprado, fecha y folio del anticipo en Stripe</span></div>
        {tablas.unidades}
        <details className="bo-plegable">
          <summary><span>Agregar unidades</span><small>Una o un rango, del 1201 al 1210</small></summary>
          <div className="lg:max-w-[420px]">
          <form
            className="card flex h-fit flex-col gap-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              enviar(
                "/api/unidades",
                {
                  proyectoId,
                  prototipoId: f.get("prototipoId"),
                  torre: f.get("torre"),
                  numero: f.get("numero"),
                  hasta: f.get("hasta") || undefined,
                },
                e.currentTarget,
                "POST",
                (r) => (Number(r.creadas) > 1 ? `Se agregaron ${r.creadas} unidades.` : "Unidad agregada.")
              );
            }}
          >
            <div>
              <h3 className="text-[18px]">Nuevas unidades</h3>
              <p className="mt-1 text-[13.5px] text-ink-2">Cada departamento que se puede apartar. Agrega una o un rango seguido.</p>
            </div>
            <div className="field">
              <label htmlFor="unidad-prototipo">Prototipo</label>
              <select id="unidad-prototipo" name="prototipoId" required defaultValue="" disabled={sinPrototipos}>
                <option value="" disabled>{sinPrototipos ? "Primero agrega un prototipo" : "Elige el prototipo…"}</option>
                {prototipos.map((p) => (
                  <option key={p.id} value={p.id}>{p.clave}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="torre">Torre</label>
              <input id="torre" name="torre" placeholder="Ej. A" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label htmlFor="numero">Número</label>
                <input id="numero" name="numero" placeholder="Ej. 1201" required />
              </div>
              <div className="field">
                <label htmlFor="hasta">Hasta (opcional)</label>
                <input id="hasta" name="hasta" inputMode="numeric" placeholder="Ej. 1210" />
              </div>
            </div>
            <p className="ayuda -mt-2">Con «hasta» se agregan todas: del 1201 al 1210 son 10 unidades.</p>
            <button className="btn btn-sm self-start" disabled={guardando || sinPrototipos}>Agregar unidades</button>
          </form>
          </div>
        </details>
      </section>
      <section className="bo-seccion">
        <div className="bo-seccion-t"><h2>Prototipos y precios</h2><span>Precio vigente por prototipo y paquete; «—» es que falta</span></div>
        {tablas.precios}
        <details className="bo-plegable">
          <summary><span>Poner o cambiar un precio</span><small>El anterior queda en el histórico</small></summary>
          <div className="lg:max-w-[420px]">
          <form
            className="card flex h-fit flex-col gap-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              enviar(
                "/api/precios",
                { prototipoId: f.get("prototipoId"), paqueteId: f.get("paqueteId"), monto: f.get("monto") },
                e.currentTarget,
                "POST",
                () => "Precio guardado. Ya aparece en el cotizador."
              );
            }}
          >
            <div>
              <h3 className="text-[18px]">Precio de un paquete</h3>
              <p className="mt-1 text-[13.5px] text-ink-2">Si ya tenía precio, el nuevo lo reemplaza desde hoy y el anterior queda en el histórico.</p>
            </div>
            <div className="field">
              <label htmlFor="precio-prototipo">Prototipo</label>
              <select id="precio-prototipo" name="prototipoId" required defaultValue="" disabled={sinPrototipos}>
                <option value="" disabled>{sinPrototipos ? "Primero agrega un prototipo" : "Elige el prototipo…"}</option>
                {prototipos.map((p) => (
                  <option key={p.id} value={p.id}>{p.clave}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="precio-paquete">Paquete</label>
              <select id="precio-paquete" name="paqueteId" required defaultValue="">
                <option value="" disabled>Elige el paquete…</option>
                {paquetes.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="monto">Precio con IVA ($)</label>
              <input id="monto" name="monto" type="number" step="100" min={1} placeholder="Ej. 147300" required />
              <p className="ayuda">En pesos enteros, sin comas ni centavos.</p>
            </div>
            <button className="btn btn-sm self-start" disabled={guardando || sinPrototipos}>Guardar precio</button>
          </form>
          </div>
        </details>
      </section>
      <details className="bo-plegable">
        <summary><span>Agregar prototipo</span><small>Metros y recámaras</small></summary>
        <div className="grid gap-5 lg:max-w-[420px]">
          <form
            className="card flex h-fit flex-col gap-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              enviar(
                "/api/prototipos",
                { proyectoId, clave: f.get("clave"), superficie: f.get("superficie"), recamaras: f.get("recamaras") },
                e.currentTarget,
                "POST",
                () => `Prototipo «${f.get("clave")}» agregado.`
              );
            }}
          >
            <div>
              <h3 className="text-[18px]">Nuevo prototipo</h3>
              <p className="mt-1 text-[13.5px] text-ink-2">Cada tipo de departamento. El precio de los paquetes cambia por prototipo.</p>
            </div>
            <div className="field">
              <label htmlFor="clave">Clave</label>
              <input id="clave" name="clave" placeholder="Ej. DEPA 2R (tipo 717)" required />
              <p className="ayuda">Como viene en los planos del desarrollador.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label htmlFor="superficie">Superficie (m²)</label>
                <input id="superficie" name="superficie" type="number" step="0.01" min={1} placeholder="Ej. 68.5" required />
              </div>
              <div className="field">
                <label htmlFor="recamaras">Recámaras</label>
                <input id="recamaras" name="recamaras" type="number" min={0} placeholder="Ej. 2" required />
              </div>
            </div>
            <p className="ayuda -mt-2">Los climas por defecto se calculan solos: uno en la sala y uno por recámara.</p>
            <button className="btn btn-sm self-start" disabled={guardando}>Agregar prototipo</button>
          </form>
        </div>
      </details>
      <details className="bo-plegable">
        <summary><span>Datos del proyecto e imagen</span><small>Nombre, anticipo, comisión, cuenta de Stripe y foto</small></summary>
        <form
          className="card flex flex-col gap-5 p-6 sm:p-8"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            enviar(
              `/api/proyectos/${proyectoId}`,
              {
                nombre: f.get("nombre"),
                numeroUnidades: f.get("numeroUnidades"),
                porcentajeAnticipo: Number(f.get("porcentajeAnticipo")) / 100,
                porcentajeComision: Number(f.get("porcentajeComision")) / 100,
                minimoPlan: f.get("minimoPlan"),
                fechaEntregaUnidades: f.get("fechaEntregaUnidades") || null,
                imagen: f.get("imagen") || null,
                stripeConnectedAccountId: f.get("stripeConnectedAccountId") || null,
              },
              null,
              "PATCH",
              () => "Cambios del proyecto guardados."
            );
          }}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="p-nombre">Nombre del proyecto</label>
              <input id="p-nombre" name="nombre" defaultValue={datos.nombre} required />
            </div>
            <div className="field">
              <label htmlFor="p-fecha">Entrega estimada</label>
              <input id="p-fecha" name="fechaEntregaUnidades" type="date" defaultValue={datos.fechaEntregaUnidades ?? ""} />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-4">
            <div className="field">
              <label htmlFor="p-unidades">Departamentos</label>
              <input id="p-unidades" name="numeroUnidades" type="number" min={1} defaultValue={datos.numeroUnidades} required />
            </div>
            <div className="field">
              <label htmlFor="p-anticipo">Anticipo (%)</label>
              <input id="p-anticipo" name="porcentajeAnticipo" type="number" step="0.01" defaultValue={datos.porcentajeAnticipo} required />
            </div>
            <div className="field">
              <label htmlFor="p-comision">Comisión (%)</label>
              <input id="p-comision" name="porcentajeComision" type="number" step="0.01" defaultValue={datos.porcentajeComision} required />
            </div>
            <div className="field">
              <label htmlFor="p-minimo">Mínimo a financiar ($)</label>
              <input id="p-minimo" name="minimoPlan" type="number" step="100" defaultValue={datos.minimoPlan} required />
            </div>
          </div>
          <p className="ayuda -mt-2">
            Cambiar el anticipo, la comisión o el mínimo sólo afecta planes nuevos: los apartados conservan sus condiciones.
          </p>
          <div className="field">
            <label htmlFor="p-cuenta">Cuenta de Stripe de Moretti (Connect)</label>
            <input
              id="p-cuenta"
              name="stripeConnectedAccountId"
              placeholder="acct_…"
              pattern="acct_[A-Za-z0-9]+"
              defaultValue={datos.stripeConnectedAccountId ?? ""}
              className="font-mono"
            />
            <p className="ayuda">
              Ahí cae el cobro de este proyecto y día uno se queda la comisión. Sin ella no se cobra con Stripe.
            </p>
          </div>
          <SubirImagen name="imagen" inicial={datos.imagen} etiqueta="Foto del proyecto" />
          <button className="btn self-start" disabled={guardando}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
        </form>
      </details>
    </section>
  );
}
