/** Lee el UUID del timbre fiscal de un XML de CFDI («UUID="…"»). Null si no lo trae. */
export function uuidDeXml(xml: string): string | null {
  const m = xml.match(/TimbreFiscalDigital[^>]*\sUUID\s*=\s*"([0-9a-fA-F-]{36})"/);
  return m ? m[1].toUpperCase() : null;
}
