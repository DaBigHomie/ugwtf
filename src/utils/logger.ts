/**
 * Console logger with color-coded output and indentation.
 */
import type { Logger } from '../types.js';

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const GRAY = '\x1b[90m';
const BOLD = '\x1b[1m';

/** Create a colour-coded console logger.
 * @param verbose - When `true`, `logger.debug()` messages are printed.
 * @returns A {@link Logger} instance.
 */
export function createLogger(verbose = false): Logger {
  let indent = 0;
  const pad = () => '  '.repeat(indent);

  return {
    info(msg) { console.log(`${pad()}${BLUE}INFO${RESET} ${msg}`); },
    warn(msg) { console.log(`${pad()}${YELLOW}WARN${RESET} ${msg}`); },
    error(msg) { console.log(`${pad()}${RED}ERROR${RESET} ${msg}`); },
    success(msg) { console.log(`${pad()}${GREEN}OK${RESET} ${msg}`); },
    debug(msg) { if (verbose) console.log(`${pad()}${GRAY}DEBUG${RESET} ${msg}`); },
    group(label) { console.log(`${pad()}${BOLD}${label}${RESET}`); indent++; },
    groupEnd() { indent = Math.max(0, indent - 1); },
  };
}
