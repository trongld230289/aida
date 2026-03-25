/**
 * Tracking Event Model
 * Centralized data model for all telemetry events sent to Application Insights.
 * 
 * Consolidates user info, environment info, and event-specific data
 * into a single structured class for easy management and consistency.
 * 
 * @module tracking-event-model
 */

import * as vscode from 'vscode';
import * as os from 'os';
import packageJson from '../../package.json';

/**
 * Model representing a single tracking event payload.
 * All properties sent to Application Insights are managed here.
 */
class TrackingEventModel {
    static _cachedVersion: string;
    /**
     * @param {string} eventName - Event name (from TrackingEvent enum)
     * @param {object} userInfo - User identity from getUserIdentifier()
     * @param {object} eventData - Event-specific data (source, aiProvider, etc.)
     * @param {string} editionType - Edition type ('company' or 'public')
     */
    eventName: string;
    timestamp: string;

    // Resolved display name (windowsDisplayName ?? microsoftAccount ?? githubAccount)
    userDisplayName: string;

    // Windows identity
    windowsId: string;
    windowsDomain: string;
    windowsUsername: string;
    computerName: string;
    windowsDisplayName: string;

    // Account identities
    microsoftAccount: string;
    githubAccount: string;

    // Project (from activation key)
    project: string;

    // Company (from activation key)
    company: string;

    // Machine
    machineId: string;

    eventData: Record<string, unknown>;
    extensionVersion: string;
    editionType: string;
    vscodeVersion: string;
    appName: string;
    language: string;
    uiKind: string;
    remoteName: string;
    osPlatform: string;
    osArch: string;
    sessionId: string;
    constructor(eventName: string, userInfo: Record<string, string>, eventData = {}, editionType = 'company', project = '', company = '') {
        // ── Event Info ──
        this.eventName = eventName;
        this.timestamp = new Date().toISOString();

        // ── User Identity (all sources collected in parallel) ──
        this.userDisplayName = userInfo.displayName || '';

        // Windows
        this.windowsId = userInfo.windowsId || '';
        this.windowsDomain = userInfo.windowsDomain || '';
        this.windowsUsername = userInfo.windowsUsername || '';
        this.computerName = userInfo.computerName || '';
        this.windowsDisplayName = userInfo.windowsDisplayName || '';

        // Accounts
        this.microsoftAccount = userInfo.microsoftAccount || '';
        this.githubAccount = userInfo.githubAccount || '';

        // Machine
        this.machineId = userInfo.machineId || vscode.env.machineId;

        // ── Project (from activation key) ──
        this.project = project;

        // ── Company (from activation key) ──
        this.company = company;

        // ── Event-Specific Data ──
        this.eventData = eventData;

        // ── Extension Info ──
        this.extensionVersion = TrackingEventModel.getExtensionVersion();
        this.editionType = editionType;

        // ── VS Code Environment ──
        this.vscodeVersion = vscode.version;
        this.appName = vscode.env.appName;
        this.language = vscode.env.language;
        this.uiKind = vscode.env.uiKind === 1 ? 'desktop' : 'web';
        this.remoteName = vscode.env.remoteName || 'local';

        // ── System Info ──
        this.osPlatform = process.platform;   // win32, darwin, linux
        this.osArch = os.arch();              // x64, arm64

        // ── Session Identifiers (for App Insights tags) ──
        this.sessionId = vscode.env.sessionId;
    }

    /**
     * Get extension version from package.json (cached)
     * @returns {string}
     */
    static getExtensionVersion() {
        if (!TrackingEventModel._cachedVersion) {
            try {
                
                TrackingEventModel._cachedVersion = packageJson.version;
            } catch (_e: unknown) {
                TrackingEventModel._cachedVersion = '0.0.0';
            }
        }
        return TrackingEventModel._cachedVersion;
    }

    /**
     * Convert to Application Insights custom properties (flat key-value map).
     * This is what gets stored in `customDimensions` in App Insights.
     * @returns {object}
     */
    toCustomProperties() {
        const props: Record<string, string> = {
            // User display name (resolved: windows ?? microsoft ?? github)
            userDisplayName: this.userDisplayName,

            // Windows identity
            windowsId: this.windowsId,
            windowsDomain: this.windowsDomain,
            windowsUsername: this.windowsUsername,
            computerName: this.computerName,
            windowsDisplayName: this.windowsDisplayName,

            // Account identities
            microsoftAccount: this.microsoftAccount,
            githubAccount: this.githubAccount,

            // Project
            project: this.project,

            // Company
            company: this.company,

            // Event
            eventData: JSON.stringify(this.eventData),

            // Extension
            extensionVersion: this.extensionVersion,
            editionType: this.editionType,

            // VS Code
            vscodeVersion: this.vscodeVersion,
            appName: this.appName,
            language: this.language,
            uiKind: this.uiKind,
            remoteName: this.remoteName,

            // System
            osPlatform: this.osPlatform,
            osArch: this.osArch
        };

        return props;
    }

    /**
     * Convert to Application Insights tags (standard context fields).
     * These map to well-known App Insights dimensions.
     * @returns {object}
     */
    toAppInsightsTags() {
        return {
            'ai.user.id': this.windowsId || this.microsoftAccount || this.githubAccount || this.machineId,
            'ai.session.id': this.sessionId,
            'ai.device.id': this.machineId,
            'ai.device.os': this.osPlatform,
            'ai.application.ver': this.extensionVersion,
            'ai.cloud.roleInstance': this.appName
        };
    }

    /**
     * Build the full Application Insights Track API payload.
     * @param {string} instrumentationKey - App Insights iKey
     * @returns {object}
     */
    toAppInsightsPayload(instrumentationKey: string) {
        return {
            name: 'Microsoft.ApplicationInsights.' + instrumentationKey.replace(/-/g, '') + '.Event',
            time: this.timestamp,
            iKey: instrumentationKey,
            tags: this.toAppInsightsTags(),
            data: {
                baseType: 'EventData',
                baseData: {
                    ver: 2,
                    name: this.eventName,
                    properties: this.toCustomProperties()
                }
            }
        };
    }
}

// Static cache for extension version

// ES exports
export { TrackingEventModel };
