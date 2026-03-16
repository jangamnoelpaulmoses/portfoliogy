import OpenAI from 'openai';
import { ResumeData, PortfolioData } from './types';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are an expert portfolio copywriter. Given structured resume data as JSON, rewrite and enhance the content to create a compelling professional portfolio.

You MUST return valid JSON matching this schema:
{
  "name": "Full Name",
  "title": "A compelling professional title",
  "email": "email (keep as-is)",
  "phone": "phone (keep as-is)",
  "location": "location (keep as-is)",
  "linkedin": "linkedin (keep as-is)",
  "github": "github (keep as-is)",
  "website": "website (keep as-is)",
  "headline": "A powerful, attention-grabbing one-liner (10-15 words)",
  "bio": "An engaging 2-3 sentence professional bio written in first person",
  "summary": "Enhanced professional summary (2-3 sentences, third person)",
  "experience": [same structure as input but with improved, impactful highlight descriptions],
  "experienceNarrative": [same as experience but with rewritten highlights that tell a story],
  "education": [keep as-is],
  "skills": [keep as-is, but group/reorder by relevance],
  "projects": [same structure but with enhanced descriptions],
  "projectShowcase": [same as projects but with compelling, detailed descriptions],
  "certifications": [keep as-is]
}

Writing Guidelines:
- Make the headline memorable and specific to the person's expertise
- Bio should be warm, confident, and authentic (first person)
- Experience highlights should emphasize IMPACT and RESULTS
- Use strong action verbs and quantify achievements where possible
- Project descriptions should be engaging and highlight the problem solved
- Keep the tone professional yet approachable
- Do NOT fabricate information — only enhance what's provided
- Return ONLY the JSON, no markdown fences or extra text`;

export async function rewriteForPortfolio(resumeData: ResumeData): Promise<PortfolioData> {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not configured');
    }

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Enhance this resume data for a portfolio:\n\n${JSON.stringify(resumeData, null, 2)}` },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error('AI returned empty response');
    }

    try {
        const enhanced = JSON.parse(content) as PortfolioData;
        return enhanced;
    } catch {
        throw new Error('AI returned invalid JSON for portfolio rewrite');
    }
}
