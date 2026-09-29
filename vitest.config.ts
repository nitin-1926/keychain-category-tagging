import { defineConfig } from 'vitest/config';

// Integration tests need the local embedding model; they skip themselves when it is absent.
export default defineConfig({
  test: {
    testTimeout: 120_000,
  },
});
