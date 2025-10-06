import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { authConfig } from './config';

const secret = new TextEncoder().encode(authConfig.jwt.secret);

export interface JWTPayloadWithAuth extends JWTPayload {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  type: 'access' | 'refresh';
}

export async function signJWT(
  payload: Omit<JWTPayloadWithAuth, 'iat' | 'exp' | 'iss' | 'aud'>,
  expirationTime?: string
): Promise<string> {
  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(authConfig.jwt.issuer)
    .setAudience(authConfig.jwt.audience);

  if (expirationTime) {
    jwt.setExpirationTime(expirationTime);
  } else {
    jwt.setExpirationTime(
      payload.type === 'refresh'
        ? authConfig.jwt.refreshExpirationTime
        : authConfig.jwt.expirationTime
    );
  }

  return jwt.sign(secret);
}

export async function verifyJWT(token: string): Promise<JWTPayloadWithAuth> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: authConfig.jwt.issuer,
      audience: authConfig.jwt.audience,
    });

    return payload as JWTPayloadWithAuth;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

export async function createTokens(payload: {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
}) {
  const [accessToken, refreshToken] = await Promise.all([
    signJWT({ ...payload, type: 'access' }),
    signJWT({ ...payload, type: 'refresh' }),
  ]);

  return { accessToken, refreshToken };
}