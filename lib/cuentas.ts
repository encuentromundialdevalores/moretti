/**
 * Cuentas de usuario (D-49): alta, invitación, activación y acceso.
 *
 * Cómo se crea una cuenta:
 *   1. día uno la da de alta en /admin/usuarios (correo, nombre, rol y, si es
 *      comprador o PISSA, a quién pertenece).
 *   2. El sistema genera una liga de invitación de un solo uso que vence en
 *      7 días. Sólo se guarda su SHA-256: quien lea la base no puede usarla.
 *   3. La persona abre la liga, elige su contraseña y entra.
 * Si la liga vence o se pierde, se genera otra (la anterior deja de servir).
 */

import { createHash, randomBytes } from "node:crypto";
import type { Rol } from "@prisma/client";
import { prisma } from "./prisma";
import { hashContrasena, verificarContrasena } from "./contrasena";
import { ReglaError } from "./motor/errores";

export const VIGENCIA_INVITACION_MS = 7 * 24 * 60 * 60 * 1000;
export const MINIMO_CONTRASENA = 10;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const normalizarCorreo = (c: string) => c.trim().toLowerCase();

export async function crearUsuario(params: {
  correo: string;
  nombre: string;
  rol: Rol;
  compradorId?: string | null;
  desarrolladorId?: string | null;
}) {
  const correo = normalizarCorreo(params.correo);
  const nombre = params.nombre.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new ReglaError("El correo no es válido.");
  if (!nombre) throw new ReglaError("Falta el nombre.");
  if (params.rol === "COMPRADOR" && !params.compradorId)
    throw new ReglaError("Un comprador tiene que estar ligado a su plan: elige el comprador.");
  if (params.rol === "DESARROLLADOR" && !params.desarrolladorId)
    throw new ReglaError("Una cuenta de desarrollador tiene que estar ligada a su desarrollador (p. ej. PISSA).");
  if (await prisma.usuario.findUnique({ where: { correo } }))
    throw new ReglaError("Ya hay una cuenta con ese correo.");

  return prisma.usuario.create({
    data: {
      correo,
      nombre,
      rol: params.rol,
      // Sólo se guarda la liga que corresponde al rol: un Moretti nunca queda
      // ligado a un comprador por error.
      compradorId: params.rol === "COMPRADOR" ? params.compradorId : null,
      desarrolladorId: params.rol === "DESARROLLADOR" ? params.desarrolladorId : null,
    },
  });
}

/** Genera una liga nueva (invalida la anterior). Devuelve el token en claro UNA vez. */
export async function generarInvitacion(usuarioId: string, ahora = new Date()) {
  const token = randomBytes(32).toString("base64url");
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { invitacionHash: sha256(token), invitacionVence: new Date(ahora.getTime() + VIGENCIA_INVITACION_MS) },
  });
  return token;
}

/** Quién es el dueño de una liga vigente, para mostrarle su nombre al activar. */
export async function leerInvitacion(token: string, ahora = new Date()) {
  if (!token) return null;
  const u = await prisma.usuario.findUnique({ where: { invitacionHash: sha256(token) } });
  if (!u || !u.activo || !u.invitacionVence || u.invitacionVence < ahora) return null;
  return u;
}

/** La persona elige su contraseña con su liga. La liga ya no sirve después. */
export async function activarCuenta(token: string, contrasena: string, ahora = new Date()) {
  if (contrasena.length < MINIMO_CONTRASENA)
    throw new ReglaError(`La contraseña necesita al menos ${MINIMO_CONTRASENA} caracteres.`);
  if (contrasena.length > 200) throw new ReglaError("La contraseña es demasiado larga.");
  const u = await leerInvitacion(token, ahora);
  if (!u) throw new ReglaError("La liga ya no es válida: venció o ya se usó. Pídele a día uno una nueva.");
  const hash = await hashContrasena(contrasena);
  // Condicionado al hash: si la liga se usa dos veces a la vez, sólo una gana.
  const { count } = await prisma.usuario.updateMany({
    where: { id: u.id, invitacionHash: u.invitacionHash },
    data: { contrasenaHash: hash, invitacionHash: null, invitacionVence: null },
  });
  if (count === 0) throw new ReglaError("La liga ya se usó.");
  return u;
}

/** Correo y contraseña. Null si no coinciden o la cuenta está desactivada. */
export async function autenticar(correo: string, contrasena: string) {
  const u = await prisma.usuario.findUnique({ where: { correo: normalizarCorreo(correo) } });
  if (!u || !u.activo || !u.contrasenaHash) return null;
  if (!(await verificarContrasena(contrasena, u.contrasenaHash))) return null;
  await prisma.usuario.update({ where: { id: u.id }, data: { ultimoAcceso: new Date() } });
  return u;
}

export async function cambiarActivo(usuarioId: string, activo: boolean) {
  return prisma.usuario.update({
    where: { id: usuarioId },
    // Al desactivar, también muere cualquier liga pendiente.
    data: activo ? { activo } : { activo, invitacionHash: null, invitacionVence: null },
  });
}

/**
 * Corrige nombre, correo, perfil o a quién está ligada la cuenta. Si cambia
 * el perfil, la sesión abierta deja de servir (el portal compara el perfil
 * de la cookie con el de la base en cada petición).
 */
export async function editarUsuario(
  usuarioId: string,
  params: { correo: string; nombre: string; rol: Rol; compradorId?: string | null; desarrolladorId?: string | null }
) {
  const correo = normalizarCorreo(params.correo);
  const nombre = params.nombre.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new ReglaError("El correo no es válido.");
  if (!nombre) throw new ReglaError("Falta el nombre.");
  if (params.rol === "COMPRADOR" && !params.compradorId)
    throw new ReglaError("Un comprador tiene que estar ligado a su plan: elige el comprador.");
  if (params.rol === "DESARROLLADOR" && !params.desarrolladorId)
    throw new ReglaError("Una cuenta de desarrollador tiene que estar ligada a su desarrollador (p. ej. PISSA).");
  const otro = await prisma.usuario.findUnique({ where: { correo } });
  if (otro && otro.id !== usuarioId) throw new ReglaError("Ya hay otra cuenta con ese correo.");
  return prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      correo,
      nombre,
      rol: params.rol,
      compradorId: params.rol === "COMPRADOR" ? params.compradorId : null,
      desarrolladorId: params.rol === "DESARROLLADOR" ? params.desarrolladorId : null,
    },
  });
}

/**
 * Borra la cuenta. La bitácora no se toca: guarda el nombre de quien firmó
 * cada cambio como texto, así que el historial sigue completo.
 */
export async function borrarUsuario(usuarioId: string) {
  await prisma.usuario.delete({ where: { id: usuarioId } });
}
