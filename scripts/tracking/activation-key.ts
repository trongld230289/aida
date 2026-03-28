/**
 * AIDA Activation Key Module
 * 
 * Handles activation key decryption, validation, and domain checking.
 * ALL features are BLOCKED until a valid activation key is entered.
 * 
 * Flow:
 *   1. Admin generates encrypted key using generate-activation-key.js (secret: CEP_AIDA)
 *   2. Employee pastes key into VS Code setting: aida.activationKey
 *   3. Extension decrypts key → validates domain + expiry → unlocks all features
 * 
 * @module activation-key
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';

// Lazy import to avoid circular dependency (usage-tracking imports from activation-key)
function _getUserIdentifier() {
    return require('./usage-tracking').getUserIdentifier;
}

// ============================================
// BUILD-TIME INJECTED CONSTANTS
// ============================================
declare const __ENCRYPTION_SECRET__: string;

const ENCRYPTION_SECRET = __ENCRYPTION_SECRET__;
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;  // AES CBC requires 16-byte IV

// ============================================
// Public Key (no usage tracking)
// ============================================

const PUBLIC_KEY = 'aida-public-key';

/**
 * Check if user entered the public activation key.
 * Public key bypasses encryption, domain, and expiry checks.
 * Usage tracking is disabled (no App Insights config).
 */
export function isPublicKey(key: string): boolean {
    return key === PUBLIC_KEY;
}

// ============================================
// Interfaces
// ============================================

export interface ActivationKeyPayload {
    company: string;
    project: string;              // Project name (e.g. "ProjectX")
    domains: string[];           // Windows domains (e.g. ["CORPDOMAIN"])
    appInsights: {
        instrumentationKey: string;
        ingestionEndpoint: string;
        applicationId: string;
    };
    expires: string;  // ISO date string (e.g. "2027-12-31")
    issued: string;   // ISO date string (e.g. "2026-03-04")
}

export interface ActivationResult {
    valid: boolean;
    payload?: ActivationKeyPayload;
    error?: string;
}

export interface AppInsightsConfig {
    instrumentationKey: string;
    ingestionEndpoint: string;
    applicationId: string;
}

// ============================================
// Cache
// ============================================

let cachedResult: ActivationResult | null = null;
let configChangeDisposable: vscode.Disposable | null = null;
let onActivationCallback: (() => void) | null = null;
let featuresRegistered = false;
let expiryCheckTimer: ReturnType<typeof setInterval> | null = null;

// Check expiry every hour (ms)
const EXPIRY_CHECK_INTERVAL_MS = 60 * 60 * 1000;

// ============================================
// Core Functions
// ============================================

/**
 * Derive a 32-byte encryption key from the secret string using SHA-256.
 * This ensures the key is always the correct length for AES-256.
 */
