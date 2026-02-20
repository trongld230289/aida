/**
 * @module source-control-config
 * @description Source control helpers for multiple organizations per provider
 * Extracted from review-common.js during Phase 1 refactoring
 */

const vscode = require('vscode');
const { aidaLogging } = require('./settings');
/**
 * Parse PR/MR URL to extract provider and organization information
 * @param {string} prUrl - PR/MR URL
 * @returns {object} - { provider, organization, project?, repository?, prId? }
 */
function parsePRUrl(prUrl) {
    const url = prUrl.trim();

    // Azure DevOps: https://dev.azure.com/{organization}/{project}/_git/{repository}/pullrequest/{id}
    if (url.includes('dev.azure.com')) {
        const match = url.match(/dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/([^\/]+)\/pullrequest\/(\d+)/);
        if (match) {
            return {
                provider: 'azureDevOps',
                organization: match[1],
                project: match[2],
                repository: match[3],
                prId: match[4]
            };
        }
    }

    // GitHub: https://github.com/{owner}/{repo}/pull/{id}
    if (url.includes('github.com')) {
        const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
        if (match) {
            return {
                provider: 'github',
                organization: match[1],
                repository: match[2],
                prId: match[3]
            };
        }
    }

    // GitLab: https://gitlab.com/{namespace/path}/{repo}/-/merge_requests/{id}
    // Support nested namespaces like: ds365ai/FDP/time-and-cost-project/fdp-activity-middleware-service
    if (url.includes('gitlab.com')) {
        const match = url.match(/gitlab\.com\/(.+?)\/-\/merge_requests\/(\d+)/);
        if (match) {
            const fullPath = match[1];
            const pathParts = fullPath.split('/');
            const repository = pathParts[pathParts.length - 1]; // Last part is project name
            const organization = pathParts.slice(0, -1).join('/'); // Everything else is namespace

            return {
                provider: 'gitlab',
                organization: organization,
                repository: repository,
                prId: match[2]
            };
        }
    }

    throw new Error(`Unsupported PR/MR URL format: ${prUrl}`);
}

/**
 * Get token for PR/MR based on provider and organization
 * @param {string} prUrl - PR/MR URL
 * @returns {string|null} - Access token for the organization or null if not found
 */
function getTokenForPR(prUrl) {
    const vscode = require('vscode');

    try {
        const { provider, organization } = parsePRUrl(prUrl);
        const config = vscode.workspace.getConfiguration('aida');

        aidaLogging(`ðŸ” Looking for token: provider=${provider}, org=${organization}`);

        // Try new multi-organization configuration first
        const sourceControls = config.get('sourceControls', {});
        aidaLogging(`ðŸ” DEBUG sourceControls config:`, JSON.stringify(sourceControls, null, 2));
        const providerTokens = sourceControls[provider];
        aidaLogging(`ðŸ” DEBUG providerTokens for ${provider}:`, JSON.stringify(providerTokens, null, 2));

        if (providerTokens && providerTokens[organization]) {
            aidaLogging(`âœ… Found token for ${provider}/${organization} in sourceControls`);
            return providerTokens[organization];
        } else {
            aidaLogging(`âŒ No token found for ${provider}/${organization} in sourceControls`);
        }

        aidaLogging(`âŒ No token found for ${provider}/${organization}`);
        return null;

    } catch (error) {
        aidaLogging('âŒ Error getting token for PR:', error.message);
        return null;
    }
}

/**
 * Check if token is configured for a specific provider and organization
 * @param {string} provider - Provider name (azureDevOps, github, gitlab)
 * @param {string} organization - Organization name
 * @returns {boolean} - true if token is configured
 */
function hasTokenForProvider(provider, organization) {
    const vscode = require('vscode');
    const config = vscode.workspace.getConfiguration('aida');

    // Check new configuration
    const sourceControls = config.get('sourceControls', {});
    if (sourceControls[provider]?.[organization]) {
        return true;
    }

    return false;
}

/**
 * Get all configured organizations for a provider
 * @param {string} provider - Provider name (azureDevOps, github, gitlab)
 * @returns {Array<string>} - Array of organization names
 */
