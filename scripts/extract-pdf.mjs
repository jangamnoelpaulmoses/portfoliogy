#!/usr/bin/env node
// Standalone PDF text extraction script
// Called via child_process to avoid Turbopack bundling issues with pdfjs-dist

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

    // Import pdfjs-dist legacy build
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pdfjsPath = join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs');
    const pdfjsLib = await import(pdfjsPath);

    // Disable worker for server-side usage
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';

    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
        disableFontFace: true,
    });

    const pdf = await loadingTask.promise;
    const textParts = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map(item => item.str)
            .join(' ');
        textParts.push(pageText);
    }

    await pdf.destroy();

    // Output extracted text to stdout
    process.stdout.write(textParts.join('\n'));
}

main().catch(err => {
    process.stderr.write(err.message || 'Unknown error');
    process.exit(1);
});
