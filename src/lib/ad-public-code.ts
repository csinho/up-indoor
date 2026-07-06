const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateAdPublicCode(length = 6) {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export function normalizeAdPublicCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}
