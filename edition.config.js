/**
 * AIDA Edition Configuration
 * 
 * Defines the differences between Public and Company editions.
 * Used by webpack DefinePlugin to inject values at build time.
 * 
 * Usage:
 *   npm run build              → Public edition (no tracking, no iKey)
 *   npm run build:company      → Company edition (tracking enabled, App Insights)
 *   npm run build:dev          → Dev mode with company edition
 *   npm run webpack            → Watch mode with company edition
 * 
 * In code, use the global constants:
 *   __EDITION_TYPE__           → 'public' | 'company'
 *   __IS_COMPANY_VERSION__     → true | false
 *   __APP_INSIGHTS_IKEY__      → '' | 'your-instrumentation-key'
 *   __APP_INSIGHTS_ENDPOINT__  → '' | 'https://...'
 *   __APP_INSIGHTS_APP_ID__    → '' | 'your-app-id'
 *   __FORCE_TRACKING__         → true | false
 */

const editions = {
    public: {
        EDITION_TYPE: 'public',
        IS_COMPANY_VERSION: false,
        FORCE_TRACKING: false,
        APP_INSIGHTS_IKEY: '',
        APP_INSIGHTS_ENDPOINT: '',
        APP_INSIGHTS_APP_ID: '',
    },
    company: {
        EDITION_TYPE: 'company',
        IS_COMPANY_VERSION: true,
        FORCE_TRACKING: true,
        APP_INSIGHTS_IKEY: '269da95a-6552-4a00-99f2-a1ac3325d059',
        APP_INSIGHTS_ENDPOINT: 'https://centralus-2.in.applicationinsights.azure.com/',
        APP_INSIGHTS_APP_ID: 'c6b1d4c7-14af-4ae8-8540-e5870bad4aab',
    }
};

/**
 * Get DefinePlugin replacements for a given edition
 * @param {'public' | 'company'} editionName 
 * @returns {object} DefinePlugin-compatible object
 */
function getDefinePluginConfig(editionName) {
    const edition = editions[editionName] || editions.public;
    return {
        '__EDITION_TYPE__': JSON.stringify(edition.EDITION_TYPE),
        '__IS_COMPANY_VERSION__': JSON.stringify(edition.IS_COMPANY_VERSION),
        '__FORCE_TRACKING__': JSON.stringify(edition.FORCE_TRACKING),
        '__APP_INSIGHTS_IKEY__': JSON.stringify(edition.APP_INSIGHTS_IKEY),
        '__APP_INSIGHTS_ENDPOINT__': JSON.stringify(edition.APP_INSIGHTS_ENDPOINT),
        '__APP_INSIGHTS_APP_ID__': JSON.stringify(edition.APP_INSIGHTS_APP_ID),
    };
}

module.exports = { editions, getDefinePluginConfig };