function deriveKey(secret: string): Buffer {
    return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Decrypt an activation key string back to its JSON payload.
 * 
 * Format: base64( IV(16 bytes) + encrypted_data )
 * 
 * @param encryptedKey - The base64-encoded activation key from user
 * @param secret - The encryption secret (CEP_AIDA, baked into extension)
 * @returns Parsed ActivationKeyPayload
 * @throws Error if decryption or parsing fails
 */
export function decryptActivationKey(encryptedKey: string, secret: string): ActivationKeyPayload {
    try {
        const key = deriveKey(secret);
        const combined = Buffer.from(encryptedKey, 'base64');

        if (combined.length < IV_LENGTH + 1) {
            throw new Error('Invalid activation key format: too short');
        }

        const iv = combined.subarray(0, IV_LENGTH);
        const encrypted = combined.subarray(IV_LENGTH);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(encrypted, undefined, 'utf8');
        decrypted += decipher.final('utf8');

        const payload = JSON.parse(decrypted) as ActivationKeyPayload;

        // Basic shape validation
        if (!payload.company || !payload.project || !payload.domains || !payload.appInsights?.instrumentationKey) {
            throw new Error('Invalid activation key payload: missing required fields');
        }

        return payload;
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown decryption error';
        throw new Error(`Failed to decrypt activation key: ${msg}`);
    }
}

/**
 * Check if the current machine's Windows domain matches the allowed domains.
 * 
 * Checks process.env.USERDOMAIN (e.g. "CORPDOMAIN") against payload.domains[].
 * Case-insensitive comparison.
 * 
 * @param allowedDomains - Array of allowed Windows domain names
 * @returns true if domain matches or if not on Windows (skip check)
 */
export function checkDomain(allowedDomains: string[]): boolean {
    if (process.platform !== 'win32') {
        // Non-Windows: skip domain check (could add email domain check later)
        console.log('[AIDA Activation] Non-Windows platform, domain check skipped');
        return true;
    }

    const currentDomain = (process.env.USERDOMAIN || '').toUpperCase();
    if (!currentDomain) {
        console.log('[AIDA Activation] No USERDOMAIN found');
        return false;
    }

    const match = allowedDomains.some(d => d.toUpperCase() === currentDomain);
    if (!match) {
        console.log(`[AIDA Activation] Domain mismatch: "${currentDomain}" not in [${allowedDomains.join(', ')}]`);
    }
    return match;
}

/**
 * Check if the activation key has expired.
 * 
 * @param expiresDate - ISO date string (e.g. "2027-12-31")
 * @returns true if NOT expired (still valid)
 */
export function checkExpiry(expiresDate: string): boolean {
    const expiry = new Date(expiresDate);
    const now = new Date();

    if (isNaN(expiry.getTime())) {
        console.log('[AIDA Activation] Invalid expiry date format');
        return false;
    }

    // Set expiry to end of day
    expiry.setHours(23, 59, 59, 999);

    if (now > expiry) {
        console.log(`[AIDA Activation] Key expired on ${expiresDate}`);
        return false;
    }

    return true;
}

/**
 * Validate the activation key from VS Code settings.
 * 
 * Reads `aida.activationKey` setting → decrypt → check expiry → check domain.
 * Results are cached until the setting changes.
 * 
 * @returns ActivationResult with valid flag and payload/error
 */
export function validateActivationKey(): ActivationResult {
    console.log('[AIDA Activation][DEBUG] validateActivationKey() called');
    console.log(`[AIDA Activation][DEBUG]   ENCRYPTION_SECRET present = ${!!ENCRYPTION_SECRET} (length=${ENCRYPTION_SECRET?.length || 0})`);

    // Return cached result if available
    if (cachedResult) {
        console.log(`[AIDA Activation][DEBUG]   Returning CACHED result: valid=${cachedResult.valid}, error=${cachedResult.error || 'none'}`);
        return cachedResult;
    }

    // Read activation key from VS Code settings
    const config = vscode.workspace.getConfiguration('aida');
    const activationKey = config.get<string>('activationKey', '').trim();

    console.log(`[AIDA Activation][DEBUG]   activationKey present = ${!!activationKey} (length=${activationKey.length})`);
    if (activationKey) {
        console.log(`[AIDA Activation][DEBUG]   activationKey prefix = "${activationKey.substring(0, 20)}..."`);
    }

    if (!activationKey) {
        cachedResult = { valid: false, error: 'No activation key configured. Set "aida.activationKey" in VS Code settings.' };
        console.log(`[AIDA Activation][DEBUG]   ❌ No key configured`);
        return cachedResult;
    }

    // ── Public key: skip decryption, domain, expiry — no usage tracking ──
    if (isPublicKey(activationKey)) {
        console.log(`[AIDA Activation] ✅ Public key detected — activated without usage tracking`);
        const publicResult: ActivationResult = {
            valid: true,
            payload: {
                company: 'Public',
                project: 'AIDA-Public',
                domains: [],
                appInsights: {
                    instrumentationKey: '',
                    ingestionEndpoint: '',
                    applicationId: '',
                },
                expires: '2099-12-31',
                issued: new Date().toISOString().slice(0, 10),
            },
        };
        cachedResult = publicResult;
        return publicResult;
    }

    try {
        // Step 1: Decrypt
        console.log(`[AIDA Activation][DEBUG]   Step 1: Decrypting...`);
        const payload = decryptActivationKey(activationKey, ENCRYPTION_SECRET);
        console.log(`[AIDA Activation][DEBUG]   Step 1 ✅ Decrypted OK`);
        console.log(`[AIDA Activation][DEBUG]     company  = ${payload.company}`);
        console.log(`[AIDA Activation][DEBUG]     project  = ${payload.project}`);
        console.log(`[AIDA Activation][DEBUG]     domains  = [${payload.domains?.join(', ')}]`);
        console.log(`[AIDA Activation][DEBUG]     expires  = ${payload.expires}`);
        console.log(`[AIDA Activation][DEBUG]     issued   = ${payload.issued}`);
        console.log(`[AIDA Activation][DEBUG]     iKey     = ${payload.appInsights?.instrumentationKey || 'MISSING'}`);
        console.log(`[AIDA Activation][DEBUG]     endpoint = ${payload.appInsights?.ingestionEndpoint || 'MISSING'}`);
        console.log(`[AIDA Activation][DEBUG]     appId    = ${payload.appInsights?.applicationId || 'MISSING'}`);

        // Step 2: Check expiry
        console.log(`[AIDA Activation][DEBUG]   Step 2: Checking expiry... (now=${new Date().toISOString()}, expires=${payload.expires})`);
        if (!checkExpiry(payload.expires)) {
            cachedResult = { valid: false, error: `Activation key expired on ${payload.expires} (company: ${payload.company})` };
            console.log(`[AIDA Activation][DEBUG]   Step 2 ❌ EXPIRED`);
            return cachedResult;
        }
        console.log(`[AIDA Activation][DEBUG]   Step 2 ✅ Not expired`);

        // Step 3: Check domain
        const currentDomain = process.env.USERDOMAIN || 'unknown';
        console.log(`[AIDA Activation][DEBUG]   Step 3: Checking domain... (current="${currentDomain}", allowed=[${payload.domains?.join(', ')}])`);
        if (!checkDomain(payload.domains)) {
            cachedResult = { valid: false, error: `Domain mismatch: "${currentDomain}" not allowed for ${payload.company}` };
            console.log(`[AIDA Activation][DEBUG]   Step 3 ❌ DOMAIN MISMATCH`);
            return cachedResult;
        }
        console.log(`[AIDA Activation][DEBUG]   Step 3 ✅ Domain OK`);

        // All checks passed
        console.log(`[AIDA Activation] \u2705 Key valid \u2014 Company: ${payload.company}, Project: ${payload.project}, Expires: ${payload.expires}`);
        console.log(`[AIDA Activation][DEBUG]   ✅ ALL CHECKS PASSED — key is VALID`);
        cachedResult = { valid: true, payload };
        return cachedResult;

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Invalid activation key';
        console.log(`[AIDA Activation][DEBUG]   ❌ EXCEPTION: ${msg}`);
        cachedResult = { valid: false, error: msg };
        return cachedResult;
    }
}

/**
 * Get App Insights config from a valid activation key.
 * Returns null if no valid activation key.
 * 
 * @returns AppInsightsConfig or null
 */
export function getActivatedConfig(): AppInsightsConfig | null {
    console.log('[AIDA Activation][DEBUG] getActivatedConfig() called');
    const result = validateActivationKey();
    if (result.valid && result.payload) {
        console.log(`[AIDA Activation][DEBUG]   Returning appInsights config: iKey=${result.payload.appInsights.instrumentationKey}, endpoint=${result.payload.appInsights.ingestionEndpoint}`);
        return result.payload.appInsights;
    }
    console.log(`[AIDA Activation][DEBUG]   Returning NULL (valid=${result.valid}, error=${result.error || 'none'})`);
    return null;
}

/**
 * Get the project name from a valid activation key.
 * Returns empty string if no valid key.
 */
export function getActivatedProject(): string {
    const result = validateActivationKey();
    if (result.valid && result.payload) {
        return result.payload.project || '';
    }
    return '';
}

/**
 * Get the company name from a valid activation key.
 * Returns empty string if no valid key.
 */
export function getActivatedCompany(): string {
    const result = validateActivationKey();
    if (result.valid && result.payload) {
        return result.payload.company || '';
    }
    return '';
}

/**
 * Check if the extension is activated (features should be enabled).
 * True only if a valid activation key is present.
 */
export function isActivated(): boolean {
    return validateActivationKey().valid;
}

/**
 * Check if features have been registered after activation.
 */
export function areFeaturesRegistered(): boolean {
    return featuresRegistered;
}

/**
 * Mark features as registered (called after registerAllFeatures succeeds).
 */
export function markFeaturesRegistered(): void {
    featuresRegistered = true;
}

/**
 * Register a callback to be called when activation key becomes valid.
 * Used by extension.ts to register all features after activation.
 */
export function onActivated(callback: () => void): void {
    onActivationCallback = callback;
}

/**
 * Get the full activation status for display.
 * 
 * @returns Human-readable status string
 */
export function getActivationStatus(): string {
    const result = validateActivationKey();
    if (result.valid && result.payload) {
        const p = result.payload;
        return `✅ Activated\n• Company: ${p.company}\n• Project: ${p.project}\n• Domains: ${p.domains.join(', ')}\n• Expires: ${p.expires}\n• Issued: ${p.issued}`;
    }
    return `❌ Not activated\n• ${result.error || 'Unknown error'}`;
}

/**
 * Clear the cached activation result.
 * Called when the user changes the activation key setting.
 */
export function clearActivationCache(): void {
    cachedResult = null;
    console.log('[AIDA Activation] Cache cleared');
}

/**
 * Show the "not activated" blocking message with a button to open settings.
 */
async function showActivationRequiredMessage(): Promise<void> {
    const action = await vscode.window.showWarningMessage(
        'AIDA requires an activation key. Please contact your admin to get one, then enter it in Settings.',
        'Open Settings'
    );
    if (action === 'Open Settings') {
        void vscode.commands.executeCommand('workbench.action.openSettings', 'aida.activationKey');
    }
}

/**
 * Initialize activation key system.
 * Sets up config change listener to auto-revalidate when setting changes.
 * Shows blocking message if no valid key.
 * 
 * @param context - VS Code extension context for subscriptions
 */
export function initializeActivationKey(context: vscode.ExtensionContext): void {
    // Listen for configuration changes
    if (configChangeDisposable) {
        configChangeDisposable.dispose();
    }

    configChangeDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('aida.activationKey')) {
            console.log('[AIDA Activation] Setting changed, revalidating...');
            clearActivationCache();

            // Revalidate and notify user
            const result = validateActivationKey();
            if (result.valid && result.payload) {
                vscode.window.showInformationMessage(
                    `AIDA: Activation key valid \u2705 (${result.payload.company} \u2014 ${result.payload.project}, expires ${result.payload.expires})`
                );

                // Pre-warm user identity to trigger GitHub/Microsoft trust prompts early
                console.log('[AIDA Activation] Pre-warming user identity (triggering trust prompts)...');
                void _getUserIdentifier()();

                // If features haven't been registered yet, trigger the callback
                if (!featuresRegistered && onActivationCallback) {
                    console.log('[AIDA Activation] Key now valid — registering all features...');
                    onActivationCallback();
                }
            } else {
                vscode.window.showWarningMessage(
                    `AIDA: Activation key invalid — ${result.error}`
                );
            }
        }
    });

    context.subscriptions.push(configChangeDisposable);

    // ── Periodic expiry check (every hour) ──────────────────────
    // Handles the case where a key expires while VS Code is running.
    if (expiryCheckTimer) {
        clearInterval(expiryCheckTimer);
    }
    expiryCheckTimer = setInterval(() => {
            if (!cachedResult?.valid) return; // Only check if currently valid

            // Clear cache to force re-validation (including expiry check)
            clearActivationCache();
            const result = validateActivationKey();
            if (!result.valid) {
                console.log(`[AIDA Activation] ❌ Key expired during session: ${result.error}`);
                vscode.window.showWarningMessage(
                    `AIDA: Activation key has expired. Please contact your admin for a new key.`,
                    'Open Settings'
                ).then(action => {
                    if (action === 'Open Settings') {
                        void vscode.commands.executeCommand('workbench.action.openSettings', 'aida.activationKey');
                    }
                });
            }
        }, EXPIRY_CHECK_INTERVAL_MS);

        context.subscriptions.push({ dispose: () => {
            if (expiryCheckTimer) {
                clearInterval(expiryCheckTimer);
                expiryCheckTimer = null;
            }
        }});

    // Initial validation
    const result = validateActivationKey();
    if (result.valid) {
        console.log(`[AIDA Activation] \u2705 Activated: ${result.payload?.company} \u2014 ${result.payload?.project}`);
        // Pre-warm user identity on startup to trigger trust prompts early
        console.log('[AIDA Activation] Pre-warming user identity on startup...');
        void _getUserIdentifier()();
    } else {
        console.log(`[AIDA Activation] \u274c ${result.error}`);
        // Show blocking notification
        void showActivationRequiredMessage();
    }
}
