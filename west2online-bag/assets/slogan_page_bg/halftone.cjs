#!/usr/bin/env node
'use strict';

// Use the logo background's screen and defaults with this folder's source image.
const { main } = require('../logo_page_bg/halftone.cjs');

main(process.argv.slice(2), __dirname).catch(error => {
  console.error(`Halftone export failed: ${error.message}`);
  process.exitCode = 1;
});
