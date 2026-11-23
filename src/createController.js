/**
    Creates a new controller from factory method.
*/
export function defineController({ name, setup, logLevel, logEnabled }) {
    return function controllerFactory({ 
        stateStore, 
        eventBus, 
        getLogger, 
        http,
        getScopedState,
        globalStateProxy
    }) {
        const logger = getLogger(name, logLevel, logEnabled);

        const context = {
            // Lazy-evaluated state scoped to this controller name
            state: getScopedState ? getScopedState(name) : {
                get: () => stateStore.getState(name),
                set: (value, runListeners) => {
                    if (typeof value === "function") {
                        stateStore.setState(
                            (prev) => ({
                                ...prev,
                                [name]: value(prev[name]),
                            }),
                            runListeners,
                        );
                    } else {
                        stateStore.setState({ [name]: value }, runListeners);
                    }
                },
            },
            globalState: globalStateProxy || stateStore,
            events: eventBus,
            logger: logger,
            http: http,
        };

        const actions = setup(context);

        return {
            name,
            actions,
        };
    };
}