import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { crearPasarelaFalsa } from "@/lib/pasarela/falsa";
import { cobrarAnticipo, darDeAlta } from "@/lib/motor/planes";
import { baseLimpiaConCatalogo, firmarContrato, paquete, unidadLibre } from "@/pruebas/utilidades";
import { activarCuenta, autenticar, cambiarActivo, crearUsuario, generarInvitacion, VIGENCIA_INVITACION_MS } from "./cuentas";
import { unidadesParaDesarrollador, unidadesParaMoretti, unidadesParaVerificador } from "./portal-datos";

const CONTRASENA = "una frase larga";

beforeEach(baseLimpiaConCatalogo);

async function vendida() {
  const unidad = await unidadLibre("DEPA 2R (tipo 717)");
  const { plan } = await darDeAlta({ nombre: "Lucía", contacto: "81", unidadId: unidad.id, paqueteId: (await paquete("casa-lista")).id });
  await firmarContrato(unidad.id);
  await cobrarAnticipo(plan.id, { pasarela: crearPasarelaFalsa() });
  return { unidad, plan };
}

describe("Cuentas: alta, invitación y acceso (D-49)", () => {
  it("invitación → contraseña → entra; la liga sólo sirve una vez", async () => {
    const u = await crearUsuario({ correo: " Moretti@Ejemplo.MX ", nombre: "Moretti", rol: "MORETTI" });
    expect(u.correo).toBe("moretti@ejemplo.mx");
    expect(await autenticar("moretti@ejemplo.mx", CONTRASENA)).toBeNull(); // sin contraseña aún
    const token = await generarInvitacion(u.id);
    const guardado = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
    expect(guardado.invitacionHash).not.toContain(token); // sólo el hash
    await activarCuenta(token, CONTRASENA);
    expect((await autenticar("MORETTI@ejemplo.mx", CONTRASENA))?.id).toBe(u.id);
    expect(await autenticar("moretti@ejemplo.mx", "otra contraseña")).toBeNull();
    await expect(activarCuenta(token, CONTRASENA)).rejects.toThrow(/ya no es válida/);
  });

  it("una liga nueva anula la anterior, y una vencida no sirve", async () => {
    const u = await crearUsuario({ correo: "v@e.mx", nombre: "V", rol: "VERIFICADOR" });
    const vieja = await generarInvitacion(u.id);
    const nueva = await generarInvitacion(u.id);
    await expect(activarCuenta(vieja, CONTRASENA)).rejects.toThrow(/ya no es válida/);
    const tarde = new Date(Date.now() + VIGENCIA_INVITACION_MS + 1000);
    await expect(activarCuenta(nueva, CONTRASENA, tarde)).rejects.toThrow(/ya no es válida/);
  });

  it("contraseña corta se rechaza", async () => {
    const u = await crearUsuario({ correo: "c@e.mx", nombre: "C", rol: "MORETTI" });
    await expect(activarCuenta(await generarInvitacion(u.id), "corta")).rejects.toThrow(/al menos 10/);
  });

  it("desactivada ya no entra", async () => {
    const u = await crearUsuario({ correo: "d@e.mx", nombre: "D", rol: "MORETTI" });
    await activarCuenta(await generarInvitacion(u.id), CONTRASENA);
    await cambiarActivo(u.id, false);
    expect(await autenticar("d@e.mx", CONTRASENA)).toBeNull();
  });

  it("comprador y desarrollador tienen que estar ligados; correo repetido no", async () => {
    await expect(crearUsuario({ correo: "x@e.mx", nombre: "X", rol: "COMPRADOR" })).rejects.toThrow(/ligado a su plan/);
    await expect(crearUsuario({ correo: "x@e.mx", nombre: "X", rol: "DESARROLLADOR" })).rejects.toThrow(/desarrollador/);
    await crearUsuario({ correo: "x@e.mx", nombre: "X", rol: "MORETTI" });
    await expect(crearUsuario({ correo: "X@e.mx", nombre: "X", rol: "MORETTI" })).rejects.toThrow(/Ya hay una cuenta/);
  });

  it("a un Moretti no se le queda pegado un comprador", async () => {
    const { plan } = await vendida();
    const u = await crearUsuario({ correo: "m@e.mx", nombre: "M", rol: "MORETTI", compradorId: plan.compradorId });
    expect(u.compradorId).toBeNull();
  });
});

describe("Lo que lee cada perfil (D-48)", () => {
  it("Moretti y el verificador no reciben precios ni comisión", async () => {
    await vendida();
    const texto = JSON.stringify([await unidadesParaMoretti(), await unidadesParaVerificador()]);
    expect(texto).not.toMatch(/precio|comision|monto|saldo|stripe|contacto/i);
    expect((await unidadesParaMoretti()).length).toBe(1);
  });

  it("PISSA sólo ve las unidades de su desarrollador, sin comprador", async () => {
    const { unidad } = await vendida();
    const proyecto = await prisma.proyecto.findUniqueOrThrow({ where: { id: unidad.proyectoId } });
    const suyas = await unidadesParaDesarrollador(proyecto.desarrolladorId);
    expect(suyas.map((x) => x.id)).toEqual([unidad.id]);
    expect(JSON.stringify(suyas)).not.toMatch(/Lucía|precio|monto/);
    const otro = await prisma.desarrollador.create({ data: { nombre: "Otro" } });
    expect(await unidadesParaDesarrollador(otro.id)).toEqual([]);
  });

  it("una cotización sin anticipo todavía no es venta", async () => {
    const unidad = await unidadLibre("DEPA 2R (tipo 717)");
    await darDeAlta({ nombre: "Cotiza", contacto: "81", unidadId: unidad.id, paqueteId: (await paquete("casa-lista")).id });
    expect(await unidadesParaMoretti()).toEqual([]);
  });
});
