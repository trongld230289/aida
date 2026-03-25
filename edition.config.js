/**
 * AIDA Edition Configuration
 * 
 * Single edition — activation key is always required.
 * Used by webpack DefinePlugin to inject values at build time.
 * 
 * Usage:
 *   npm run build     → Production build
 *   npm run build:dev → Development build
 *   npm run webpack   → Watch mode (development)
 * 
 * In code, use the global constants:
 *   __APP_INSIGHTS_IKEY__      → '' (delivered via activation key)
 *   __APP_INSIGHTS_ENDPOINT__  → '' (delivered via activation key)
 *   __APP_INSIGHTS_APP_ID__    → '' (delivered via activation key)
 *   __ENCRYPTION_SECRET__      → encryption secret for activation key
 */

const config = {
    FORCE_TRACKING: true,
    // App Insights config delivered via encrypted activation key (not hardcoded)
    APP_INSIGHTS_IKEY: '',
    APP_INSIGHTS_ENDPOINT: '',
    APP_INSIGHTS_APP_ID: '',
    ENCRYPTION_SECRET: 'CEP_AIDA',
};

/**
 * Get DefinePlugin replacements
 * @returns {object} DefinePlugin-compatible object
 */
function getDefinePluginConfig() {
    return {
        '__FORCE_TRACKING__': JSON.stringify(config.FORCE_TRACKING),
        '__APP_INSIGHTS_IKEY__': JSON.stringify(config.APP_INSIGHTS_IKEY),
        '__APP_INSIGHTS_ENDPOINT__': JSON.stringify(config.APP_INSIGHTS_ENDPOINT),
        '__APP_INSIGHTS_APP_ID__': JSON.stringify(config.APP_INSIGHTS_APP_ID),
        '__ENCRYPTION_SECRET__': JSON.stringify(config.ENCRYPTION_SECRET),
    };
}

module.exports = { config, getDefinePluginConfig };
