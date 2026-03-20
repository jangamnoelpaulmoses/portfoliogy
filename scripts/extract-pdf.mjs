#!/usr/bin/env node
// Standalone PDF text extraction script
// Called via child_process to avoid Turbopack bundling issues with pdfjs-dist

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

async function main() {
    // Read PDF buffer from stdin
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
        process.stderr.write('No PDF data received on stdin');
        process.exit(1);
    }

    // Use pdf-parse to extract text

    // We need to pass the buffer to pdfParse
    const data = await pdfParse(buffer);

    // Output extracted text to stdout
    process.stdout.write(data.text);
}

main().catch(err => {
    process.stderr.write(err.message || 'Unknown error');
    process.exit(1);
});
