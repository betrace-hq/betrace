import { WorkOS } from '@workos-inc/node';

export const workos = new WorkOS(process.env.WORKOS_API_KEY);

export const authConfig = {
  workos: {
    apiKey: process.env.WORKOS_API_KEY!,
    clientId: process.env.WORKOS_CLIENT_ID!,
    redirectUri: process.env.WORKOS_REDIRECT_URI!,
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    issuer: 'fluo-bff',
    audience: 'betrace-app',
    expirationTime: '15m', // Short-lived access tokens
    refreshExpirationTime: '7d', // Longer-lived refresh tokens
  },
  session: {
    cookieName: 'fluo-session',
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    },
  },
} as const;

export const isConfigValid = () => {
  const requiredEnvVars = [
    'WORKOS_API_KEY',
    'WORKOS_CLIENT_ID',
    'WORKOS_REDIRECT_URI',
    'JWT_SECRET',
  ];

  return requiredEnvVars.every(
    (varName) => process.env[varName] && process.env[varName]!.length > 0
  );
};