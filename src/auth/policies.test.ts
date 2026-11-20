import { describe, expect, it } from 'vitest';
import { AdminPolicy, ClientPolicy, EngineerPolicy, ReviewerPolicy, StudentPolicy, policyFor } from './policies.ts';

describe('RolePolicy (Strategy pattern)', () => {
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

  it('reviewers see and sign off everything but change and create nothing', () => {
    const reviewer = policyFor('Revisor');
    expect(reviewer).toBeInstanceOf(ReviewerPolicy);
    expect(reviewer.can('projects:view-all')).toBe(true);
    expect(reviewer.can('analyses:review-any')).toBe(true);
    expect(reviewer.can('projects:manage-any')).toBe(false);
    expect(reviewer.can('elements:edit')).toBe(false);
    expect(reviewer.projectLimit()).toBe(0);
  });

  it('clients only look at what is shared with them', () => {
    const client = policyFor('Cliente');
    expect(client).toBeInstanceOf(ClientPolicy);
    for (const permission of ['projects:view-all', 'elements:edit', 'models:export', 'projects:share'] as const) {
      expect(client.can(permission)).toBe(false);
    }
    expect(client.projectLimit()).toBe(0);
  });
});
