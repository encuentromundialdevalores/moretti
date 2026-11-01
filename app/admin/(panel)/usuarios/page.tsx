import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { PageHead } from "@/components/ui";
import { ETIQUETA_ROL } from "@/lib/permisos";
import NuevaCuenta from "./NuevaCuenta";
import AccionesCuenta from "./AccionesCuenta";

const fecha = (f: Date | null) => (f ? f.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "—");

/** Cuentas y roles (D-49): alta con liga de invitación, editar, nueva liga, desactivar y borrar. */
export default async function UsuariosPage() {
  await connection();
  const [usuarios, compradores, desarrolladores] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: [{ rol: "asc" }, { nombre: "asc" }],
      include: { comprador: { select: { nombre: true, unidad: { select: { torre: true, numero: true } } } }, desarrollador: { select: { nombre: true } } },
    }),
    prisma.comprador.findMany({ select: { id: true, nombre: true, folio: true, unidad: { select: { torre: true, numero: true } } }, orderBy: { nombre: "asc" } }),
    prisma.desarrollador.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
  ]);
  const ahora = new Date();
  const opcionesCompradores = compradores.map((c) => ({ id: c.id, texto: `${c.nombre} · ${c.unidad.torre} ${c.unidad.numero} · ${c.folio}` }));
  return (
    <div className="flex flex-col gap-8">
      <PageHead
        eyebrow="Usuarios"
        titulo="Cuentas y perfiles"
        descripcion="Cada quien entra en /entrar con su correo y ve sólo lo suyo. Al crear la cuenta te damos una liga de un solo uso para que la persona elija su contraseña; mándasela por correo o WhatsApp."
      />
      <NuevaCuenta compradores={opcionesCompradores} desarrolladores={desarrolladores} />
      <table className="tbl">
        <thead><tr><th>Nombre</th><th>Perfil</th><th>Ligado a</th><th>Estado</th><th>Último acceso</th><th></th></tr></thead>
        <tbody>
          {usuarios.map((u) => {
            const estado = !u.activo
              ? <span className="chip late">Desactivada</span>
              : u.contrasenaHash
                ? <span className="chip ok">Activa</span>
                : u.invitacionVence && u.invitacionVence > ahora
                  ? <span className="chip warn">Invitación enviada</span>
                  : u.invitacionVence
                    ? <span className="chip wait">Liga vencida</span>
                    : <span className="chip warn">Sin invitar · mándale su liga</span>;
            return (
              <tr key={u.id}>
                <td><b>{u.nombre}</b><br /><span className="text-[12.5px] text-muted">{u.correo}</span></td>
                <td>{ETIQUETA_ROL[u.rol].nombre}<br /><span className="text-[12.5px] text-muted">{ETIQUETA_ROL[u.rol].quien}</span></td>
                <td className="text-ink-2">{u.comprador ? `${u.comprador.nombre} · ${u.comprador.unidad.torre} ${u.comprador.unidad.numero}` : u.desarrollador?.nombre ?? "—"}</td>
                <td>{estado}</td>
                <td>{fecha(u.ultimoAcceso)}</td>
                <td><AccionesCuenta cuenta={{ id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol, compradorId: u.compradorId, desarrolladorId: u.desarrolladorId }} activo={u.activo} compradores={opcionesCompradores} desarrolladores={desarrolladores} /></td>
              </tr>
            );
          })}
          {usuarios.length === 0 && <tr><td colSpan={6} className="text-ink-2">Todavía no hay cuentas.</td></tr>}
        </tbody>
      </table>
      <p className="bo-nota">
        Las cuentas de día uno (perfil «día uno») entran al back office. Todos entran por /entrar. La contraseña única de respaldo (ADMIN_PASSWORD_HASH) sigue sirviendo en /admin/login.
      </p>
    </div>
  );
}
