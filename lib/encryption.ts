import crypto from "crypto";

// Ensure ENCRYPTION_KEY is 32 bytes (256 bits) for AES-256
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY_NEW 
  ? Buffer.from(process.env.ENCRYPTION_KEY_NEW, 'hex')
  : crypto.randomBytes(32);

// Ensure ENCRYPTION_IV is 16 bytes (128 bits) for AES-256-CBC
const ENCRYPTION_IV = process.env.ENCRYPTION_IV
  ? Buffer.from(process.env.ENCRYPTION_IV, 'hex')
  : crypto.randomBytes(16);

const ALGORITHM = "aes-256-cbc";

// Validate encryption parameters
if (ENCRYPTION_KEY.length !== 32) {
  throw new Error(`Invalid key length: expected 32 bytes, got ${ENCRYPTION_KEY.length}`);
}

if (ENCRYPTION_IV.length !== 16) {
  throw new Error(`Invalid IV length: expected 16 bytes, got ${ENCRYPTION_IV.length}`);
}

console.log(ENCRYPTION_KEY, "ENCRYPTION_KEY", ENCRYPTION_IV, "ENCRYPTION_IV");

export function encrypt(text: string): string {
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, ENCRYPTION_IV);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

export function decrypt(encrypted: string): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, ENCRYPTION_IV);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}