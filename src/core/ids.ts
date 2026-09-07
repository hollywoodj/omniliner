const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

export function uid(prefix = ""): string {
  let s = "";
  for (let i = 0; i < 11; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return prefix ? `${prefix}${s}` : s;
}

export function nowIso(): string {
  return new Date().toISOString();
}
