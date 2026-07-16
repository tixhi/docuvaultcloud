/**
 * Minimal structured logger. Swap for pino/winston in production if desired --
 * kept dependency-free here so the sample stays easy to run anywhere.
 */
function timestamp() {
  return new Date().toISOString();
}

const logger = {
  info: (msg, meta = {}) => console.log(`[${timestamp()}] INFO  ${msg}`, meta),
  warn: (msg, meta = {}) => console.warn(`[${timestamp()}] WARN  ${msg}`, meta),
  error: (msg, meta = {}) => console.error(`[${timestamp()}] ERROR ${msg}`, meta),
};

module.exports = logger;
