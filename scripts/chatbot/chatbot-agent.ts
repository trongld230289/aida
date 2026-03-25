/**
 * @module chatbot-agent
 * @description Thin facade that merges agent sub-modules into a single
 * agentMethods object for mixin into CopilotSidebarChat.prototype.
 *
 * All logic lives in:
 *   - ./tools/agent-tools        (VS Code file API tools)
 *   - ./tools/agent-planner      (task planning)
 *   - ./tools/agent-executor     (plan execution, component generation)
 *   - ./tools/agent-refactoring  (AI + rule-based refactoring)
 *   - ./tools/agent-analysis     (code analysis, inspection, verification)
 */

import { agentToolsMethods } from './tools/agent-tools';
import { agentPlannerMethods } from './tools/agent-planner';
import { agentExecutorMethods } from './tools/agent-executor';
import { agentRefactoringMethods } from './tools/agent-refactoring';
import { agentAnalysisMethods } from './tools/agent-analysis';

const agentMethods = {
    ...agentToolsMethods,
    ...agentPlannerMethods,
    ...agentExecutorMethods,
    ...agentRefactoringMethods,
    ...agentAnalysisMethods
};

// ES exports
export { agentMethods };
