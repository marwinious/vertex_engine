/**
    Creates a new internal event bus for transient events.

    // Broadcast event across engine/UI without mutating state
    events.emit('cart:item_added', { itemId: item.id, timestamp: Date.now() });
*/
export function createEventBus() {
    const listeners = new Map()

    return {
        on(event, callback) {
            if (!listeners.has(event)) {
                listeners.set(event, new Set())
            }
            listeners.get(event).add(callback)

            // Unsubscribe cleanup function
            return () => listeners.get(event)?.delete(callback)
        },

        emit(event, payload) {
            if (listeners.has(event)) {
                listeners.get(event).forEach((callback) => {
                    try {
                        callback(payload)
                    } catch (err) {
                        console.error(
                            `[EventBus] Error in listener for "${event}":`,
                            err,
                        )
                    }
                })
            }
        },
    }
}
