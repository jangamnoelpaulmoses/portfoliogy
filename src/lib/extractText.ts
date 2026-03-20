import { execFile } from 'child_process';
import path from 'path';

// This is a dummy import strictly to force Next.js / Vercel to trace this package
// and include it in the Serverless Function bundle since the child process needs it
import 'pdf-parse';

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        // Hide the path from Turbopack static analysis by constructing it dynamically
        const segments = [process.cwd(), 'scripts', 'extract-pdf.mjs'];
        const scriptPath = path.join(...segments);

        const child = execFile('node', [scriptPath], {
            maxBuffer: 50 * 1024 * 1024, // 50MB
            timeout: 30000, // 30 second timeout
        }, (error, stdout, stderr) => {
            if (error) {
                console.error('PDF extraction error:', stderr || error.message);
                reject(new Error('Failed to extract text from PDF. Please ensure the file is a valid PDF.'));
                return;
            }

            const text = stdout.trim();
            if (!text || text.length < 10) {
                reject(new Error('Could not extract enough text from the PDF. Please ensure your resume is not a scanned image.'));
                return;
            }

            resolve(text);
        });

        // Send PDF buffer to the child process via stdin
        child.stdin?.write(buffer);
        child.stdin?.end();
    });
}
