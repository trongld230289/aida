/**
 * AIDA Usage Tracking Module
 * Values injected at build time via webpack DefinePlugin.
 * App Insights config delivered via encrypted activation key.
 * 
 * Tracks user activity and sends to Azure Application Insights.
 */

import * as vscode from 'vscode';
import * as https from 'https';
import { URL } from 'url';
import { exec } from 'child_process';
import * as os from 'os';
import { TrackingEventModel } from './tracking-event-model';
import { toError } from '../core/error-utils';
import { getActivatedConfig, getActivatedProject, getActivatedCompany, type AppInsightsConfig } from './activation-key';

// ============================================
// BUILD-TIME INJECTED CONSTANTS (from edition.config.js via webpack DefinePlugin)
// These globals are replaced at compile time — do NOT reassign them.
// ============================================
declare const __FORCE_TRACKING__: boolean;
declare const __APP_INSIGHTS_IKEY__: string;
declare const __APP_INSIGHTS_ENDPOINT__: string;
declare const __APP_INSIGHTS_APP_ID__: string;

// Application Insights Configuration
// Config comes from encrypted activation key (not hardcoded)
// Static values are fallback only (empty by default)
const STATIC_APP_INSIGHTS_CONFIG = {
    instrumentationKey: __APP_INSIGHTS_IKEY__,
    ingestionEndpoint: __APP_INSIGHTS_ENDPOINT__,
    applicationId: __APP_INSIGHTS_APP_ID__
};

/**
 * Get the effective App Insights config from the activation key.
 * Falls back to static (empty) config if no valid key.
 */
function getEffectiveConfig(): AppInsightsConfig {
    console.log(`[AIDA Tracking][DEBUG] getEffectiveConfig()`);
    const fromKey = getActivatedConfig();
    if (fromKey) {
        console.log(`[AIDA Tracking][DEBUG]   Using config FROM ACTIVATION KEY: iKey=${fromKey.instrumentationKey}, endpoint=${fromKey.ingestionEndpoint}`);
        return fromKey;
    }
    console.log(`[AIDA Tracking][DEBUG]   ⚠️ No activation key config — falling back to STATIC_APP_INSIGHTS_CONFIG`);
    return STATIC_APP_INSIGHTS_CONFIG;
}

// Cache user identifier to avoid repeated lookups
let cachedUserIdentifier: Record<string, any> | null = null;
let sessionListenerRegistered = false;
let identityComplete = false;

// Buffer for events sent while identity is still partial (missing Microsoft/GitHub)
// Once identity is resolved, all buffered events are re-sent with complete identity → 1 row in App Insights
interface BufferedEvent {
    eventName: string;
    eventData: Record<string, unknown>;
    timestamp: string;
}
const eventBuffer: BufferedEvent[] = [];
const BUFFER_FLUSH_TIMEOUT_MS = 60_000; // Max wait before sending partial identity events
let bufferFlushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Collect user identity from all available sources simultaneously.
 * No priority chain — all 3 sources are collected in parallel:
 *   1. Windows (machine name, domain\username, display name from AD)
 *   2. Microsoft Account (Azure AD / personal)
 *   3. GitHub Account
 * 
 * displayName = windowsDisplayName ?? microsoftAccountName ?? githubAccountName
 * 
 * @returns {Promise<UserIdentity>}
 */
