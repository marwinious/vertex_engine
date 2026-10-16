# Vertex Engine ⚡

Vertex is a lightweight, closure-based domain logic engine for JavaScript applications. It acts as the "back of the front-end," encapsulating business rules, API interactions, and state mutations while keeping your UI layer completely decoupled and presentation-focused.

Vertex uses **Dependency Injection** to bind domain controllers with reactive state containers (like [Radius](https://github.com/your-username/radius)) and optional HTTP clients (like [db_http](https://github.com/your-username/db_http)), providing a clean, functional toolbelt for every feature module.

---

## Key Features

- 🔒 **Closure-Based Encapsulation:** True privacy with zero `this` binding pitfalls or private class syntax.
- 🎯 **Domain-Driven Controllers:** Clean modular controllers with scoped state access.
- 💉 **Dependency Injection:** Automatically injects state, logging, event bus, and HTTP utilities into every controller context.
- 📡 **Built-in Event Bus:** Pub/sub channel for decoupled, action-driven cross-controller communication.
- 🪵 **Scoped Logger:** Namespace-prefixed logging with environment-level and controller-level overrides.
- 🧪 **Testable by Design:** Easily mock state stores and HTTP clients for unit testing.

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

1. **`createEngine`**: The central registry and runtime environment that manages state injection, event routing, logging, and HTTP capabilities.
2. **`defineController`**: A standard factory wrapper that defines feature-scoped logic and provides a standardized context toolbelt.
3. **Context Toolbelt**: An object passed to every controller's `setup()` function containing `state`, `globalState`, `logger`, `events`, and optional `http` client.

---

## Quick Start

### 1. Define a Controller

Use `defineController` to build isolated domain features. Destructure the utilities you need directly from the `context` object.

```js
// src/engine/controllers/userController.js
import { defineController } from 'vertex_engine';

export const userController = defineController({
  name: 'user', // Defines the state slice key ('user')
  logLevel: 'info', // Optional per-controller log level override
  setup({ state, globalState, logger, events, http }) {
    
    async function login(credentials) {
      logger.info('Attempting login for:', credentials.email);

      try {
        // 1. HTTP operation via injected client
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

    // Public API returned to the UI / Engine
    return {
      login,
      logout,
    };
  },
});
```

### 2. Instantiate Vertex & Register Controllers

Initialize Vertex by passing your reactive state store instance (e.g., Radius) and optional HTTP/logging configs.

```js
// src/engine/engine.js
import { createEngine } from 'vertex_engine';
import { createState } from 'radius_state_manager';
import { userController } from './controllers/userController.js';

// 1. Initialize reactive state
export const stateStore = createState({
  user: { isAuthenticated: false, profile: null, error: null },
});

// 2. Instantiate Vertex Engine
export const engine = createEngine({
  stateStore,
  logLevel: 'info',
  logEnabled: import.meta.env.DEV, // Enable logs in development only
  httpConfig: {
    baseUrl: 'https://api.example.com/v1',
    timeout: 10000,
  },
});

// 3. Register Controllers
engine.register(userController);
```

### 3. Consume Actions in Your UI

Your UI layer simply retrieves actions from Vertex. No `this` binding required!

```js
// src/main.js
import { engine } from './engine/engine.js';

// Retrieve public actions
const userActions = engine.getActions('user');

// Execute actions directly from event listeners or stores
const loginBtn = document.querySelector('#login-btn');
loginBtn.addEventListener('click', () => {
  userActions.login({ email: 'user@example.com', password: 'secretpassword' });
});
```

---

## Context Toolbelt Reference

Every controller's `setup(context)` receives the following toolbelt:

| Property | Type | Description |
| :--- | :--- | :--- |
| `state` | `Object` | Scoped helper for this controller's slice (`get()`, `set()`). |
| `globalState` | `Object` | The full root state store instance (escape hatch for cross-domain reads). |
| `logger` | `Object` | Namespace-prefixed logger (`debug`, `info`, `warn`, `error`). |
| `events` | `Object` | Engine pub/sub bus (`on(event, fn)`, `emit(event, data)`). |
| `http` | `Object` | Injected HTTP client instance (`get`, `post`, `put`, `delete`, `sendRequest`). |

---

## Configuration Options

### `createEngine(options)`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `stateStore` | `Object` | **Required** | The central reactive state store instance (e.g., Radius). |
| `logLevel` | `string` | `'info'` | Engine-wide log level threshold (`'debug'`, `'info'`, `'warn'`, `'error'`). |
| `logEnabled` | `boolean`| `true` | Globally enables or silences all engine console output. |
| `httpConfig` | `Object` | `null` | Configuration object passed to `createHttpClient` from `db_http`. |
| `httpClient` | `Object` | `null` | Pre-instantiated custom HTTP client to override default creation. |

### `defineController(config)`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | **Required** | Namespace key matching the state slice and controller registry. |
| `logLevel` | `string` | Engine default | Override log level specifically for this controller. |
| `logEnabled` | `boolean`| Engine default | Override log enabled/disabled state for this controller. |
| `setup` | `Function`| **Required** | Factory execution function receiving `context` and returning public actions. |

---

## Running Tests

Vertex uses [Vitest](https://vitest.dev/) for unit testing.

```bash
# Run tests
yarn test

# Run tests in watch mode
yarn test:watch
```

---

## License

[MIT](LICENSE)