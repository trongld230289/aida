/**
 * @module core
 * @description Barrel file for all core modules
 * Re-exports everything from core submodules
 */

const abortSignal = require('./abort-signal');
const tokenEstimator = require('./token-estimator');
const aiProvider = require('./ai-provider');
const modelSelector = require('./model-selector');
const templateEngine = require('./template-engine');
const sourceControlConfig = require('./source-control-config');
const businessDocs = require('./business-docs');
const reviewUI = require('./review-ui');
const sharedState = require('./shared-state');

module.exports = {
    ...abortSignal,
    ...tokenEstimator,
    ...aiProvider,
    ...modelSelector,
    ...templateEngine,
    ...sourceControlConfig,
    ...businessDocs,
    ...reviewUI,
    ...sharedState
};