async function getUserIdentifier() {
    if (cachedUserIdentifier) {
        return cachedUserIdentifier;
    }

    // Register session change listener (once) to refresh identity when user approves access
    if (!sessionListenerRegistered) {
        sessionListenerRegistered = true;
        vscode.authentication.onDidChangeSessions(async () => {
            console.log('[AIDA Tracking] Auth sessions changed, clearing identity cache');
            cachedUserIdentifier = null;
            identityComplete = false;

            // Re-resolve identity — if now complete, flush buffered events
            const newIdentity = await getUserIdentifier();
            if (identityComplete && eventBuffer.length > 0) {
                console.log(`[AIDA Tracking] Identity now complete, flushing ${eventBuffer.length} buffered events`);
                flushEventBuffer(newIdentity);
            }
        });
    }

    // Collect all identity sources in parallel
    const [windowsInfo, microsoftInfo, githubInfo] = await Promise.all([
        getWindowsIdentity().catch((e: unknown) => {
            console.log('[AIDA Tracking] Windows identity error:', (e as Error).message);
            return null;
        }),
        getMicrosoftIdentity().catch((e: unknown) => {
            console.log('[AIDA Tracking] Microsoft identity error:', (e as Error).message);
            return null;
        }),
        getGitHubIdentity().catch((e: unknown) => {
            console.log('[AIDA Tracking] GitHub identity error:', (e as Error).message);
            return null;
        })
    ]);

    // Resolve display name: windowsDisplayName ?? microsoftAccountName ?? githubAccountName
    const displayName = windowsInfo?.displayName
        ?? microsoftInfo?.displayName
        ?? githubInfo?.displayName
        ?? `Machine-${vscode.env.machineId.substring(0, 8)}`;

    const result = {
        // Display name resolved from available sources
        displayName,

        // Windows identity
        windowsId: windowsInfo?.id || '',
        windowsDomain: windowsInfo?.domain || '',
        windowsUsername: windowsInfo?.username || '',
        computerName: windowsInfo?.computerName || '',
        windowsDisplayName: windowsInfo?.displayName || '',

        // Microsoft account
        microsoftAccount: microsoftInfo?.displayName || '',

        // GitHub account
        githubAccount: githubInfo?.displayName || '',

        // Machine ID (always available)
        machineId: vscode.env.machineId
    };

    // Only cache when all identity sources are resolved.
    // If Microsoft or GitHub are still pending (user hasn't granted yet),
    // don't cache — retry on next event so once granted, all future events include it.
    const allResolved = (!!(microsoftInfo || process.platform !== 'win32')) && !!githubInfo;
    identityComplete = allResolved;
    if (allResolved) {
        cachedUserIdentifier = result;
    }

    console.log(`[AIDA Tracking] User identified: ${displayName}${allResolved ? ' (cached)' : ' (partial, will retry)'}`);
    if (windowsInfo) console.log(`[AIDA Tracking]   Windows: ${windowsInfo.id} (${windowsInfo.displayName || 'no display name'})`);
    if (microsoftInfo) console.log(`[AIDA Tracking]   Microsoft: ${microsoftInfo.displayName}`);
    if (githubInfo) console.log(`[AIDA Tracking]   GitHub: ${githubInfo.displayName}`);

    return result;
}

/**
 * Get Windows display name (nice name) via Win32 GetUserNameEx API.
 * Uses secur32.dll GetUserNameEx with NameDisplay format (3) which
 * resolves the full display name from Active Directory / local SAM.
 * Example: "user01" → "Trong Duc Le"
 * 
 * Only works on Windows. Returns null on Linux/macOS.
 * @returns {Promise<string|null>} Display name like "Trong Duc Le", or null on failure
 */
function getWindowsDisplayName(): Promise<string | null> {
    return new Promise((resolve) => {
        if (process.platform !== 'win32') {
            resolve(null);
            return;
        }

        // PowerShell script to call GetUserNameEx(NameDisplay=3) from secur32.dll
        const psScript = [
            'Add-Type -TypeDefinition @"',
            'using System; using System.Runtime.InteropServices; using System.Text;',
            'public class WinApiUser {',
            '  [DllImport("secur32.dll", CharSet = CharSet.Unicode, SetLastError = true)]',
            '  public static extern bool GetUserNameEx(int f, StringBuilder s, ref int n);',
            '  public static string Get() { var s = new StringBuilder(256); int n = 256; return GetUserNameEx(3, s, ref n) ? s.ToString() : null; }',
            '}',
            '"@',
            '[WinApiUser]::Get()'
        ].join('\n');

        // Use -EncodedCommand (base64 UTF-16LE) to avoid all shell escaping issues
        const encoded = Buffer.from(psScript, 'utf16le').toString('base64');

        exec(`powershell -NoProfile -EncodedCommand ${encoded}`,
            { timeout: 8000 },
            (_error, stdout) => {
                const name = stdout?.trim();
                resolve(name || null);
            }
        );
    });
}

