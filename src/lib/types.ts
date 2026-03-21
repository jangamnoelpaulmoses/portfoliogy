export interface Experience {
  company: string;
  role: string;
  description?: string;
  location?: string;
  startDate: string;
  endDate: string;
  highlights: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
}

export interface Project {
  name: string;
  description: string;
  technologies: string[];
  link?: string;
}

export interface ResumeData {
  name: string;
  title: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
  projects: Project[];
  certifications?: string[];
}

export interface PortfolioData extends ResumeData {
  headline: string;
  bio: string;
  experienceNarrative: Experience[];
  projectShowcase: Project[];
}

export interface GenerateResponse {
  id: string;
  previewHtml: string;
  parsedData: PortfolioData;
}

export interface DeployResponse {
  url: string;
  deploymentId: string;
}
