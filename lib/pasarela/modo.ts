/**
 * Único lugar que decide con qué llaves de Stripe se cobra (D-44, D-56).
 *
 * - **prueba**: `sk_test_` (o `rk_test_`) y `pk_test_`. Como siempre.
 * - **real**: `sk_live_` (o `rk_live_`) y `pk_live_` y, además,
 *   `STRIPE_MODO_REAL=1`. Sin la bandera, unas llaves reales no hacen nada:
 *   el motor cobra con la pasarela falsa y el webhook rechaza los eventos.
 *   En modo real ningún cobro ni transferencia pasa de `STRIPE_TOPE_CENTAVOS`
 *   (por defecto $300 MXN).
 * - **apagado**: sin llaves, llaves mezcladas o reales sin bandera.
 *
 * En los dos modos ningún cobro baja del mínimo de Stripe en MXN ($10.00):
 * Stripe lo rechaza con `amount_too_small` y el motor lo tomaría como «la
 * pasarela no respondió».
 */

export type Modo = "prueba" | "real" | "apagado";

/** Lo menos que Stripe cobra en MXN. */
export const MINIMO_STRIPE_CENTAVOS = 10_00;

/** Tope por cobro en modo real si no se fija otro. */
export const TOPE_REAL_CENTAVOS = 300_00;

type Entorno = Record<string, string | undefined>;

const esPrueba = (llave: string) => llave.startsWith("sk_test_") || llave.startsWith("rk_test_");
const esReal = (llave: string) => llave.startsWith("sk_live_") || llave.startsWith("rk_live_");

export function modoStripe(env: Entorno = process.env): Modo {
  const secreta = env.STRIPE_SECRET_KEY?.trim() ?? "";
  const publica = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
  if (esPrueba(secreta) && (publica === "" || publica.startsWith("pk_test_"))) return "prueba";
  if (esReal(secreta) && publica.startsWith("pk_live_") && env.STRIPE_MODO_REAL?.trim() === "1") return "real";
  return "apagado";
}

/** Si el navegador puede capturar tarjetas: Stripe encendido y con llave publicable. */
export function cobroEnLinea(env: Entorno = process.env): boolean {
  return modoStripe(env) !== "apagado" && Boolean(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim());
}

/** Por qué está apagado, para decirlo en pantalla. null si no lo está. */
export function porQueApagado(env: Entorno = process.env): string | null {
  if (modoStripe(env) !== "apagado") return null;
  const secreta = env.STRIPE_SECRET_KEY?.trim() ?? "";
  const publica = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
  if (!secreta) return "Falta STRIPE_SECRET_KEY.";
  if (esReal(secreta) && !publica.startsWith("pk_live_")) {
    return "La llave secreta es real pero la publicable no (debe empezar con pk_live_).";
  }
  if (esReal(secreta)) return "Las llaves son reales pero falta STRIPE_MODO_REAL=1.";
  if (esPrueba(secreta)) return "La llave secreta es de prueba pero la publicable no (debe empezar con pk_test_).";
  return "STRIPE_SECRET_KEY no es una llave de Stripe (sk_test_, sk_live_, rk_test_ o rk_live_).";
}

/** El tope por cobro: sólo en modo real. null = sin tope. */
export function topeCentavos(env: Entorno = process.env): number | null {
  if (modoStripe(env) !== "real") return null;
  const valor = Number(env.STRIPE_TOPE_CENTAVOS?.trim() || TOPE_REAL_CENTAVOS);
  return Number.isInteger(valor) && valor >= MINIMO_STRIPE_CENTAVOS ? valor : TOPE_REAL_CENTAVOS;
}
