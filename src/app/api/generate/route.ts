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
        const formData = await request.formData();
        const file = formData.get('resume') as File | null;
        const rawTextFromForm = formData.get('rawText') as string | null;
        const useMock = formData.get('mock') === 'true';

        // Generate unique ID for this portfolio
        const id = uuidv4();
        let portfolioData;
        let previewHtml;

        if (useMock || !process.env.OPENAI_API_KEY) {
            // Mock mode — use sample data
            portfolioData = MOCK_PORTFOLIO_DATA;
            previewHtml = await renderPortfolio(portfolioData);
        } else {
            // Real mode — process the uploaded PDF or raw text
            if (!file && !rawTextFromForm) {
                return NextResponse.json(
                    { error: 'No resume file or text provided' },
                    { status: 400 }
                );
            }

            let rawText = '';

            if (file) {
                // Validate file type
                if (file.type !== 'application/pdf') {
                    return NextResponse.json(
                        { error: 'Please upload a PDF file' },
                        { status: 400 }
                    );
                }

                // Validate file size (max 10MB)
                if (file.size > 10 * 1024 * 1024) {
                    return NextResponse.json(
                        { error: 'File size must be less than 10MB' },
                        { status: 400 }
                    );
                }

                // Step 1: Extract text from PDF
                const buffer = Buffer.from(await file.arrayBuffer());
                rawText = await extractTextFromPDF(buffer);
            } else if (rawTextFromForm) {
                rawText = rawTextFromForm;
            }

            if (!rawText || rawText.trim().length < 50) {
                return NextResponse.json(
                    { error: 'Could not extract enough text. Please provide more content.' },
                    { status: 400 }
                );
            }

            // Step 2: AI parse into structured data
            const resumeData = await parseResumeWithAI(rawText);

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
