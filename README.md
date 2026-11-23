# Vertex Engine ⚡

Vertex is a lightweight, closure-based domain logic engine for JavaScript applications. It acts as the "back of the front-end," encapsulating business rules, API interactions, and state mutations while keeping your UI layer completely decoupled and presentation-focused.

Vertex uses **Dependency Injection** to bind domain controllers with reactive state containers (such as **Radius**) and HTTP clients (such as **db_http**), providing a clean, functional toolbelt for every feature module.

---

## Key Features

- 🔒 **Closure-Based Encapsulation:** True privacy with zero `this` binding pitfalls or private class syntax.
- 🎯 **Domain-Driven Controllers:** Clean, modular controllers with scoped state access.
- 💉 **Dependency Injection:** Automatically injects state, logging, event bus, and HTTP utilities into every controller context.
- ⏱️ **Late-Bound State Store:** Engine instances and controllers can be initialized and registered first, with the state store attached later at runtime.
- 📡 **Built-in Event Bus:** Pub/sub channel for decoupled, action-driven cross-controller communication.
- 🪵 **Scoped Logger:** Namespace-prefixed logging with environment-level and controller-level overrides.
- 🌐 **HTTP Client Integration:** Pre-configured HTTP client (`db_http`) injected directly into controller toolbelts.
- 🧪 **Testable by Design:** Easily mock state stores, event listeners, and HTTP clients for unit testing.

---

## Installation

```bash
# Using Yarn
yarn add vertex_engine

# Using NPM
npm install vertex_engine
```

---

## Core Concepts

Vertex relies on three main concepts:

1. **`createEngine`**: The central registry and runtime environment managing state injection, event routing, logging, and HTTP capabilities.
2. **`defineController`**: A standard factory wrapper that defines feature-scoped logic and provides a standardized context toolbelt.
3. **Context Toolbelt**: An object passed to every controller's `setup()` function containing `state`, `globalState`, `logger`, `events`, and `http`.

---

## Quick Start

### 1. Define a Controller

Use `defineController` to build isolated domain features. Destructure the utilities you need directly from the `context` parameter.

```js
// src/engine/controllers/userController.js
import { defineController } from 'vertex_engine';

export const userController = defineController({
  name: 'user', // Matches state slice key ('user')
  logLevel: 'info', // Optional per-controller log level override
  setup({ state, globalState, logger, events, http }) {
    async function login(credentials) {
      logger.info('Attempting login for:', credentials.email);

      try {
        // 1. HTTP request via injected client
        const user = await http.post('/auth/login', credentials);

        // 2. Scoped state mutation
        state.set({
          isAuthenticated: true,
          profile: user,
          error: null,
        });

        // 3. Emit transient event
        events.emit('user:logged_in', user);
      } catch (err) {
        logger.error('Login failed:', err.message);
        state.set({ isAuthenticated: false, error: err.message });
      }
    }

    function logout() {
      state.set({ isAuthenticated: false, profile: null, error: null });
      events.emit('user:logged_out');
    }

    return {
      login,
      logout,
    };
  },
});
```

### 2. Instantiate Vertex & Attach State

Vertex can be initialized with a state store immediately or connected later via `engine.setStateStore(store)`.

```js
// src/engine/engine.js
import { createEngine } from 'vertex_engine';
import { userController } from './controllers/userController.js';

// 1. Instantiate Engine (Can be created before state exists)
export const engine = createEngine({
  logLevel: 'info',
  logEnabled: import.meta.env.DEV, // Enable logs in development only
  httpConfig: {
    baseUrl: 'https://api.example.com/v1',
    timeout: 10000,
  },
});

// 2. Register Controllers
engine.register(userController);
```

### 3. Connect State & Consume Actions in UI

In your application entry point, attach your Radius state store instance and invoke actions.

```js
// src/main.js
import { createState } from 'radius_state_manager';
import { engine } from './engine/engine.js';

// 1. Initialize reactive state store
const appState = createState({
  user: { isAuthenticated: false, profile: null, error: null },
});

// 2. Attach state store to Vertex
engine.setStateStore(appState);

// 3. Retrieve public actions
const userActions = engine.getActions('user');

// 4. Execute actions
document.querySelector('#login-btn').addEventListener('click', () => {
  userActions.login({ email: 'user@example.com', password: 'secretpassword' });
});
```

---

## Real-World Usage Scenarios & Patterns

### Scenario 1: Late-Bound State Injection (Library & Framework Package Pattern)

When packaging an engine into a shared module or library, the engine and controllers are often instantiated before the consuming application creates its state store.

```js
// lib/engineInstance.js
import { createEngine, defineController } from 'vertex_engine';

export const engine = createEngine({
  httpConfig: { baseUrl: 'https://api.mycompany.com' }
});

const cartController = defineController({
  name: 'cart',
  setup({ state, http }) {
    return {
      async addItem(item) {
        const current = state.get() || { items: [] };
        state.set({ items: [...current.items, item] });
        await http.post('/cart/items', item);
      }
    };
  }
});

engine.register(cartController);

// app/bootstrap.js
import { createState } from 'radius_state_manager';
import { engine } from 'lib/engineInstance.js';

// Consuming project creates its own state store and attaches it to the engine
const appState = createState({ cart: { items: [] } });
engine.setStateStore(appState);
```

