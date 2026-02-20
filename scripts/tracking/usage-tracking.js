/**
 * AIDA Usage Tracking Module
 * Edition-aware: values injected at build time via webpack DefinePlugin
 * 
 * Build commands:
 *   npm run build              → Public edition (no tracking)
 *   npm run build:company      → Company edition (tracking enabled)
 * 
 * Tracks user activity and sends to Azure Application Insights
 */

const vscode = require('vscode');
const https = require('https');
const { URL } = require('url');
const { exec } = require('child_process');
const os = require('os');
const { IdentityProvider } = require('./tracking-enums');
const { TrackingEventModel } = require('./tracking-event-model');

// ============================================
// BUILD-TIME INJECTED CONSTANTS (from edition.config.js via webpack DefinePlugin)
// These globals are replaced at compile time — do NOT reassign them.
// ============================================
/* global __IS_COMPANY_VERSION__, __EDITION_TYPE__, __FORCE_TRACKING__, __APP_INSIGHTS_IKEY__, __APP_INSIGHTS_ENDPOINT__, __APP_INSIGHTS_APP_ID__ */
const IS_COMPANY_VERSION = __IS_COMPANY_VERSION__;
const EDITION_TYPE = __EDITION_TYPE__;

// Application Insights Configuration
const APP_INSIGHTS_CONFIG = {
    instrumentationKey: __APP_INSIGHTS_IKEY__,
    ingestionEndpoint: __APP_INSIGHTS_ENDPOINT__,
    applicationId: __APP_INSIGHTS_APP_ID__
};

// Cache user identifier to avoid repeated lookups
let cachedUserIdentifier = null;

/**
 * Get user identifier using priority-based provider chain.
 * Priority is configured in IdentityProvider enum (tracking-enums.js).
 * To reorder: just change the priority number in the enum.
 * @returns {Promise<{type: string, id: string, displayName: string}>}
 */
async function getUserIdentifier() {
    if (cachedUserIdentifier) {
        return cachedUserIdentifier;
    }

    // Build sorted provider list by priority (lower = higher priority)
    const providers = Object.values(IdentityProvider)
        .filter(p => p.enabled)
        .sort((a, b) => a.priority - b.priority);

    for (const provider of providers) {
        try {
            const result = await resolveIdentity(provider.type);
            if (result) {
                cachedUserIdentifier = result;
                console.log(`[AIDA Tracking] User identified via ${result.type}: ${result.displayName || result.id}`);
                return cachedUserIdentifier;
            }
        } catch (e) {
            // Silent skip to next provider
        }
    }

    // Should never reach here since MACHINE_ID always works, but just in case
    cachedUserIdentifier = { type: 'anonymous', id: vscode.env.machineId, displayName: 'Unknown' };
    return cachedUserIdentifier;
}

/**
 * Resolve identity for a specific provider type
 * @param {string} providerType - The provider type from IdentityProvider enum
 * @returns {Promise<{type: string, id: string, displayName: string}|null>}
 */
async function resolveIdentity(providerType) {
    switch (providerType) {
        case 'windows':
            return getWindowsIdentity();

        case 'microsoft':
            return getMicrosoftIdentity();

        case 'github':
            return getGitHubIdentity();

        case 'git':
            return getGitIdentity();

        case 'anonymous':
            return {
                type: 'anonymous',
                id: vscode.env.machineId,
                displayName: `Machine-${vscode.env.machineId.substring(0, 8)}`
            };

        default:
            return null;
    }
}

/**
 * Get Windows domain\username identity
 * Works offline, always available on Windows enterprise environments
 * @returns {{type: string, id: string, displayName: string}|null}
 */
function getWindowsIdentity() {
    try {
        const userInfo = os.userInfo();
        const username = userInfo.username;
        const domain = process.env.USERDOMAIN || process.env.COMPUTERNAME || '';
        const computerName = process.env.COMPUTERNAME || os.hostname();

        if (!username) return null;

        const fullId = domain ? `${domain}\\${username}` : username;

        return {
            type: 'windows',
            id: fullId,
            displayName: fullId,
            // Extra metadata for enterprise tracking
            domain: domain,
            computerName: computerName,
            username: username
        };
    } catch (e) {
        return null;
    }
}

/**
 * Get Microsoft Account identity (Azure AD / personal)
 * @returns {Promise<{type: string, id: string, displayName: string}|null>}
 */
