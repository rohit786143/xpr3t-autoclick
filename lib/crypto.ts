import crypto from "crypto";
import bcrypt from "bcryptjs";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getSecretKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_SECRET || "autoclick-aes-256-gcm-secret-key-2026";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Hashes a plaintext password using bcrypt (10 salt rounds).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compares a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Encrypts target website password with AES-256-GCM so the Playwright worker
 * can decrypt and type it into login forms when a session expires.
 */
export function encryptTargetPassword(plainText: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getSecretKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts target website password for Playwright form filling.
 */
export function decryptTargetPassword(cipherText: string | null | undefined): string {
  if (!cipherText) return "";
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 3) return cipherText;

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = getSecretKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return "";
  }
}

