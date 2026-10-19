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
	const defaultLevel = levels[level] ?? 1;
	function format(namespace, msg) {
		return `[Vertex:${namespace}] ${msg}`;
	}
	return function getScopedLogger(namespace, overrideLevel, overrideEnabled) {
		const currentLevel = overrideLevel && overrideLevel in levels ? levels[overrideLevel] : defaultLevel;
		const isLoggingEnabled = typeof overrideEnabled === "boolean" ? overrideEnabled : enabled;
		return {
			debug(msg, ...args) {
				if (isLoggingEnabled && currentLevel <= levels.debug) console.debug(format(namespace, msg), ...args);
			},
			info(msg, ...args) {
				if (isLoggingEnabled && currentLevel <= levels.info) console.log(format(namespace, msg), ...args);
			},
			warn(msg, ...args) {
				if (isLoggingEnabled && currentLevel <= levels.warn) console.warn(format(namespace, msg), ...args);
			},
			error(msg, ...args) {
				if (isLoggingEnabled && currentLevel <= levels.error) console.error(format(namespace, msg), ...args);
			}
		};
	};
}
//#endregion
//#region ../db_http/dist/db_http.js
/**
* Creates an HTTP client instance with encapsulated state and configuration.
* @param {Object} defaultConfig - Initial settings (headers, timeout, base URL, etc.)
*/
function createHttpClient(defaultConfig = {}) {
	let state = {
		baseUrl: defaultConfig.baseUrl || "",
		method: (defaultConfig.method || "GET").toUpperCase(),
		headers: {
			"Content-Type": "application/json",
			"Accept": "application/json",
			...defaultConfig.headers || {}
		},
		timeout: defaultConfig.timeout || 1e4,
		interceptors: {
			request: [],
			response: []
		}
	};
	/**
	* Helper to construct URL query strings safely using URLSearchParams.
	* Handles encoding automatically and strips trailing/leading delimiter issues.
	*/
	function buildQueryString(params = {}) {
		const searchParams = new URLSearchParams();
		Object.entries(params).forEach(([key, value]) => {
			if (value !== void 0 && value !== null) {
				if (Array.isArray(value)) value.forEach((val) => searchParams.append(key, val));
				else searchParams.append(key, value);
			}
		});
		const queryString = searchParams.toString();
		return queryString ? `?${queryString}` : "";
	}
	/**
	* Internal Core Request Handler
	*/
	async function request(endpoint, options = {}) {
		const method = (options.method || state.method).toUpperCase();
		const fullUrl = `${state.baseUrl}${endpoint}`;
		let requestConfig = {
			method,
			headers: {
				...state.headers,
				...options.headers || {}
			}
		};
		if (method !== "GET" && method !== "HEAD") {
			const bodyData = options.body !== void 0 ? options.body : options.bodyObj;
			if (bodyData) requestConfig.body = typeof bodyData === "string" ? bodyData : JSON.stringify(bodyData);
		}
		const controller = new AbortController();
		const timeoutMs = options.timeout || state.timeout;
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
		requestConfig.signal = controller.signal;
		for (const interceptor of state.interceptors.request) requestConfig = await interceptor(requestConfig) || requestConfig;
		try {
			let response = await fetch(fullUrl, requestConfig);
			clearTimeout(timeoutId);
			for (const interceptor of state.interceptors.response) response = await interceptor(response) || response;
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const error = /* @__PURE__ */ new Error(`HTTP ${response.status}: ${response.statusText}`);
				error.status = response.status;
				error.data = errorData;
				throw error;
			}
			if (response.status === 204) return null;
			return await response.json();
		} catch (error) {
			clearTimeout(timeoutId);
			if (error.name === "AbortError") throw new Error(`Request timed out after ${timeoutMs}ms`);
			throw error;
		}
	}
	return {
		sendRequest: request,
		get(endpoint, params = {}, options = {}) {
			return request(`${endpoint}${buildQueryString(params)}`, {
				...options,
				method: "GET"
			});
		},
		post(endpoint, body = {}, options = {}) {
			return request(endpoint, {
				...options,
				method: "POST",
				body
			});
		},
		put(endpoint, body = {}, options = {}) {
			return request(endpoint, {
				...options,
				method: "PUT",
				body
			});
		},
		patch(endpoint, body = {}, options = {}) {
			return request(endpoint, {
				...options,
				method: "PATCH",
				body
			});
		},
		delete(endpoint, options = {}) {
			return request(endpoint, {
				...options,
				method: "DELETE"
			});
		},
		setHeaders(headers = {}) {
			state.headers = {
				...state.headers,
				...headers
			};
			return this;
		},
		setHeader(key, value) {
			state.headers[key] = value;
			return this;
		},
		setBaseUrl(url) {
			state.baseUrl = url;
			return this;
		},
		addRequestInterceptor(fn) {
			state.interceptors.request.push(fn);
			return this;
		},
		addResponseInterceptor(fn) {
			state.interceptors.response.push(fn);
			return this;
		},
		buildQueryString
	};
}
//#endregion
//#region src/createEngine.js
function createEngine({ stateStore = null, logLevel = "info", logEnabled = true, httpConfig = null, httpClient = null } = {}) {
	let currentStateStore = stateStore;
	const controllers = /* @__PURE__ */ new Map();
	const eventBus = createEventBus();
	const getLogger = createLogger({
		level: logLevel,
		enabled: logEnabled
	});
	let http = httpClient;
	if (!http && httpConfig) http = createHttpClient(httpConfig);
	else if (!http) http = createHttpClient();
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
				if (!currentStateStore) throw new Error(`[Vertex:${controllerName}] State store has not been initialized on Vertex. Call engine.setStateStore(store) first.`);
				return currentStateStore.getState(controllerName);
			},
			set: (value, runListeners) => {
				if (!currentStateStore) throw new Error(`[Vertex:${controllerName}] State store has not been initialized on Vertex. Call engine.setStateStore(store) first.`);
				if (typeof value === "function") currentStateStore.setState((prev) => ({
					...prev,
					[controllerName]: value(prev[controllerName])
				}), runListeners);
				else currentStateStore.setState({ [controllerName]: value }, runListeners);
			}
		};
	}
	/**
	* Lazy global state accessor for cross-controller state reads
	*/
	const globalStateProxy = {
		getState: (key) => {
			if (!currentStateStore) throw new Error("[Vertex] State store has not been initialized on Vertex. Call engine.setStateStore(store) first.");
			return currentStateStore.getState(key);
		},
		setState: (...args) => {
			if (!currentStateStore) throw new Error("[Vertex] State store has not been initialized on Vertex. Call engine.setStateStore(store) first.");
			return currentStateStore.setState(...args);
		},
		watch: (...args) => {
			if (!currentStateStore) throw new Error("[Vertex] State store has not been initialized on Vertex. Call engine.setStateStore(store) first.");
			return currentStateStore.watch(...args);
		}
	};
	function register(controllerDefinition) {
		const instance = controllerDefinition({
			stateStore: currentStateStore,
			eventBus,
			getLogger,
			http,
			getScopedState: createScopedState,
			globalStateProxy
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
		setStateStore,
		register,
		getActions,
		events: eventBus,
		http
	};
}
//#endregion
//#region src/createController.js
/**
Creates a new controller from factory method.
*/
function defineController({ name, setup, logLevel, logEnabled }) {
	return function controllerFactory({ stateStore, eventBus, getLogger, http, getScopedState, globalStateProxy }) {
		const logger = getLogger(name, logLevel, logEnabled);
		return {
			name,
			actions: setup({
				state: getScopedState ? getScopedState(name) : {
					get: () => stateStore.getState(name),
					set: (value, runListeners) => {
						if (typeof value === "function") stateStore.setState((prev) => ({
							...prev,
							[name]: value(prev[name])
						}), runListeners);
						else stateStore.setState({ [name]: value }, runListeners);
					}
				},
				globalState: globalStateProxy || stateStore,
				events: eventBus,
				logger,
				http
			})
		};
	};
}
//#endregion
export { createEngine, createEventBus, createLogger, defineController };
