/**
 * Piezas del portal: saludo, secciones, filas de tarea y el avance de la
 * unidad en cinco pasos. Estilos en app/portal/portal.css (pt-*), sobre el
 * mismo lenguaje del back office (bo-*).
 */

import { ETAPAS, pasosHechos } from "@/lib/portal-etapas";
import type { EstadoInstalacion, EstadoOperativo } from "@/lib/motor/operacion";

/** «Hola, Ana» y, debajo, en una frase, qué hay hoy. */
export function Saludo({ nombre, titulo, children }: { nombre: string; titulo: string; children?: React.ReactNode }) {
  return (
    <header className="pt-saludo">
      <p className="pt-hola">Hola, {nombre.split(/\s+/)[0]}</p>
      <h1>{titulo}</h1>
      {children && <p className="pt-resumen">{children}</p>}
    </header>
  );
}

export function Seccion({ titulo, cuenta, nota, children }: { titulo: string; cuenta?: number; nota?: string; children: React.ReactNode }) {
  return (
    <section className="bo-seccion">
      <div className="bo-seccion-t">
        <h2>{titulo}{cuenta !== undefined && <span className="pt-cuenta">{cuenta}</span>}</h2>
        {nota && <span>{nota}</span>}
      </div>
      {children}
    </section>
  );
}

/** Una fila: la unidad a la izquierda, lo que pasa en medio y la acción a la derecha. */
export function Fila({ unidad, detalle, children, medio }: { unidad: string; detalle?: string; medio?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="pt-fila">
      <div className="pt-unidad"><b>{unidad}</b>{detalle && <span>{detalle}</span>}</div>
      <div className="pt-medio">{medio}</div>
      <div className="pt-accion">{children}</div>
    </li>
  );
}

export function Lista({ children }: { children: React.ReactNode }) {
  return <ul className="pt-lista">{children}</ul>;
}

/** El avance de la unidad: cinco puntos, los hechos en verde. */
export function Avance({ op, ins, grande = false }: { op: EstadoOperativo; ins: EstadoInstalacion; grande?: boolean }) {
  const hechos = pasosHechos(op, ins);
  return (
    <ol className={`pt-avance ${grande ? "grande" : ""}`} aria-label={`${hechos} de ${ETAPAS.length} pasos`}>
      {ETAPAS.map((e, i) => (
        <li key={e} data-estado={i < hechos ? "hecho" : i === hechos ? "ahora" : undefined}>
          <i aria-hidden="true">{i < hechos ? "✓" : i + 1}</i>
          <span>{e}</span>
        </li>
      ))}
    </ol>
  );
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return <div className="pt-vacio">{children}</div>;
}
