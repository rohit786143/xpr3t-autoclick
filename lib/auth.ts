import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "autoclick_session";

function getJwtSecretKey(): Uint8Array {
  const secret =
    process.env.JWT_SECRET || "super-secret-autoclick-jwt-key-2026-secure";
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sub: string;
  email: string;
  role: "admin" | "user";
  name?: string;
  xpr3tUsername?: string;
  isGhost?: boolean;
  originalAdminId?: string;
  iat?: number;
  exp?: number;
}

export async function signSessionToken(payload: {
  id: string;
  email: string;
  role: "admin" | "user";
  name?: string;
  xpr3tUsername?: string;
  isGhost?: boolean;
  originalAdminId?: string;
}): Promise<string> {
  return new SignJWT({
    sub: payload.id,
    email: payload.email,
    role: payload.role,
    name: payload.name || "",
    xpr3tUsername: payload.xpr3tUsername || "",
    isGhost: !!payload.isGhost,
    originalAdminId: payload.originalAdminId || "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
