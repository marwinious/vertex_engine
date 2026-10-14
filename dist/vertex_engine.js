//#region src/utils/createEventBus.js
/**
Creates a new internal event bus for transient events.

// Broadcast event across engine/UI without mutating state
events.emit('cart:item_added', { itemId: item.id, timestamp: Date.now() });
*/
function createEventBus() {
	const listeners = /* @__PURE__ */ new Map();
	return {
		on(event, callback) {
			if (!listeners.has(event)) listeners.set(event, /* @__PURE__ */ new Set());
			listeners.get(event).add(callback);
			return () => listeners.get(event)?.delete(callback);
		},
		emit(event, payload) {
			if (listeners.has(event)) listeners.get(event).forEach((callback) => {
				try {
					callback(payload);
				} catch (err) {
					console.error(`[EventBus] Error in listener for "${event}":`, err);
				}
			});
		}
	};
}
//#endregion
//#region src/utils/createLogger.js
/**
Creates a new event logger for console logs.

Example:
logger.info('Adding item to cart:', item.id);
*/
function createLogger({ level = "info", enabled = true } = {}) {
	const levels = {
		debug: 0,
		info: 1,
		warn: 2,
		error: 3
	};
	levels[level];
	function format(namespace, msg) {
		return `[Vertex:${namespace}] ${msg}`;
	}
	return function getScopedLogger(namespace, overrideLevel) {
		const currentLevel = overrideLevel && overrideLevel in levels ? levels[overrideLevel] : defaultLevel;
		return {
			debug(msg, ...args) {
				if (enabled && currentLevel <= levels.debug) console.debug(format(namespace, msg), ...args);
			},
			info(msg, ...args) {
				if (enabled && currentLevel <= levels.info) console.log(format(namespace, msg), ...args);
			},
			warn(msg, ...args) {
				if (enabled && currentLevel <= levels.warn) console.warn(format(namespace, msg), ...args);
			},
			error(msg, ...args) {
				if (enabled && currentLevel <= levels.error) console.error(format(namespace, msg), ...args);
			}
		};
	};
}
//#endregion
//#region src/createEngine.js
function createEngine({ stateStore, logLevel = "info" }) {
	const controllers = /* @__PURE__ */ new Map();
	const eventBus = createEventBus();
	const getLogger = createLogger({ level: logLevel });
	function register(controllerDefinition) {
		const instance = controllerDefinition({
			stateStore,
			eventBus,
			getLogger
		});
		controllers.set(instance.name, instance);
		return instance;
	}
	function getActions(name) {
		const controller = controllers.get(name);
		if (!controller) throw new Error(`[Vertex] Controller "${name}" not found.`);
		return controller.actions;
	}
	return {
		register,
		getActions,
		events: eventBus
	};
}
//#endregion
//#region src/createController.js
/**
Creates a new controller from factory method.
*/
function defineController({ name, setup, logLevel = "info" }) {
	return function controllerFactory({ stateStore, eventBus, getLogger }) {
		console.log("logLevel: ", name, logLevel);
		return {
			name,
			actions: setup({
				state: {
					get: () => stateStore.getState(name),
					set: (value, runListeners) => {
						if (typeof value === "function") stateStore.setState((prev) => ({
							...prev,
							[name]: value(prev[name])
						}), runListeners);
						else stateStore.setState({ [name]: value }, runListeners);
					}
				},
				globalState: stateStore,
				events: eventBus,
				logger: getLogger(name, logLevel)
			})
		};
	};
}
//#endregion
export { createEngine, createEventBus, createLogger, defineController };
