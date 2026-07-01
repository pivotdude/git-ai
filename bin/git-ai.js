#!/usr/bin/env bun

import { run } from '../dist/index.js';

run().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
