import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "autoclick_admin_session";

function getJwtSecretKey(): Uint8Array {
  const secret =
    process.env.JWT_SECRET || "super-secret-autoclick-jwt-key-2026-secure";
  return new TextEncoder().encode(secret);
}

export interface AdminTokenPayload {
  sub: string;
  username: string;
  role: "admin";
  iat?: number;
  exp?: number;
}

export async function signAdminToken(payload: {
  id: string;
  username: string;
}): Promise<string> {
  return new SignJWT({
    sub: payload.id,
    username: payload.username,
    role: "admin",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getJwtSecretKey());
}

export async function verifyAdminToken(
  token: string
): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    if (payload.role !== "admin" || !payload.username) {
      return null;
    }
    return payload as unknown as AdminTokenPayload;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminTokenPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