---

### Scenario 2: Cross-Controller Communication via Event Bus

When actions in one domain need to trigger side effects in another domain without hard-coupling controllers or polluting state, use the `events` bus.

```js
// src/engine/controllers/analyticsController.js
import { defineController } from 'vertex_engine';

export const analyticsController = defineController({
  name: 'analytics',
  setup({ events, logger, http }) {
    // Listen for events emitted by other controllers
    events.on('user:logged_in', (user) => {
      logger.info('Tracking login event for user:', user.id);
      http.post('/analytics/event', { event: 'LOGIN', userId: user.id });
    });

    events.on('cart:item_added', (item) => {
      logger.info('Tracking add-to-cart event:', item.id);
      http.post('/analytics/event', { event: 'ADD_TO_CART', itemId: item.id });
    });

    return {};
  },
});
```

---

### Scenario 3: Cross-Domain State Access via `globalState`

When a controller action needs to read state outside its domain (e.g., checking if `user` is logged in before placing an order in `checkout`), use `globalState`.

```js
// src/engine/controllers/checkoutController.js
import { defineController } from 'vertex_engine';

export const checkoutController = defineController({
  name: 'checkout',
  setup({ state, globalState, logger, http }) {
    async function processCheckout() {
      // Cross-domain state read via globalState
      const userState = globalState.getState('user');
      const cartState = globalState.getState('cart');

      if (!userState?.isAuthenticated) {
        logger.warn('Checkout blocked: User is not authenticated');
        state.set({ status: 'error', message: 'Must be logged in to checkout' });
        return;
      }

      state.set({ status: 'processing' });
      
      const orderPayload = {
        userId: userState.profile.id,
        items: cartState.items,
      };

      const orderResult = await http.post('/checkout/submit', orderPayload);
      state.set({ status: 'completed', orderId: orderResult.id });
    }

    return { processCheckout };
  },
});
```

---

### Scenario 4: Controller-Level Logging Overrides

You can control console noise by setting global log defaults on `createEngine` while overriding specific controllers during active feature development or production silencing.

```js
// Silence noisy background controllers while keeping detailed logs for active development
export const backgroundSyncController = defineController({
  name: 'backgroundSync',
  logEnabled: false, // Completely silences logging for this controller
  setup({ logger }) {
    // These logs will be skipped automatically
    logger.info('Syncing background data...'); 
    return {};
  }
});

export const paymentController = defineController({
  name: 'payment',
  logLevel: 'debug', // Shows detailed debug logs for payment operations
  logEnabled: true,
  setup({ logger }) {
    // ...
    return {};
  }
});
```

---

## Context Toolbelt Reference

Every controller's `setup(context)` function receives the following toolbelt:

| Property | Type | Description |
| :--- | :--- | :--- |
| `state` | `Object` | Scoped state helper for this controller's domain slice (`get()`, `set()`). |
| `globalState` | `Object` | Global state accessor for cross-domain reads (`getState(key)`). |
| `logger` | `Object` | Namespace-prefixed logger (`debug`, `info`, `warn`, `error`). |
| `events` | `Object` | Internal pub/sub event bus (`on(event, fn)`, `emit(event, data)`). |
| `http` | `Object` | Injected `db_http` client instance (`get`, `post`, `put`, `delete`, `sendRequest`). |

---

## API Reference

### `createEngine(options)`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `stateStore` | `Object` | `null` | Optional initial Radius state store instance. Can be set later via `setStateStore()`. |
| `logLevel` | `string` | `'info'` | Engine-wide log level threshold (`'debug'`, `'info'`, `'warn'`, `'error'`). |
| `logEnabled` | `boolean` | `true` | Globally enables or silences engine console output. |
| `httpConfig` | `Object` | `null` | Configuration object passed to `createHttpClient` from `db_http`. |
| `httpClient` | `Object` | `null` | Pre-instantiated custom HTTP client to override default creation. |

#### Returned Engine Instance Methods

- `setStateStore(store)`: Attaches or updates the central Radius state store instance.
- `register(controllerDefinition)`: Instantiates and registers a controller module.
- `getActions(controllerName)`: Retrieves the public actions object for a registered controller.
- `events`: Exposes the central `eventBus` instance.
- `http`: Exposes the central `http` client instance.

---

### `defineController(config)`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | **Required** | Namespace key matching the state slice and controller registry. |
| `logLevel` | `string` | Engine default | Override log level specifically for this controller. |
| `logEnabled` | `boolean` | Engine default | Override log enabled/disabled state for this controller. |
| `setup` | `Function` | **Required** | Factory execution function receiving `context` and returning public actions. |

---

## Running Unit Tests

Vertex uses [Vitest](https://vitest.dev/) for unit testing.

```bash
# Run unit tests
yarn test

# Run tests in watch mode
yarn test:watch
```

---

## License

[MIT](LICENSE)