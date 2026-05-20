import { describe, expect, it } from 'vitest';
import { moveMemberInOrder, sanitizeMemberOrder } from './memberOrder';

describe('member order utilities', () => {
  it('keeps saved order and appends newly available members', () => {
    expect(sanitizeMemberOrder(['Cara', 'Alice'], ['Alice', 'Bob', 'Cara'])).toEqual([
      'Cara',
      'Alice',
      'Bob'
    ]);
  });

  it('drops duplicate and unavailable saved members', () => {
    expect(sanitizeMemberOrder(['Bob', 'Bob', 'Missing'], ['Alice', 'Bob'])).toEqual([
      'Bob',
      'Alice'
    ]);
  });

  it('moves a member up or down within bounds', () => {
    expect(moveMemberInOrder(['Alice', 'Bob', 'Cara'], 'Bob', 'up')).toEqual([
      'Bob',
      'Alice',
      'Cara'
    ]);
    expect(moveMemberInOrder(['Alice', 'Bob', 'Cara'], 'Bob', 'down')).toEqual([
      'Alice',
      'Cara',
      'Bob'
    ]);
  });

  it('returns the same order when movement is not possible', () => {
    const order = ['Alice', 'Bob'];
    expect(moveMemberInOrder(order, 'Alice', 'up')).toBe(order);
    expect(moveMemberInOrder(order, 'Missing', 'down')).toBe(order);
  });
});
