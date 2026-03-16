import { createReadStream } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

interface VercelFile {
    file: string;
    sha: string;
    size: number;
}

export async function deployToVercel(
    projectDir: string,
    portfolioName: string
): Promise<{ url: string; deploymentId: string }> {
    const token = process.env.VERCEL_API_TOKEN;
    const baseDomain = process.env.VERCEL_BASE_DOMAIN; // e.g., 'noelpaulmoses.com'
    if (!token) {
        throw new Error('VERCEL_API_TOKEN is not configured');
    }

    // Read all files from the project directory
    const files = await collectFiles(projectDir);

    // Upload files to Vercel
    const fileUploads: VercelFile[] = [];

    for (const file of files) {
        const content = await readFile(file.absolutePath);
        const sha = crypto.createHash('sha1').update(content).digest('hex');

        // Upload file
        await fetch('https://api.vercel.com/v2/files', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/octet-stream',
                'Content-Length': content.length.toString(),
                'x-vercel-digest': sha,
            },
            body: content,
        });

        fileUploads.push({
            file: file.relativePath,
            sha,
            size: content.length,
        });
    }

    // Create deployment
    const projectSlug = `portfolio-${portfolioName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30)}`;

    const deployResponse = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: projectSlug,
            files: fileUploads,
            projectSettings: {
                framework: null,
            },
            target: 'production',
        }),
    });

    if (!deployResponse.ok) {
        const error = await deployResponse.text();
        throw new Error(`Vercel deployment failed: ${error}`);
    }

    const deployment = await deployResponse.json() as { id: string; url: string; alias: string[] };

    let finalUrl = `https://${deployment.url}`;

    // If a base custom domain is configured (e.g., noelpaulmoses.com), try to assign a subdomain
    if (baseDomain) {
        const subdomain = portfolioName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
        const customDomain = `${subdomain}.${baseDomain}`;

        try {
            const domainResponse = await fetch(`https://api.vercel.com/v10/projects/${projectSlug}/domains`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: customDomain }),
            });

            if (domainResponse.ok) {
                finalUrl = `https://${customDomain}`;
            } else {
                console.error(`Failed to assign custom domain ${customDomain}:`, await domainResponse.text());
                // Fallback to the default deployment alias if assigning domain failed
                if (deployment.alias && deployment.alias.length > 0) {
                    finalUrl = `https://${deployment.alias[0]}`;
                }
            }
        } catch (err) {
            console.error('Error assigning custom domain:', err);
        }
    } else if (deployment.alias && deployment.alias.length > 0) {
        // If no custom domain, but Vercel generated a clean alias (e.g. project-name.vercel.app), use it!
        finalUrl = `https://${deployment.alias[0]}`;
    }

    return {
        url: finalUrl,
        deploymentId: deployment.id,
    };
}

async function collectFiles(
    dir: string,
    basePath: string = ''
): Promise<{ absolutePath: string; relativePath: string }[]> {
    const { readdir, stat } = await import('fs/promises');
    const entries = await readdir(dir);
    const files: { absolutePath: string; relativePath: string }[] = [];

    for (const entry of entries) {
        const absolutePath = path.join(dir, entry);
        const relativePath = basePath ? `${basePath}/${entry}` : entry;
        const entryStat = await stat(absolutePath);

        if (entryStat.isDirectory()) {
            files.push(...(await collectFiles(absolutePath, relativePath)));
        } else {
            files.push({ absolutePath, relativePath });
        }
    }

    return files;
}
