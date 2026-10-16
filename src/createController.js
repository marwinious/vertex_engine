/**
    Creates a new controller from factory method.
*/
export function defineController({ name, setup, logLevel = 'info', logEnabled=true }) {
    // Factory wrapper now accepts shared utilities from Vertex
    return function controllerFactory({ stateStore, eventBus, getLogger, http }) {
        // Create namespace-scoped logger automatically for this controller
        const logger = getLogger(name, logLevel, logEnabled)

        const context = {
            // Scoped Radius state helper
            state: {
                get: () => stateStore.getState(name),
                set: (value, runListeners) => {
                    if (typeof value === "function") {
                        stateStore.setState(
                            (prev) => ({
                                ...prev,
                                [name]: value(prev[name]),
                            }),
                            runListeners,
                        )
                    } else {
                        stateStore.setState({ [name]: value }, runListeners)
                    }
                },
            },
            globalState: stateStore,

            // Injected Utilities
            events: eventBus,
            logger: logger,
            http: http, // Injected db_http instance
        }

        const actions = setup(context)

        return {
            name,
            actions,
        }
    }
}
