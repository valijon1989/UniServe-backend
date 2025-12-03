export interface JwtPayload {
  sub: string;
  role: 'USER' | 'AGENT' | 'ADMIN';
}