async function getMicrosoftIdentity() {
    const msSession = await vscode.authentication.getSession(
        'microsoft',
        ['email', 'profile'],
        { createIfNone: false, silent: true }
    );
    if (msSession) {
        return {
            type: 'microsoft',
            id: msSession.account.label,
            displayName: msSession.account.label
        };
    }
    return null;
}

/**
 * Get GitHub Account identity
 * @returns {Promise<{type: string, id: string, displayName: string}|null>}
 */
async function getGitHubIdentity() {
    const ghSession = await vscode.authentication.getSession(
        'github',
        ['user:email'],
        { createIfNone: false, silent: true }
    );
    if (ghSession) {
        return {
            type: 'github',
            id: ghSession.account.label,
            displayName: ghSession.account.label
        };
    }
    return null;
}

/**
 * Get Git email identity from local config
 * @returns {Promise<{type: string, id: string, displayName: string}|null>}
 */
async function getGitIdentity() {
    const gitEmail = await getGitEmail();
    if (gitEmail) {
        return {
            type: 'git',
            id: gitEmail,
            displayName: gitEmail
        };
    }
    return null;
}

/**
 * Get Git email from local config
 * @returns {Promise<string|null>}
 */
function getGitEmail() {
    return new Promise((resolve) => {
        exec('git config user.email', { timeout: 3000 }, (error, stdout) => {
            if (error || !stdout) {
                resolve(null);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

/**
 * Check if tracking is enabled
 * Company version: Always enabled
 * @returns {boolean}
 */
function isTrackingEnabled() {
    // Company version: Force enable
    if (IS_COMPANY_VERSION) {
        return true;
    }
    
    // Public version: Respect VS Code telemetry setting
    const telemetryLevel = vscode.workspace
        .getConfiguration('telemetry')
        .get('telemetryLevel', 'all');
    
    return telemetryLevel !== 'off';
}

/**
 * Check if tracking is configured
 * @returns {boolean}
 */
function isTrackingConfigured() {
    return APP_INSIGHTS_CONFIG.instrumentationKey && 
           APP_INSIGHTS_CONFIG.instrumentationKey !== '' &&
           APP_INSIGHTS_CONFIG.ingestionEndpoint.startsWith('https://');
}

/**
 * Track an event
 * @param {string} eventName - Name of the event
 * @param {object} eventData - Additional event data (optional)
 */
async function trackEvent(eventName, eventData = {}) {
    // Check if tracking is enabled and configured
    if (!isTrackingEnabled()) {
        return;
    }

    if (!isTrackingConfigured()) {
        console.log('[AIDA Tracking] Not configured, skipping:', eventName);
        return;
    }

    try {
        const userInfo = await getUserIdentifier();

        // Build structured event model
        const event = new TrackingEventModel(eventName, userInfo, eventData, EDITION_TYPE);

        // Send to Application Insights
        sendToAppInsights(event).catch(err => {
            console.log('[AIDA Tracking] Send failed:', err.message);
        });

        console.log('[AIDA Tracking] Event tracked:', eventName);
    } catch (error) {
        // Silent fail - don't disrupt user experience
        console.log('[AIDA Tracking] Error:', error.message);
    }
}

/**
 * Send telemetry to Azure Application Insights
 * Uses the Track API directly (no SDK needed)
 * @param {TrackingEventModel} event - The structured event model
 * @returns {Promise<void>}
 */
function sendToAppInsights(event) {
    return new Promise((resolve, reject) => {
        try {
            // Build payload from TrackingEventModel
            const telemetryData = event.toAppInsightsPayload(APP_INSIGHTS_CONFIG.instrumentationKey);
            const data = JSON.stringify(telemetryData);
            
            // Parse ingestion endpoint
            const url = new URL(APP_INSIGHTS_CONFIG.ingestionEndpoint + 'v2/track');

            const options = {
                hostname: url.hostname,
                port: 443,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                },
                timeout: 10000 // 10 second timeout
            };

            const req = https.request(options, (res) => {
                let responseData = '';
                res.on('data', chunk => responseData += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200 || res.statusCode === 202) {
                        resolve();
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                    }
                });
            });

            req.on('error', (err) => {
                reject(err);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(data);
            req.end();
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Clear cached user identifier
 * Useful when user logs in/out
 */
function clearUserCache() {
    cachedUserIdentifier = null;
}

module.exports = {
    trackEvent,
    getUserIdentifier,
    isTrackingEnabled,
    isTrackingConfigured,
    clearUserCache,
    IS_COMPANY_VERSION,
    EDITION_TYPE
};
