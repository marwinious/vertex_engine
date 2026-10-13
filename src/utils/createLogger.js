/**
    Creates a new event logger for console logs.

    Example:
    logger.info('Adding item to cart:', item.id);
*/
export function createLogger({ level = "info", enabled = true } = {}) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 }
    const currentLevel = levels[level] ?? 1

    function format(namespace, msg) {
        return `[Vertex:${namespace}] ${msg}`
    }

    return function getScopedLogger(namespace) {
        return {
            debug(msg, ...args) {
                if (enabled && currentLevel <= levels.debug) {
                    console.debug(format(namespace, msg), ...args)
                }
            },
            info(msg, ...args) {
                if (enabled && currentLevel <= levels.info) {
                    console.info(format(namespace, msg), ...args)
                }
            },
            warn(msg, ...args) {
                if (enabled && currentLevel <= levels.warn) {
                    console.warn(format(namespace, msg), ...args)
                }
            },
            error(msg, ...args) {
                if (enabled && currentLevel <= levels.error) {
                    console.error(format(namespace, msg), ...args)
                }
            },
        }
    }
}
