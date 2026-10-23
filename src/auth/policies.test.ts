import { describe, expect, it } from 'vitest';
import { AdminPolicy, EngineerPolicy, StudentPolicy, policyFor } from './policies.ts';

describe('RolePolicy (patrón Strategy)', () => {
  it('picks the strategy for each role', () => {
    expect(policyFor('Administrador')).toBeInstanceOf(AdminPolicy);
    expect(policyFor('Ingeniero')).toBeInstanceOf(EngineerPolicy);
    expect(policyFor('Estudiante')).toBeInstanceOf(StudentPolicy);
  });

  it('gives an unknown role the most limited strategy', () => {
    expect(policyFor('Invitado')).toBeInstanceOf(StudentPolicy);
  });

  it('administrators can do everything', () => {
    const admin = new AdminPolicy();
    expect(admin.can('admin:access')).toBe(true);
    expect(admin.can('projects:manage-any')).toBe(true);
    expect(admin.projectLimit()).toBe(Infinity);
  });

  it('engineers export and edit, but do not administer', () => {
    const engineer = new EngineerPolicy();
    expect(engineer.can('models:export')).toBe(true);
    expect(engineer.can('elements:edit')).toBe(true);
    expect(engineer.can('admin:access')).toBe(false);
    expect(engineer.can('projects:view-all')).toBe(false);
  });

  it('students only edit elements and own up to three projects', () => {
    const student = new StudentPolicy();
    expect(student.can('elements:edit')).toBe(true);
    expect(student.can('models:export')).toBe(false);
    expect(student.projectLimit()).toBe(3);
  });
});
