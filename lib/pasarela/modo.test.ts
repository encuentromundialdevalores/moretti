import { describe, expect, it } from "vitest";
import { cobroEnLinea, modoStripe, porQueApagado, topeCentavos, TOPE_REAL_CENTAVOS } from "./modo";

const prueba = { STRIPE_SECRET_KEY: "sk_test_x", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_x" };
const real = { STRIPE_SECRET_KEY: "rk_live_x", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_x" };

describe("modo de Stripe (D-44, D-56)", () => {
  it("las llaves de prueba funcionan como siempre, sin tope", () => {
    expect(modoStripe(prueba)).toBe("prueba");
    expect(modoStripe({ STRIPE_SECRET_KEY: "sk_test_x" })).toBe("prueba");
    expect(topeCentavos(prueba)).toBeNull();
    expect(cobroEnLinea({ STRIPE_SECRET_KEY: "sk_test_x" })).toBe(false);
  });

  it("las llaves reales sin la bandera no hacen nada, y se dice por qué", () => {
    expect(modoStripe(real)).toBe("apagado");
    expect(modoStripe({ ...real, STRIPE_MODO_REAL: "true" })).toBe("apagado");
    expect(porQueApagado(real)).toMatch(/STRIPE_MODO_REAL=1/);
  });

  it("con la bandera, modo real con tope por defecto de $300", () => {
    const env = { ...real, STRIPE_MODO_REAL: "1" };
    expect(modoStripe(env)).toBe("real");
    expect(topeCentavos(env)).toBe(TOPE_REAL_CENTAVOS);
    expect(topeCentavos({ ...env, STRIPE_TOPE_CENTAVOS: "15000" })).toBe(15_000);
    // Un tope inválido o debajo del mínimo de Stripe no apaga el tope: vuelve al de por defecto.
    expect(topeCentavos({ ...env, STRIPE_TOPE_CENTAVOS: "abc" })).toBe(TOPE_REAL_CENTAVOS);
    expect(topeCentavos({ ...env, STRIPE_TOPE_CENTAVOS: "500" })).toBe(TOPE_REAL_CENTAVOS);
  });

  it("llaves mezcladas: apagado", () => {
    expect(modoStripe({ STRIPE_SECRET_KEY: "sk_test_x", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_x" })).toBe("apagado");
    expect(modoStripe({ STRIPE_SECRET_KEY: "sk_live_x", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_x", STRIPE_MODO_REAL: "1" })).toBe(
      "apagado"
    );
    expect(modoStripe({})).toBe("apagado");
  });
});
