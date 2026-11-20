import { describe, expect, it } from 'vitest';
import { isExpired, tokenExpiresAt } from './jwt.ts';

const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (payload: object) => `${encode({ alg: 'HS256' })}.${encode(payload)}.firma`;

describe('jwt', () => {
  it('reads the expiry of a JWT in milliseconds', () => {
    expect(tokenExpiresAt(jwt({ sub: '1', exp: 1_800_000_000 }))).toBe(1_800_000_000_000);
  });

  it('treats random or broken tokens as "no expiry known"', () => {
    expect(tokenExpiresAt('a1b2c3')).toBeNull();
    expect(tokenExpiresAt('x.%%%.y')).toBeNull();
    expect(tokenExpiresAt(jwt({ sub: '1' }))).toBeNull();
  });

  it('knows when a session already expired', () => {
    const token = jwt({ exp: 1000 });
    expect(isExpired(token, 999_000)).toBe(false);
    expect(isExpired(token, 1_000_000)).toBe(true);
    expect(isExpired('a1b2c3')).toBe(false);
  });
});
