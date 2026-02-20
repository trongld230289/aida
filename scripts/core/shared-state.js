/**
 * @module shared-state
 * @description Shared state & UI logic extracted from extension.js to break circular dependencies.
 * 
 * Previously, review scripts imported these from extension.js via:
 *   const extensionModule = require('../extension');
 * This caused circular deps since extension.js requires those same scripts.
 * 
 * Now scripts import directly:
 *   const { chatSessions, handleEnterTwiceLogic } = require('./core/shared-state');
 */

const vscode = require('vscode');
const path = require('path');

// Session tracking for "Enter twice" functionality and change scores
const chatSessions = new Map();

/**
 * Handle "Enter twice" functionality for chat participants
 * @param {string} participantType - 'review-file' or 'review-changes'
 * @param {object} activeEditor - VS Code active editor
 * @param {object} stream - Chat stream
 * @param {function} autoReviewCallback - Function to call on second enter
 * @returns {boolean} - true if handled (first enter), false if should proceed with auto review
 */
async function handleEnterTwiceLogic(participantType, activeEditor, stream, autoReviewCallback) {
    const fileName = path.basename(activeEditor.document.fileName);
    const sessionKey = `${participantType}-${activeEditor.document.fileName}`;
    const hasSeenQuestion = chatSessions.get(sessionKey) || false;

    console.log(`🔍 Session check: ${sessionKey} = ${hasSeenQuestion}`);

    if (hasSeenQuestion) {
        // Second Enter - Auto proceed like clicking "Yes"
        const emoji = participantType === 'review-file' ? '📁' : '🔍';
        const action = participantType === 'review-file' ? 'File' : 'Changes';

        stream.markdown(`# ${emoji} Reviewing ${action}: \`${fileName}\`\n\n`);
        stream.markdown(`📂 **Auto-proceeding with:** \`${activeEditor.document.fileName}\`\n\n`);
        stream.markdown(`🚀 **Starting ${action.toLowerCase()} review...**\n\n`);

        // Clear the session flag
        chatSessions.delete(sessionKey);

        // Call the auto review function
        await autoReviewCallback();
        return true; // Handled, don't continue
    }

    // First time - Show question and set session flag
    chatSessions.set(sessionKey, true);
    console.log(`🔍 Session set: ${sessionKey} = true`);

    const emoji = participantType === 'review-file' ? '📁' : '🔍';
    const title = participantType === 'review-file' ? 'File Review Assistant' : 'Code Review Assistant';
    const helpCommand = participantType === 'review-file' ? 'aida.showFileHelp' : 'aida.showChangesHelp';
    const buttonText = participantType === 'review-file' ? `✅ Yes, review file ${fileName}` : `✅ Yes, review changes in ${fileName}`;
    const questionText = participantType === 'review-file' ?
        `**Question:** Do you want to review the file \`${fileName}\`?\n\n` :
        `**Question:** Do you want to review git changes for \`${fileName}\`?\n\n`;

    stream.markdown(`# ${emoji} ${title}\n\n`);
    stream.markdown(`**Current file:** \`${fileName}\`\n\n`);

    stream.markdown('\n');

    stream.button({
        command: helpCommand,
        title: '❌ No, show help instead',
        arguments: []
    });

    stream.markdown('\n\n');
    stream.markdown(questionText);
    stream.markdown('💡 **Tip:** Press Enter again to auto-proceed\n');

    return false; // Don't continue, show question first
}

module.exports = {
    chatSessions,
    handleEnterTwiceLogic
};
