import OpenAI from 'openai';
import { ResumeData } from './types';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are an expert resume parser. Given raw text extracted from a resume PDF, parse it into a structured JSON format.

You MUST return valid JSON matching this exact schema:
{
  "name": "Full Name",
  "title": "Professional Title / Most Recent Role",
  "email": "email@example.com",
  "phone": "+1-xxx-xxx-xxxx",
  "location": "City, State",
  "linkedin": "linkedin.com/in/username",
  "github": "github.com/username",
  "website": "personal-website.com",
  "summary": "Professional summary or objective statement",
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "location": "City, State",
      "startDate": "Mon YYYY",
      "endDate": "Mon YYYY or Present",
      "highlights": ["Achievement 1", "Achievement 2"]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Degree Type",
      "field": "Field of Study",
      "startDate": "YYYY",
      "endDate": "YYYY",
      "gpa": "X.XX"
    }
  ],
  "skills": ["Skill 1", "Skill 2"],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description",
      "technologies": ["Tech 1", "Tech 2"],
      "link": "https://project-url.com"
    }
  ],
  "certifications": ["Certification 1"]
}

Rules:
- Extract ALL available information from the resume
- If a field is not found, use an empty string or empty array
- For experience highlights, extract specific achievements with metrics when available
- Dates should be in "Mon YYYY" format (e.g., "Jan 2023")
- Return ONLY the JSON, no markdown fences or extra text`;

export async function parseResumeWithAI(rawText: string): Promise<ResumeData> {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not configured');
    }

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Parse this resume:\n\n${rawText}` },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error('AI returned empty response');
    }

    try {
        const parsed = JSON.parse(content) as ResumeData;
        return parsed;
    } catch {
        throw new Error('AI returned invalid JSON');
    }
}
