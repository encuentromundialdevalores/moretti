import { beforeAll, describe, expect, it } from "vitest";
import { crearToken, crearTokenPortal, leerTokenPortal, verificarToken } from "./sesion";

beforeAll(() => {
  process.env.SESSION_SECRET ??= "x".repeat(40);
});

describe("Sesión del portal (D-49)", () => {
  it("un token del portal se lee con su usuario y su rol", async () => {
    const t = await crearTokenPortal({ uid: "u1", rol: "MORETTI" });
    expect(await leerTokenPortal(t)).toEqual({ uid: "u1", rol: "MORETTI" });
  });
  it("un token del portal NO abre el back office", async () => {
    expect(await verificarToken(await crearTokenPortal({ uid: "u1", rol: "MORETTI" }))).toBe(false);
  });
  it("un token del back office NO abre el portal", async () => {
    expect(await leerTokenPortal(await crearToken())).toBeNull();
  });
  it("cambiar el rol dentro del token rompe la firma", async () => {
    const [, firma] = (await crearTokenPortal({ uid: "u1", rol: "COMPRADOR" })).split(".");
    const falso = Buffer.from(JSON.stringify({ sub: "portal", uid: "u1", rol: "MORETTI", exp: Date.now() + 1e6 })).toString("base64url");
    expect(await leerTokenPortal(`${falso}.${firma}`)).toBeNull();
  });
  it("vacío o basura → null", async () => {
    expect(await leerTokenPortal(undefined)).toBeNull();
    expect(await leerTokenPortal("a.b")).toBeNull();
  });
});
