import type { Pasarela } from "./contrato";
import { pasarelaFalsa } from "./falsa";
import { pasarelaStripe } from "./stripe";
import { modoStripe } from "./modo";

/**
 * Único lugar del repo donde se decide qué pasarela usa el motor.
 * Todo lo demás importa `pasarela` de aquí, nunca de "./falsa" ni
 * "./stripe" directamente. (Las pruebas y el seed sí crean su propia
 * pasarela falsa y se la pasan al motor.)
 *
 * Con llaves de prueba, o reales con STRIPE_MODO_REAL=1 (./modo.ts), se
 * cobra con Stripe; si no, con la falsa, para que el prototipo siga
 * corriendo en una máquina sin llaves.
 */
export const pasarela: Pasarela = modoStripe() === "apagado" ? pasarelaFalsa : pasarelaStripe;

export { modoStripe, porQueApagado, topeCentavos, MINIMO_STRIPE_CENTAVOS } from "./modo";

export type {
  Pasarela,
  SolicitudCobro,
  ResultadoCobro,
  SolicitudTarjeta,
  PreparacionTarjeta,
  SolicitudTransferencia,
  ResultadoTransferencia,
  SolicitudConfirmarTarjeta,
  TarjetaConfirmada,
  AccionComprador,
  SolicitudReembolso,
  ReembolsoHecho,
  SolicitudAutorizacion,
} from "./contrato";
export { llaveIdempotencia, llaveReembolso } from "./contrato";
