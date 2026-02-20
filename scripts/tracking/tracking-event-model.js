/**
 * Tracking Event Model
 * Centralized data model for all telemetry events sent to Application Insights.
 * 
 * Consolidates user info, environment info, and event-specific data
 * into a single structured class for easy management and consistency.
 * 
 * @module tracking-event-model
 */

const vscode = require('vscode');
const os = require('os');

/**
 * Model representing a single tracking event payload.
 * All properties sent to Application Insights are managed here.
 */
class TrackingEventModel {
    /**
     * @param {string} eventName - Event name (from TrackingEvent enum)
     * @param {object} userInfo - User identity from getUserIdentifier()
     * @param {object} eventData - Event-specific data (source, aiProvider, etc.)
     * @param {string} editionType - Edition type ('company' or 'public')
     */
    constructor(eventName, userInfo, eventData = {}, editionType = 'company') {
        // ── Event Info ──
        this.eventName = eventName;
        this.timestamp = new Date().toISOString();

        // ── User Identity ──
        this.userEmail = userInfo.id;
        this.userDisplayName = userInfo.displayName || userInfo.id;
        this.userType = userInfo.type;

        // ── Windows Identity (when available) ──
        this.windowsDomain = userInfo.domain || null;
        this.windowsUsername = userInfo.username || null;
        this.computerName = userInfo.computerName || null;

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
        this.machineId = vscode.env.machineId;
    }

    /**
     * Get extension version from package.json (cached)
     * @returns {string}
     */
    static getExtensionVersion() {
        if (!TrackingEventModel._cachedVersion) {
            try {
                const packageJson = require('../../package.json');
                TrackingEventModel._cachedVersion = packageJson.version;
            } catch (e) {
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
        const props = {
            // User
            userEmail: this.userEmail,
            userDisplayName: this.userDisplayName,
            userType: this.userType,

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

        // Conditionally include Windows-specific fields
        if (this.windowsDomain) props.windowsDomain = this.windowsDomain;
        if (this.windowsUsername) props.windowsUsername = this.windowsUsername;
        if (this.computerName) props.computerName = this.computerName;

        return props;
    }

    /**
     * Convert to Application Insights tags (standard context fields).
     * These map to well-known App Insights dimensions.
     * @returns {object}
     */
    toAppInsightsTags() {
        return {
            'ai.user.id': this.userEmail,
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
    toAppInsightsPayload(instrumentationKey) {
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
TrackingEventModel._cachedVersion = null;

module.exports = { TrackingEventModel };
