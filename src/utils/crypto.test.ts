import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './crypto.ts';

describe('password hashing for the in-browser data', () => {
  it('salts every hash and verifies only the right password', async () => {
    const first = await hashPassword('Segura2026*');
    const second = await hashPassword('Segura2026*');
    expect(first).not.toBe(second);
    expect(first).not.toContain('Segura2026*');
    expect(await verifyPassword('Segura2026*', first)).toBe(true);
    expect(await verifyPassword('otra', first)).toBe(false);
  });

  it('never accepts a demo account without a stored hash', async () => {
    expect(await verifyPassword('', '')).toBe(false);
    expect(await verifyPassword('Admin123*', '')).toBe(false);
  });
});
