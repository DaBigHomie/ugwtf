import { describe, it, expect } from 'vitest';
import { resetTransportCache } from './github.js';

describe('clients/github — transport', () => {
  it('exports resetTransportCache function', () => {
    expect(typeof resetTransportCache).toBe('function');
  });

  it('resetTransportCache does not throw', () => {
    expect(() => resetTransportCache()).not.toThrow();
    // Call twice — should be safe to reset multiple times
    expect(() => resetTransportCache()).not.toThrow();
  });
});