/**
 * Get Windows identity (machine name, domain\username, display name).
 * Works offline, always available on Windows enterprise environments.
 * @returns {Promise<{id, displayName, domain, computerName, username}|null>}
 */
async function getWindowsIdentity() {
    if (process.platform !== 'win32') return null;

    try {
        const userInfo = os.userInfo();
        const username = userInfo.username;
        const domain = process.env.USERDOMAIN || process.env.COMPUTERNAME || '';
        const computerName = process.env.COMPUTERNAME || os.hostname();

        if (!username) return null;

        const fullId = domain ? `${domain}\\${username}` : username;

        // Try to get the nice display name from AD (e.g. "Trong Duc Le")
        const niceName = await getWindowsDisplayName();

        return {
            id: fullId,
            displayName: niceName || fullId,
            domain,
            computerName,
            username
        };
    } catch (_e: unknown) {
        return null;
    }
}

/**
 * Get Microsoft Account identity (Azure AD / personal).
 * Tries silent first, then triggers consent badge if needed.
 * @returns {Promise<{displayName: string}|null>}
 */
async function getMicrosoftIdentity() {
    const scopes = ['openid', 'profile', 'email'];
    try {
        // Step 1: Silent check (fast, no UI — works if already trusted)
        let session = await vscode.authentication.getSession('microsoft', scopes, { silent: true });
        if (session) {
            console.log(`[AIDA Tracking] Microsoft session found (silent): ${session.account.label}`);
            return { displayName: session.account.label };
        }

        // Step 2: Non-silent — triggers "Grant access" badge on Accounts menu
        session = await vscode.authentication.getSession('microsoft', scopes, { createIfNone: false });
        if (session) {
            console.log(`[AIDA Tracking] Microsoft session found (consent): ${session.account.label}`);
            return { displayName: session.account.label };
        }
    } catch (e) {
        console.log('[AIDA Tracking] Microsoft auth error:', (e as Error).message);
    }
    return null;
}

/**
 * Get GitHub Account identity.
 * Tries silent first, then triggers consent badge if needed.
 * @returns {Promise<{displayName: string}|null>}
 */
async function getGitHubIdentity() {
    const scopes = ['user:email'];
    try {
        // Step 1: Silent check (fast, no UI — works if already trusted)
        let session = await vscode.authentication.getSession('github', scopes, { silent: true });
        if (session) {
            console.log(`[AIDA Tracking] GitHub session found (silent): ${session.account.label}`);
            return { displayName: session.account.label };
        }

        // Step 2: Non-silent — triggers "Grant access" badge on Accounts menu
        session = await vscode.authentication.getSession('github', scopes, { createIfNone: false });
        if (session) {
            console.log(`[AIDA Tracking] GitHub session found (consent): ${session.account.label}`);
            return { displayName: session.account.label };
        }
    } catch (e) {
        console.log('[AIDA Tracking] GitHub auth error:', (e as Error).message);
    }
    return null;
}

/**
 * Check if tracking is enabled.
 * Always enabled when a valid activation key is present.
 * @returns {boolean}
 */
function isTrackingEnabled() {
    console.log(`[AIDA Tracking][DEBUG] isTrackingEnabled() = true`);
    return true;
}

/**
 * Check if tracking is configured
 * @returns {boolean}
 */
