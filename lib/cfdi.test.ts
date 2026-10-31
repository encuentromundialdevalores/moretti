import { describe, expect, it } from "vitest";
import { uuidDeXml } from "./cfdi";

describe("UUID del XML del CFDI", () => {
  it("lo lee del timbre fiscal", () => {
    const xml = `<cfdi:Complemento><tfd:TimbreFiscalDigital Version="1.1" UUID="6f9619ff-8b86-d011-b42d-00c04fc964ff" FechaTimbrado="2026-10-05"/></cfdi:Complemento>`;
    expect(uuidDeXml(xml)).toBe("6F9619FF-8B86-D011-B42D-00C04FC964FF");
  });
  it("sin timbre no inventa nada", () => {
    expect(uuidDeXml(`<cfdi:Comprobante UUID="6f9619ff-8b86-d011-b42d-00c04fc964ff"/>`)).toBeNull();
    expect(uuidDeXml("no es xml")).toBeNull();
  });
});
