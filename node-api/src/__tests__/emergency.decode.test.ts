import { decodeDistress } from "../services/emergency.service";
import { AppError } from "../utils/AppError";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

describe("decodeDistress", () => {
  it("decodes a pipe frame vehicleId|lat|lng|message", () => {
    const frame = b64("veh-123|25.5725|91.8825|Engine failure");
    const d = decodeDistress(frame);
    expect(d.vehicleId).toBe("veh-123");
    expect(d.latitude).toBeCloseTo(25.5725);
    expect(d.longitude).toBeCloseTo(91.8825);
    expect(d.message).toBe("Engine failure");
  });

  it("defaults the message when omitted from a pipe frame", () => {
    const d = decodeDistress(b64("veh-9|26.1|92.2"));
    expect(d.vehicleId).toBe("veh-9");
    expect(d.message).toMatch(/SOS/i);
  });

  it("decodes a JSON frame", () => {
    const d = decodeDistress(b64('{"v":"veh-7","la":27.5,"ln":91.8,"m":"help"}'));
    expect(d.vehicleId).toBe("veh-7");
    expect(d.latitude).toBeCloseTo(27.5);
    expect(d.message).toBe("help");
  });

  it("throws 400 when the decoded payload is empty", () => {
    try {
      decodeDistress("%%%"); // decodes to nothing
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).statusCode).toBe(400);
    }
  });

  it("throws 422 for a frame with too few fields", () => {
    try {
      decodeDistress(b64("only-one-field"));
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).statusCode).toBe(422);
    }
  });

  it("throws 422 for non-numeric coordinates", () => {
    try {
      decodeDistress(b64("veh-1|north|east|msg"));
      throw new Error("expected to throw");
    } catch (e) {
      expect((e as AppError).statusCode).toBe(422);
    }
  });

  it("throws 422 for out-of-range coordinates", () => {
    try {
      decodeDistress(b64("veh-1|200|400|msg"));
      throw new Error("expected to throw");
    } catch (e) {
      expect((e as AppError).statusCode).toBe(422);
    }
  });
});
