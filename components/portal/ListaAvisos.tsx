import Link from "next/link";
import type { Rol } from "@prisma/client";
import { avisosDe, marcarVistos, vistoEn } from "@/lib/avisos";

const cuando = (f: Date) => f.toLocaleString("es-MX", { timeZone: "America/Monterrey", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Los avisos de un perfil, los nuevos resaltados (D-54). Al abrir la página
 * quedan vistos: el contador del menú vuelve a cero.
 */
export default async function ListaAvisos({ clave, rol }: { clave: string; rol: Rol }) {
  const [avisos, desde] = await Promise.all([avisosDe(rol), vistoEn(clave)]);
  await marcarVistos(clave);
  if (avisos.length === 0) return <div className="pt-vacio">Sin avisos todavía. Aquí te avisamos cuando alguien cambie una fecha, cumpla una fase, escriba o suba una factura.</div>;
  return (
    <ul className="pt-avisos">
      {avisos.map((a) => {
        const contenido = <><span className="pt-aviso-texto">{a.texto}</span><span className="pt-aviso-cuando">{cuando(a.createdAt)}</span></>;
        return (
          <li key={a.id} data-nuevo={a.createdAt > desde || undefined}>
            {a.href ? <Link href={a.href}>{contenido}</Link> : <div>{contenido}</div>}
          </li>
        );
      })}
    </ul>
  );
}
