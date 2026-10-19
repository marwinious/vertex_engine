import { createEventBus } from "./utils/createEventBus.js"
import { createLogger } from "./utils/createLogger.js"
import { createHttpClient } from "db_http"

export function createEngine({ 
    stateStore = null, 
    logLevel = "info", 
    logEnabled = true,
    httpConfig = null,
    httpClient = null 
} = {}) {
    let currentStateStore = stateStore;
    const controllers = new Map();
    const eventBus = createEventBus();
    const getLogger = createLogger({ level: logLevel, enabled: logEnabled });

    let http = httpClient;
    if (!http && httpConfig) {
        http = createHttpClient(httpConfig);
    } else if (!http) {
        http = createHttpClient();
    }

    /**
     * Connect or update the Radius state store reference
     * @param {Object} store - Radius state instance
     */
    function setStateStore(store) {
        currentStateStore = store;
    }

    /**
     * Creates the lazy state accessor injected into controller setup contexts
     */
    function createScopedState(controllerName) {
        return {
            get: () => {
                if (!currentStateStore) {
                    throw new Error(`[Vertex:${controllerName}] State store has not been initialized on Vertex. Call engine.setStateStore(store) first.`);
                }
                return currentStateStore.getState(controllerName);
            },
            set: (value, runListeners) => {
                if (!currentStateStore) {
                    throw new Error(`[Vertex:${controllerName}] State store has not been initialized on Vertex. Call engine.setStateStore(store) first.`);
                }
                if (typeof value === "function") {
                    currentStateStore.setState(
                        (prev) => ({
                            ...prev,
                            [controllerName]: value(prev[controllerName]),
                        }),
                        runListeners
                    );
                } else {
                    currentStateStore.setState({ [controllerName]: value }, runListeners);
                }
            }
        };
    }

    /**
     * Lazy global state accessor for cross-controller state reads
     */
    const globalStateProxy = {
        getState: (key) => {
            if (!currentStateStore) {
                throw new Error('[Vertex] State store has not been initialized on Vertex. Call engine.setStateStore(store) first.');
            }
            return currentStateStore.getState(key);
        },
        setState: (...args) => {
            if (!currentStateStore) {
                throw new Error('[Vertex] State store has not been initialized on Vertex. Call engine.setStateStore(store) first.');
            }
            return currentStateStore.setState(...args);
        },
        watch: (...args) => {
            if (!currentStateStore) {
                throw new Error('[Vertex] State store has not been initialized on Vertex. Call engine.setStateStore(store) first.');
            }
            return currentStateStore.watch(...args);
        }
    };

    function register(controllerDefinition) {
        const instance = controllerDefinition({
            stateStore: currentStateStore,
            eventBus,
            getLogger,
            http,
            // Pass lazy accessors into definition context
            getScopedState: createScopedState,
            globalStateProxy
        });

        controllers.set(instance.name, instance);
        return instance;
    }

    function getActions(name) {
        const controller = controllers.get(name);
        if (!controller)
            throw new Error(`[Vertex] Controller "${name}" not found.`);
        return controller.actions;
    }

    return {
        setStateStore,
        register,
        getActions,
        events: eventBus,
        http
    };
}