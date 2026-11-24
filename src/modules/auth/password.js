import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const COST = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH, COST);
  return `${salt.toString("base64")}:${key.toString("base64")}`;
}

export async function verifyPassword(password, hash) {
  const [salt, key] = hash.split(":").map((part) => Buffer.from(part, "base64"));
  const candidate = await scryptAsync(password, salt, KEY_LENGTH, COST);
  return timingSafeEqual(candidate, key);
}