function getConfiguredOrganizations(provider) {
    const vscode = require('vscode');
    const config = vscode.workspace.getConfiguration('aida');

    const sourceControls = config.get('sourceControls', {});
    const providerTokens = sourceControls[provider];

    if (providerTokens && typeof providerTokens === 'object') {
        return Object.keys(providerTokens);
    }

    return [];
}

/**
 * Show comprehensive guidance for missing token configuration
 * @param {string} provider - Provider name
 * @param {string} organization - Organization name
 * @param {object} stream - Chat stream (optional)
 */
function showTokenConfigurationHelp(provider, organization, stream = null) {
    const vscode = require('vscode');


    const providerNames = {
        azureDevOps: 'Azure DevOps',
        github: 'GitHub',
        gitlab: 'GitLab'
    };

    const providerName = providerNames[provider] || provider;

    // Provider configuration data
    const providerConfigs = {
        azureDevOps: {
            name: 'Azure DevOps',
            docs: 'https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate',
            permissions: 'Code (read), Pull Request (read)'
        },
        github: {
            name: 'GitHub',
            docs: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token',
            permissions: 'repo (Full control of private repositories)'
        },
        gitlab: {
            name: 'GitLab',
            docs: 'https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html',
            permissions: 'api (Access to the authenticated user\'s API), read_repository'
        }
    };

    const config = providerConfigs[provider];
    if (!config) return;

    const errorMessage = `âŒ **Missing ${providerName} Token**`;
    const orgMessage = `No personal access token configured for organization: \`${organization}\``;

    let helpContent = `${errorMessage}\n\n${orgMessage}\n\n`;

    // Configuration instructions
    helpContent += `## ðŸ”§ **Configuration Required**\n\n`;
    helpContent += `**Step 1:** Press \`Ctrl + ,\` (or \`Cmd + ,\` on Mac) â†’ Search for: \`aida.sourceControls\`\n\n`;
    helpContent += `**Step 2:** Add your ${config.name} configuration (Organization: \`${organization}\`):\n\n`;
    helpContent += `\`\`\`json\n`;
    helpContent += `"aida.sourceControls": {\n`;
    helpContent += `  "${provider}": {\n`;
    helpContent += `    "${organization}": "YOUR_${provider.toUpperCase()}_TOKEN",\n`;
    helpContent += `    "AnotherOrganization": "YOUR_${provider.toUpperCase()}_TOKEN_2"\n`;
    helpContent += `  }\n`;
    helpContent += `}\n`;
    helpContent += `\`\`\`\n\n`;

    // Token creation guidance
    helpContent += `## ðŸ”‘ **How to Get Personal Access Token**\n\n`;
    helpContent += `1. **Go to ${config.name}** â†’ Settings â†’ Personal Access Tokens\n`;
    helpContent += `2. **Create new token** with these permissions:\n`;
    helpContent += `   - ${config.permissions}\n`;
    helpContent += `3. **Copy the token** and add to VS Code settings\n\n`;
    helpContent += `ðŸ“š **Documentation:** ${config.docs}\n\n`;

    // Quick setup button

    aidaLogging(`âŒ Missing token: ${providerName}/${organization}`);
    aidaLogging('ðŸ”§ Configuration help displayed to user');

    if (stream) {
        stream.markdown(helpContent);
    } else {
        vscode.window.showErrorMessage(
            `Missing ${providerName} token for: ${organization}`,
            'Open Settings',
            'View Guide'
        ).then(action => {
            if (action === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'aida.sourceControls');
            } else if (action === 'View Guide') {
                // Create help document
                vscode.workspace.openTextDocument({
                    content: helpContent.replace(/\*\*/g, '').replace(/`/g, ''),
                    language: 'markdown'
                }).then(doc => {
                    vscode.window.showTextDocument(doc);
                });
            }
        });
    }
}
module.exports = {
    parsePRUrl,
    getTokenForPR,
    hasTokenForProvider,
    getConfiguredOrganizations,
    showTokenConfigurationHelp
};