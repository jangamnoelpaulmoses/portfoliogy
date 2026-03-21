import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import os from 'os';
import { extractTextFromPDF } from '@/lib/extractText';
import { parseResumeWithAI } from '@/lib/aiParser';
import { rewriteForPortfolio } from '@/lib/aiWriter';
import { renderPortfolio } from '@/lib/templateRenderer';
import { MOCK_PORTFOLIO_DATA } from '@/lib/mockData';

export const maxDuration = 60; // Allow up to 60 seconds for AI processing

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { resumeData, mock } = body;
        const useMock = mock === true;

        // Generate unique ID for this portfolio
        const id = uuidv4();
        let portfolioData;
        let previewHtml;

        if (useMock || !process.env.OPENAI_API_KEY) {
            // Mock mode — use sample data but override with any edits from the frontend
            portfolioData = {
                ...MOCK_PORTFOLIO_DATA,
                ...(resumeData || {})
            };
            previewHtml = await renderPortfolio(portfolioData);
        } else {
            if (!resumeData) {
                return NextResponse.json(
                    { error: 'No resume data provided' },
                    { status: 400 }
                );
            }

            // Step 3: AI rewrite for portfolio
            portfolioData = await rewriteForPortfolio(resumeData);

            // Step 4: Render HTML
            previewHtml = await renderPortfolio(portfolioData);
        }

        // Save generated files to tmp
        const outputDir = path.join(os.tmpdir(), 'portfoliogy', id);
        await mkdir(outputDir, { recursive: true });
        await writeFile(path.join(outputDir, 'index.html'), previewHtml);

        return NextResponse.json({
            id,
            previewHtml,
            parsedData: portfolioData,
        });
    } catch (error) {
        console.error('Generate error:', error);
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
