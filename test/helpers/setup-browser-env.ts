import browserEnv from 'browser-env';
browserEnv();

Object.defineProperty(global, 'fetch', { value: () => {}, writable: true, configurable: true });
