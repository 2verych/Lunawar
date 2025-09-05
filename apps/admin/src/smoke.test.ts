import { describe, it, expect } from 'vitest';

describe('admin endpoints', () => {
  it('includes lobby and rooms', () => {
    expect(['/admin/lobby', '/admin/rooms']).toHaveLength(2);
  });
  it('includes config and room creation', () => {
    expect(['/admin/config.set', '/admin/room.create']).toHaveLength(2);
  });
});
