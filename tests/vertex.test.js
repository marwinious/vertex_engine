import { describe, it, expect, vi, beforeEach } from "vitest"
import { createEngine, defineController } from "../src/index.js"
import { createMockStore } from "./helpers/createMockStore.js"

describe("Vertex Engine Core", () => {
    let store
    let engine

    beforeEach(() => {
        store = createMockStore({
            cart: { items: [] },
            user: { name: "Darius" },
        })
        engine = createEngine({ stateStore: store, logLevel: "error" })
    })

    describe("Controller Registration & Retrieval", () => {
        it("should register a controller and expose its actions", () => {
            const dummyController = defineController({
                name: "dummy",
                setup() {
                    return { ping: () => "pong" }
                },
            })

            engine.register(dummyController)
            const actions = engine.getActions("dummy")

            expect(actions.ping()).toBe("pong")
        })

        it("should throw an error when attempting to get an unregistered controller", () => {
            expect(() => engine.getActions("nonexistent")).toThrow(
                '[Vertex] Controller "nonexistent" not found.',
            )
        })
    })

    describe("Scoped State Behavior", () => {
        it("should allow a controller to read its scoped state", () => {
            const userController = defineController({
                name: "user",
                setup({ state }) {
                    return {
                        getName: () => state.get().name,
                    }
                },
            })

            engine.register(userController)
            const actions = engine.getActions("user")

            expect(actions.getName()).toBe("Darius")
        })

        it("should mutate state scoped strictly to its domain name", () => {
            const cartController = defineController({
                name: "cart",
                setup({ state }) {
                    return {
                        addItem(item) {
                            state.set((prev = { items: [] }) => ({
                                ...prev,
                                items: [...prev.items, item],
                            }))
                        },
                    }
                },
            })

            engine.register(cartController)
            const actions = engine.getActions("cart")

            actions.addItem({ id: "prod_1", name: "Widget" })

            expect(store.getState("cart")).toEqual({
                items: [{ id: "prod_1", name: "Widget" }],
            })
            // Ensure other slices remain untouched
            expect(store.getState("user")).toEqual({ name: "Darius" })
        })

        it("should support cross-domain state reads via globalState", () => {
            const checkoutController = defineController({
                name: "checkout",
                setup({ globalState }) {
                    return {
                        getUserName: () => globalState.getState("user")?.name,
                    }
                },
            })

            engine.register(checkoutController)
            const actions = engine.getActions("checkout")

            expect(actions.getUserName()).toBe("Darius")
        })
    })

    describe("Late-Bound State Injection (setStateStore)", () => {
        it("should throw an informative error if state is accessed before setStateStore is called", () => {
            const unattachedEngine = createEngine()
            const userController = defineController({
                name: "user",
                setup({ state }) {
                    return {
                        getName: () => state.get().name,
                    }
                },
            })

            unattachedEngine.register(userController)
            const actions = unattachedEngine.getActions("user")

            expect(() => actions.getName()).toThrow(
                '[Vertex:user] State store has not been initialized on Vertex. Call engine.setStateStore(store) first.',
            )
        })

        it("should seamlessly connect state when setStateStore is invoked after registration", () => {
            const standaloneEngine = createEngine()
            const userController = defineController({
                name: "user",
                setup({ state }) {
                    return {
                        getName: () => state.get().name,
                    }
                },
            })

            standaloneEngine.register(userController)
            const actions = standaloneEngine.getActions("user")

            // Late attach state store
            standaloneEngine.setStateStore(store)

            expect(actions.getName()).toBe("Darius")
        })
    })

    describe("Internal Event Bus Integration", () => {
        it("should publish and receive events between controllers via the context bus", () => {
            const listenerSpy = vi.fn()

            const listenerController = defineController({
                name: "listener",
                setup({ events }) {
                    events.on("item:added", listenerSpy)
                    return {}
                },
            })

            const senderController = defineController({
                name: "sender",
                setup({ events }) {
                    return {
                        sendEvent: (data) => events.emit("item:added", data),
                    }
                },
            })

            engine.register(listenerController)
            engine.register(senderController)

            const sender = engine.getActions("sender")
            sender.sendEvent({ id: 101 })

            expect(listenerSpy).toHaveBeenCalledTimes(1)
            expect(listenerSpy).toHaveBeenCalledWith({ id: 101 })
        })
    })

    describe("Scoped Logger Integration", () => {
        it("should inject a namespace-prefixed logger into controller setup", () => {
            const consoleSpy = vi
                .spyOn(console, "log")
                .mockImplementation(() => {})

            const verboseEngine = createEngine({
                stateStore: store,
                logLevel: "info",
            })

            const loggedController = defineController({
                name: "loggerTest",
                setup({ logger }) {
                    return {
                        doSomething: () => logger.info("Executing action"),
                    }
                },
            })

            verboseEngine.register(loggedController)
            verboseEngine.getActions("loggerTest").doSomething()

            expect(consoleSpy).toHaveBeenCalledWith(
                "[Vertex:loggerTest] Executing action",
            )

            consoleSpy.mockRestore()
        })

        it("should honor controller-level logEnabled overrides", () => {
            const consoleSpy = vi
                .spyOn(console, "log")
                .mockImplementation(() => {})

            const verboseEngine = createEngine({
                stateStore: store,
                logLevel: "info",
                logEnabled: true,
            })

            const silencedController = defineController({
                name: "silenced",
                logEnabled: false,
                setup({ logger }) {
                    return {
                        doSomething: () => logger.info("Should not appear"),
                    }
                },
            })

            verboseEngine.register(silencedController)
            verboseEngine.getActions("silenced").doSomething()

            expect(consoleSpy).not.toHaveBeenCalled()

            consoleSpy.mockRestore()
        })
    })

    describe("HTTP Helper Integration", () => {
        it("should expose the HTTP client instance to controller context", () => {
            const httpController = defineController({
                name: "apiTest",
                setup({ http }) {
                    return {
                        hasHttp: () => Boolean(http && typeof http.sendRequest === "function"),
                    }
                },
            })

            engine.register(httpController)
            const actions = engine.getActions("apiTest")

            expect(actions.hasHttp()).toBe(true)
        })
    })
})