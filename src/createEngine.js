import { createEventBus } from "./utils/createEventBus.js"
import { createLogger } from "./utils/createLogger.js"

export function createEngine({ stateStore, logLevel = "info", logEnabled = true }) {
    const controllers = new Map()

    // Shared engine utilities
    const eventBus = createEventBus()
    const getLogger = createLogger({ level: logLevel, enabled: logEnabled })

    function register(controllerDefinition) {
        // Inject stateStore + eventBus + logger factory
        const instance = controllerDefinition({
            stateStore,
            eventBus,
            getLogger,
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
    }
}
