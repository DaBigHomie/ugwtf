/**
 * Mock logger for testing.
 * Captures all log output for assertions.
 */
import type { Logger } from '../types.js';

export interface MockLogger extends Logger {
  messages: Array<{ level: string; msg: string }>;
}

export function createMockLogger(): MockLogger {
  const messages: Array<{ level: string; msg: string }> = [];

  return {
    messages,
    info(msg) { messages.push({ level: 'info', msg }); },
    warn(msg) { messages.push({ level: 'warn', msg }); },
    error(msg) { messages.push({ level: 'error', msg }); },
    success(msg) { messages.push({ level: 'success', msg }); },
    debug(msg) { messages.push({ level: 'debug', msg }); },
    group(label) { messages.push({ level: 'group', msg: label }); },
    groupEnd() { messages.push({ level: 'groupEnd', msg: '' }); },
  };
}