function isTrackingConfigured() {
    const config = getEffectiveConfig();
    const configured = config.instrumentationKey && 
           config.instrumentationKey !== '' &&
           config.ingestionEndpoint.startsWith('https://');
    console.log(`[AIDA Tracking][DEBUG] isTrackingConfigured() = ${configured}`);
    console.log(`[AIDA Tracking][DEBUG]   iKey="${config.instrumentationKey}" (empty=${!config.instrumentationKey})`);
    console.log(`[AIDA Tracking][DEBUG]   endpoint="${config.ingestionEndpoint}" (starts https=${config.ingestionEndpoint?.startsWith('https://')})`);
    return configured;
}

/**
 * Flush buffered events with the given (now-complete) identity.
 * All buffered events are re-built and sent with full user info → 1 row in App Insights.
 */
function flushEventBuffer(userInfo: Record<string, any>) {
    if (bufferFlushTimer) {
        clearTimeout(bufferFlushTimer);
        bufferFlushTimer = null;
    }

    const config = getEffectiveConfig();
    const toFlush = eventBuffer.splice(0);
    for (const buffered of toFlush) {
        const project = getActivatedProject();
        const company = getActivatedCompany();
        const event = new TrackingEventModel(buffered.eventName, userInfo, buffered.eventData, 'aida', project, company);
        // Preserve original timestamp
        event.timestamp = buffered.timestamp;

        sendToAppInsights(event, config).catch(err => {
            console.log('[AIDA Tracking] Buffered event send failed:', err.message);
        });
    }
    console.log(`[AIDA Tracking] Flushed ${toFlush.length} buffered events with complete identity`);
}

/**
 * Start a timeout to flush buffered events even if identity never completes.
 * Prevents events from being lost forever if user never grants access.
 */
function startBufferFlushTimer() {
    if (bufferFlushTimer) return; // Already running
    bufferFlushTimer = setTimeout(async () => {
        if (eventBuffer.length > 0) {
            console.log(`[AIDA Tracking] Buffer timeout — flushing ${eventBuffer.length} events with partial identity`);
            const userInfo = await getUserIdentifier();
            // Force-cache partial identity so subsequent events are consistent
            cachedUserIdentifier = userInfo;
            identityComplete = true;
            flushEventBuffer(userInfo);
        }
        bufferFlushTimer = null;
    }, BUFFER_FLUSH_TIMEOUT_MS);
}

/**
 * Track an event
 * @param {string} eventName - Name of the event
 * @param {object} eventData - Additional event data (optional)
 */
async function trackEvent(eventName: string, eventData = {}) {
    console.log(`[AIDA Tracking][DEBUG] ═══════════════════════════════════════`);
    console.log(`[AIDA Tracking][DEBUG] trackEvent("${eventName}") called`);
    console.log(`[AIDA Tracking][DEBUG]   eventData = ${JSON.stringify(eventData)}`);

    // Check if tracking is enabled and configured
    if (!isTrackingEnabled()) {
        console.log(`[AIDA Tracking][DEBUG]   ❌ SKIPPED: tracking NOT enabled`);
        return;
    }
    console.log(`[AIDA Tracking][DEBUG]   ✅ Tracking is enabled`);

    if (!isTrackingConfigured()) {
        console.log('[AIDA Tracking] Not configured, skipping:', eventName);
        console.log(`[AIDA Tracking][DEBUG]   ❌ SKIPPED: tracking NOT configured (missing iKey or endpoint)`);
        return;
    }
    console.log(`[AIDA Tracking][DEBUG]   ✅ Tracking is configured`);

    try {
        const userInfo = await getUserIdentifier();
        console.log(`[AIDA Tracking][DEBUG]   User: ${userInfo?.displayName || 'unknown'}, identityComplete=${identityComplete}`);

        // If identity is incomplete, buffer the event and wait for auth grant
        if (!identityComplete) {
            eventBuffer.push({
                eventName,
                eventData,
                timestamp: new Date().toISOString()
            });
            console.log(`[AIDA Tracking] Identity incomplete, buffered: ${eventName} (${eventBuffer.length} in queue)`);
            startBufferFlushTimer();
            return;
        }

        // Identity is complete — send immediately
        const config = getEffectiveConfig();
        const project = getActivatedProject();
        const company = getActivatedCompany();
        console.log(`[AIDA Tracking][DEBUG]   Building event model: project="${project}", company="${company}"`);
        console.log(`[AIDA Tracking][DEBUG]   Config for send: iKey="${config.instrumentationKey}", endpoint="${config.ingestionEndpoint}"`);
        const event = new TrackingEventModel(eventName, userInfo, eventData, 'aida', project, company);

        // Send to Application Insights
        sendToAppInsights(event, config).then(() => {
            console.log(`[AIDA Tracking][DEBUG]   ✅ Event "${eventName}" sent SUCCESSFULLY`);
        }).catch(err => {
            console.log(`[AIDA Tracking][DEBUG]   ❌ Event "${eventName}" SEND FAILED: ${err.message}`);
            console.log('[AIDA Tracking] Send failed:', err.message);
        });

        console.log('[AIDA Tracking] Event tracked:', eventName);
    } catch (_error: unknown) {
        const error = toError(_error);
        // Silent fail - don't disrupt user experience
        console.log(`[AIDA Tracking][DEBUG]   ❌ EXCEPTION in trackEvent: ${error.message}`);
        console.log('[AIDA Tracking] Error:', error.message);
    }
}

