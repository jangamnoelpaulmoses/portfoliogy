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

    // Create deployment with a unique suffix so people with the same name don't overwrite each other's projects
    const uniqueSuffix = crypto.randomBytes(3).toString('hex');
    const projectSlug = `portfolio-${portfolioName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30)}-${uniqueSuffix}`;

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
        const nameParts = portfolioName.trim().split(/\s+/);
        const firstName = nameParts[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '') : '';

        const tryAssignDomain = async (domain: string) => {
            const domainResponse = await fetch(`https://api.vercel.com/v10/projects/${projectSlug}/domains`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: domain }),
            });
            return { ok: domainResponse.ok, status: domainResponse.status, text: await domainResponse.text() };
        };

        const domainsToTry = [];
        if (firstName) domainsToTry.push(`${firstName}.${baseDomain}`);
        if (firstName && lastName) domainsToTry.push(`${firstName}${lastName}.${baseDomain}`);

        // Always add a random fallback option
        const fallbackHash = crypto.randomBytes(2).toString('hex');
        const fallbackBase = (firstName + lastName) || portfolioName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
        domainsToTry.push(`${fallbackBase}-${fallbackHash}.${baseDomain}`);

        let assignedDomain = null;
        for (const dom of domainsToTry) {
            try {
                const res = await tryAssignDomain(dom);
                if (res.ok) {
                    assignedDomain = dom;
                    break;
                }
                // Log and continue to fallback if it fails (e.g., 409 Conflict if name is taken)
                console.warn(`Could not assign ${dom}:`, res.status, res.text);
            } catch (err) {
                console.error(`Error assigning ${dom}:`, err);
            }
        }

        if (assignedDomain) {
            finalUrl = `https://${assignedDomain}`;
        } else if (deployment.alias && deployment.alias.length > 0) {
            finalUrl = `https://${deployment.alias[0]}`;
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
