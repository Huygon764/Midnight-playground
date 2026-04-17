/// <reference types="vite/client" />
import { Buffer } from "buffer";

// @ts-expect-error - support third-party libraries that require NODE_ENV
globalThis.process = {
  env: {
    NODE_ENV: import.meta.env.MODE,
  },
};

globalThis.Buffer = Buffer;
