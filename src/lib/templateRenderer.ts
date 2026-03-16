import Handlebars from 'handlebars';
import { readFile } from 'fs/promises';
import path from 'path';
import { PortfolioData } from './types';

let compiledTemplate: HandlebarsTemplateDelegate | null = null;

async function getTemplate(): Promise<HandlebarsTemplateDelegate> {
    if (compiledTemplate) return compiledTemplate;

    const templatePath = path.join(process.cwd(), 'src', 'templates', 'portfolio.hbs');
    const templateSource = await readFile(templatePath, 'utf-8');

    // Register helpers
    Handlebars.registerHelper('ifCond', function (this: unknown, v1: unknown, v2: unknown, options: Handlebars.HelperOptions) {
        if (v1 === v2) {
            return options.fn(this);
        }
        return options.inverse(this);
    });

    compiledTemplate = Handlebars.compile(templateSource);
    return compiledTemplate;
}

export async function renderPortfolio(data: PortfolioData): Promise<string> {
    const template = await getTemplate();
    return template(data);
}
