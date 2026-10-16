import { createEventBus } from "./utils/createEventBus.js"
import { createLogger } from "./utils/createLogger.js"
import { createHttpClient } from "db_http"

export function createEngine({ 
        stateStore, 
        logLevel = "info", 
        logEnabled = true,
        httpConfig = null,  // Optional: defaultConfig object for createHttpClient
        httpClient = null   // Optional: pre-instantiated createHttpClient instance
    } = {}) {
    const controllers = new Map()

    // Shared engine utilities
    const eventBus = createEventBus()
    const getLogger = createLogger({ level: logLevel, enabled: logEnabled })

    // Optional HTTP client instantiation
    let http = httpClient;
    if (!http && httpConfig) {
        http = createHttpClient(httpConfig)
    } 
    else if (!http) {
        // Optional default fallback if you want HTTP always present, or leave as null
        http = createHttpClient()
    }

    function register(controllerDefinition) {
        // Inject stateStore + eventBus + logger factory
        const instance = controllerDefinition({
            stateStore,
            eventBus,
            getLogger,
            http,
        })

        controllers.set(instance.name, instance)
        return instance
    }

    function getActions(name) {
        const controller = controllers.get(name)
        if (!controller)
            throw new Error(`[Vertex] Controller "${name}" not found.`)
        return controller.actions
    }

    return {
        register,
        getActions,
        events: eventBus, // Expose eventBus externally to UI if needed
        http, // Expose http instance on engine if needed externally
    }
}
