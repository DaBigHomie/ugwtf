import { describe, it, expect, vi } from 'vitest';
import { createLogger } from '../utils/logger.js';

describe('utils/logger', () => {
  it('creates a logger with all methods', () => {
    const logger = createLogger();
    expect(logger.info).toBeTypeOf('function');
    expect(logger.warn).toBeTypeOf('function');
    expect(logger.error).toBeTypeOf('function');
    expect(logger.success).toBeTypeOf('function');
    expect(logger.debug).toBeTypeOf('function');
    expect(logger.group).toBeTypeOf('function');
    expect(logger.groupEnd).toBeTypeOf('function');
  });

  it('info logs to console', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger();
    logger.info('test message');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toContain('test message');
    spy.mockRestore();
  });

  it('debug is silent when verbose=false', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger(false);
    logger.debug('hidden');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('debug logs when verbose=true', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger(true);
    logger.debug('visible');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toContain('visible');
    spy.mockRestore();
  });

  it('group increases indentation', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger();
    logger.group('outer');
    logger.info('indented');
    // The indented message should have extra spaces compared to a root message
    const call = spy.mock.calls[1]?.[0] as string;
    expect(call).toContain('  '); // at least one indent level
    spy.mockRestore();
  });

  it('groupEnd does not go below zero indent', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger();
    logger.groupEnd(); // Already at 0
    logger.groupEnd(); // Still at 0
    logger.info('no crash');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
