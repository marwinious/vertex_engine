export function createMockStore(initialState = {}) {
    let state = { ...initialState }
    const watchCallbacks = new Map()

    return {
        getState: (key) => (key ? state[key] : state),
        setState: (updater, runListeners = true) => {
            if (typeof updater === "function") {
                state = updater(state)
            } else {
                state = { ...state, ...updater }
            }
            if (runListeners) {
                watchCallbacks.forEach((cb, key) => cb(state[key]))
            }
        },
        watch: (key, callback) => {
            watchCallbacks.set(key, callback)
            return () => watchCallbacks.delete(key)
        },
    }
}