/**
 * Send telemetry to Azure Application Insights
 * Uses the Track API directly (no SDK needed)
 * @param {TrackingEventModel} event - The structured event model
 * @param {AppInsightsConfig} config - App Insights config (from activation key or static)
 * @returns {Promise<void>}
 */
function sendToAppInsights(event: Record<string, any>, config?: AppInsightsConfig) {
    const effectiveConfig = config || getEffectiveConfig();
    console.log(`[AIDA Tracking][DEBUG] sendToAppInsights() called`);
    console.log(`[AIDA Tracking][DEBUG]   Target endpoint: ${effectiveConfig.ingestionEndpoint}v2/track`);
    console.log(`[AIDA Tracking][DEBUG]   iKey: ${effectiveConfig.instrumentationKey}`);
    return new Promise<void>((resolve, reject) => {
        try {
            // Build payload from TrackingEventModel
            const telemetryData = event.toAppInsightsPayload(effectiveConfig.instrumentationKey);
            const data = JSON.stringify(telemetryData);
            console.log(`[AIDA Tracking][DEBUG]   Payload size: ${Buffer.byteLength(data)} bytes`);
            console.log(`[AIDA Tracking][DEBUG]   Payload event name: ${telemetryData?.data?.baseData?.name || 'unknown'}`);
            
            // Parse ingestion endpoint
            const url = new URL(effectiveConfig.ingestionEndpoint + 'v2/track');
            console.log(`[AIDA Tracking][DEBUG]   Resolved URL: ${url.toString()}`);

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
                    console.log(`[AIDA Tracking][DEBUG]   HTTP Response: ${res.statusCode} — ${responseData.substring(0, 200)}`);
                    if (res.statusCode === 200 || res.statusCode === 202) {
                        resolve();
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                    }
                });
            });

            req.on('error', (err) => {
                console.log(`[AIDA Tracking][DEBUG]   ❌ Request error: ${err.message}`);
                reject(err);
            });

            req.on('timeout', () => {
                console.log(`[AIDA Tracking][DEBUG]   ❌ Request TIMEOUT (10s)`);
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(data);
            req.end();
        } catch (error: unknown) {
            console.log(`[AIDA Tracking][DEBUG]   ❌ Exception in sendToAppInsights: ${(error as Error).message}`);
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

// ES exports
export { trackEvent, getUserIdentifier, isTrackingEnabled, isTrackingConfigured, clearUserCache };
