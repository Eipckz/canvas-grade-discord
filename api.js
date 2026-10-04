// Firefox exposes promise-based browser APIs; modern Chromium exposes chrome APIs.
export const api = globalThis.browser ?? globalThis.chrome;
