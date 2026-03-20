import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import os from 'os';
import { access, mkdir, writeFile } from 'fs/promises';
import { deployToVercel } from '@/lib/deployer';

export async function POST(request: NextRequest) {
    try {
        const { id, portfolioName, html } = await request.json();

        if (!id) {
            return NextResponse.json(
                { error: 'Missing portfolio ID' },
                { status: 400 }
            );
        }

        if (!process.env.VERCEL_API_TOKEN) {
            return NextResponse.json(
                { error: 'Deployment is not configured. Please add a VERCEL_API_TOKEN to enable deployment.' },
                { status: 503 }
            );
        }

        // Recreate directory and index.html if html is provided
        const outputDir = path.join(os.tmpdir(), 'portfoliogy', id);

        if (html) {
            await mkdir(outputDir, { recursive: true });
            await writeFile(path.join(outputDir, 'index.html'), html);
        } else {
            try {
                await access(outputDir);
            } catch {
                return NextResponse.json(
                    { error: 'Portfolio not found. Please generate it first or pass html.' },
                    { status: 404 }
                );
            }
        }

        // Deploy to Vercel
        const result = await deployToVercel(outputDir, portfolioName || 'my-portfolio');

        return NextResponse.json({
            url: result.url,
            deploymentId: result.deploymentId,
        });
    } catch (error) {
        console.error('Deploy error:', error);
        const message = error instanceof Error ? error.message : 'Deployment failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
