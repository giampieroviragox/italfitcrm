import { createHmac, timingSafeEqual } from "node:crypto";

export type InviteContext = {
  email: string;
  token_hash: string;
  type: "invite" | "recovery";
};

export function signInvite(context: InviteContext, secret: string) {
  if (!secret) throw new Error("Chiave server non configurata.");
  const payload = Buffer.from(JSON.stringify(context)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`italfit-invite:${payload}`)
    .digest("hex");
  return `${payload}.${signature}`;
}

export function readInvite(
  value: string,
  secret: string,
): InviteContext | null {
  if (!secret || value.length > 2048) return null;
  const [payload, signature, extra] = value.split(".");
  if (
    !payload ||
    !signature ||
    !/^[a-f0-9]{64}$/.test(signature ?? "") ||
    extra !== undefined
  )
    return null;
  const expected = createHmac("sha256", secret)
    .update(`italfit-invite:${payload}`)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) return null;
  try {
    const data: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    );
    if (
      !data ||
      typeof data !== "object" ||
      !("email" in data) ||
      typeof data.email !== "string" ||
      data.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ||
      !("token_hash" in data) ||
      typeof data.token_hash !== "string" ||
      !/^[a-zA-Z0-9_-]{32,256}$/.test(data.token_hash) ||
      !("type" in data) ||
      (data.type !== "invite" && data.type !== "recovery")
    )
      return null;
    return { email: data.email, token_hash: data.token_hash, type: data.type };
  } catch {
    return null;
  }
}
