/**
    Creates a new event logger for console logs.

    Example:
    logger.info('Adding item to cart:', item.id);
*/
export function createLogger({ level = "info", enabled = true } = {}) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 }
    const defaultLevel = levels[level] ?? 1;

    function format(namespace, msg) {
        return `[Vertex:${namespace}] ${msg}`
    }

    return function getScopedLogger(namespace, overrideLevel, overrideEnabled) {
        // Resolve level: prefer controller override if valid, otherwise use engine default
        const currentLevel = (overrideLevel && overrideLevel in levels) 
            ? levels[overrideLevel] 
            : defaultLevel;

        // Resolve enabled status: use controller-level override if explicitly passed (boolean), 
        // otherwise fall back to global engine enabled setting
        const isLoggingEnabled = typeof overrideEnabled === 'boolean' 
            ? overrideEnabled 
            : enabled;

        return {
            debug(msg, ...args) {
                if (isLoggingEnabled && currentLevel <= levels.debug) {
                    console.debug(format(namespace, msg), ...args)
                }
            },
            info(msg, ...args) {
                if (isLoggingEnabled && currentLevel <= levels.info) {
                    console.log(format(namespace, msg), ...args)
                }
            },
            warn(msg, ...args) {
                if (isLoggingEnabled && currentLevel <= levels.warn) {
                    console.warn(format(namespace, msg), ...args)
                }
            },
            error(msg, ...args) {
                if (isLoggingEnabled && currentLevel <= levels.error) {
                    console.error(format(namespace, msg), ...args)
                }
            },
        }
    }
}