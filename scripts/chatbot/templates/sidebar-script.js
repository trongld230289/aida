// AIDA Chatbot Frontend Script
// This script handles all frontend interactions for the chatbot sidebar

const vscode = acquireVsCodeApi();

const chatContainer = document.getElementById('chatContainer');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
const participantSuggest = document.getElementById('participantSuggest');
const attachmentsContainer = document.getElementById('attachmentsContainer');
const currentFileIndicator = document.getElementById('currentFileIndicator');
const currentFileName = document.getElementById('currentFileName');
const removeFileBtn = document.getElementById('removeFileBtn');

// Image attachments array
let imageAttachments = [];

// Mode and model state
let currentMode = 'ask'; // 'ask' or 'agent'
let currentModel = 'claude-sonnet-4';
let currentFileContext = null; // Track current file context

// Available chat participants
const participants = [
    { name: '@review-file', icon: '📁', description: 'Review current opening file or specify file path' },
    { name: '@review-changes', icon: '🔍', description: 'Review changes for current opening file or specify file path' },
    { name: '@review-pr', icon: '🔄', description: 'Review Azure DevOps Pull Request by PR ID or URL' },
    { name: '@sync-review-templates', icon: '⚙️', description: 'Sync AIDA review templates to workspace' }
];

let selectedIndex = -1;

// Mode switching
document.querySelectorAll('.mode-button').forEach(button => {
    button.addEventListener('click', function() {
        // Remove active from all buttons
        document.querySelectorAll('.mode-button').forEach(btn => btn.classList.remove('active'));
        
        // Add active to clicked button
        this.classList.add('active');
        
        // Update current mode
        currentMode = this.getAttribute('data-mode');
        
        // Update placeholder based on mode
        updatePlaceholderForMode(currentMode);
    });
});

function updatePlaceholderForMode(mode) {
    if (mode === 'ask') {
        msgInput.placeholder = 'Ask AIDA to help with code, review files, or answer questions...';
    } else if (mode === 'agent') {
        msgInput.placeholder = 'Describe what you want to build, and Agent will automatically create it...';
    }
}

function openModelConfig() {
    vscode.postMessage({
        type: 'openModelConfig'
    });
}

// Initialize placeholder for default mode
updatePlaceholderForMode(currentMode);

// Remove file button handler
removeFileBtn.addEventListener('click', function() {
    clearCurrentFile();
});

// Function to update current file display
function updateCurrentFileDisplay(fileName, fullPath) {
    if (fileName) {
        currentFileName.textContent = fileName;
        currentFileIndicator.style.display = 'flex';
        currentFileContext = { fileName, fullPath };
        
        // Update placeholder based on file context
        updatePlaceholderWithFile(fileName);
    } else {
        clearCurrentFile();
    }
}

// Function to clear current file
function clearCurrentFile() {
    currentFileIndicator.style.display = 'none';
    currentFileContext = null;
    updatePlaceholderForMode(currentMode);
}

// Update placeholder with file context
function updatePlaceholderWithFile(fileName) {
    if (currentMode === 'ask') {
        msgInput.placeholder = 'Ask about ' + fileName + ' or any coding questions...';
    } else if (currentMode === 'agent') {
        msgInput.placeholder = 'What would you like Agent to do with ' + fileName + '?';
    }
}

// Auto-resize input
msgInput.addEventListener('input', function() {
    this.style.height = 'auto';
    const newHeight = Math.max(Math.min(this.scrollHeight, 120), 36); // Min 36px, max 120px
    this.style.height = newHeight + 'px';
    
    // Reset history navigation when user starts typing
    vscode.postMessage({
        type: 'resetHistoryIndex'
    });
    
    // Handle @ participant suggestions
    handleParticipantSuggest(this.value, this.selectionStart);
    
    // Update send button state
    updateSendButtonState();
});

// Image paste handling - exactly like GitHub Copilot
msgInput.addEventListener('paste', async function(event) {
    const items = event.clipboardData.items;
    let hasImage = false;
    
    for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
            event.preventDefault();
            hasImage = true;
            
            const file = item.getAsFile();
            if (file) {
                await addImageAttachment(file);
            }
            break;
        }
    }
    
    if (hasImage) {
        updateSendButtonState();
    }
});

// Drag and drop support
msgInput.addEventListener('dragover', function(event) {
    event.preventDefault();
    this.style.borderColor = 'var(--vscode-button-background)';
});

msgInput.addEventListener('dragleave', function(event) {
    event.preventDefault();
    this.style.borderColor = 'var(--vscode-input-border)';
});

msgInput.addEventListener('drop', async function(event) {
    event.preventDefault();
    this.style.borderColor = 'var(--vscode-input-border)';
    
    const files = Array.from(event.dataTransfer.files);
    for (const file of files) {
        if (file.type.startsWith('image/')) {
            await addImageAttachment(file);
        }
    }
    
    updateSendButtonState();
});

// Send on Enter and handle suggestions
msgInput.addEventListener('keydown', function(e) {
    if (participantSuggest.style.display === 'block') {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            navigateSuggestions(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            navigateSuggestions(-1);
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            selectParticipant(selectedIndex);
        } else if (e.key === 'Escape') {
            hideSuggestions();
        }
    } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    } else if (e.key === 'ArrowUp' && !e.shiftKey && !e.ctrlKey) {
        // Navigate message history up (older messages)
        e.preventDefault();
        navigateHistory('up');
    } else if (e.key === 'ArrowDown' && !e.shiftKey && !e.ctrlKey) {
        // Navigate message history down (newer messages)
        e.preventDefault();
        navigateHistory('down');
    }
});

sendBtn.addEventListener('click', sendMessage);

// Participant suggestion functions
function handleParticipantSuggest(value, cursorPos) {
    const beforeCursor = value.substring(0, cursorPos);
    const atMatch = beforeCursor.match(/@([a-z-]*)$/);
    
    if (atMatch) {
        const query = atMatch[1].toLowerCase();
        const filtered = participants.filter(p => 
            p.name.toLowerCase().includes('@' + query)
        );
        
        if (filtered.length > 0) {
            showSuggestions(filtered);
        } else {
            hideSuggestions();
        }
    } else {
        hideSuggestions();
    }
}

function showSuggestions(filtered) {
    selectedIndex = -1;
    participantSuggest.innerHTML = filtered.map((p, index) => 
        '<div class="participant-item" data-index="' + index + '">' +
            '<span class="participant-icon">' + p.icon + '</span>' +
            '<div>' +
                '<div class="participant-name">' + p.name + '</div>' +
                '<div class="participant-description">' + p.description + '</div>' +
            '</div>' +
        '</div>'
    ).join('');
    
    participantSuggest.style.display = 'block';
    
    // Add click handlers
    participantSuggest.querySelectorAll('.participant-item').forEach((item, index) => {
        item.addEventListener('click', () => selectParticipant(index));
    });
}

function hideSuggestions() {
    participantSuggest.style.display = 'none';
    selectedIndex = -1;
}

function navigateSuggestions(direction) {
    const items = participantSuggest.querySelectorAll('.participant-item');
    if (items.length === 0) return;
    
    // Remove previous selection
    items.forEach(item => item.classList.remove('selected'));
    
    // Update selected index
    selectedIndex += direction;
    if (selectedIndex < 0) selectedIndex = items.length - 1;
    if (selectedIndex >= items.length) selectedIndex = 0;
    
    // Add selection to current item
    items[selectedIndex].classList.add('selected');
}

function selectParticipant(index) {
    const items = participantSuggest.querySelectorAll('.participant-item');
    if (index >= 0 && index < items.length) {
        const participantName = items[index].querySelector('.participant-name').textContent;
        
        // Replace the @ query with selected participant
        const value = msgInput.value;
        const cursorPos = msgInput.selectionStart;
        const beforeCursor = value.substring(0, cursorPos);
        const afterCursor = value.substring(cursorPos);
        const atMatch = beforeCursor.match(/@([a-z-]*)$/);
        
        if (atMatch) {
            const newValue = beforeCursor.replace(/@([a-z-]*)$/, participantName + ' ') + afterCursor;
            msgInput.value = newValue;
            msgInput.focus();
            msgInput.setSelectionRange(newValue.length - afterCursor.length, newValue.length - afterCursor.length);
        }
    }
    hideSuggestions();
}

// Image attachment functions
async function addImageAttachment(file) {
    // Validate file size (5MB limit like Claude)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        showError('Image too large. Please use images smaller than 5MB.');
        return;
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
        showError('Unsupported image format. Please use JPEG, PNG, GIF, or WebP.');
        return;
    }
    
    try {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const imageData = {
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                data: e.target.result,
                type: file.type,
                name: file.name || 'image',
                size: file.size
            };
            
            imageAttachments.push(imageData);
            displayImageAttachment(imageData);
            updateAttachmentsVisibility();
        };
        
        reader.onerror = function() {
            showError('Failed to read image file.');
        };
        
        reader.readAsDataURL(file);
    } catch (error) {
        showError('Error processing image: ' + error.message);
    }
}

function displayImageAttachment(imageData) {
    const attachmentDiv = document.createElement('div');
    attachmentDiv.className = 'image-attachment';
    attachmentDiv.setAttribute('data-id', imageData.id);
    
    attachmentDiv.innerHTML = `
        <div class="image-preview" onclick="showImageTooltip(this)">
            <img src="${imageData.data}" alt="${imageData.name}">
            <div class="image-tooltip">
                <img src="${imageData.data}" alt="${imageData.name}">
            </div>
        </div>
        <div class="image-filename" title="${imageData.name}">${imageData.name}</div>
        <button class="remove-image" onclick="removeImageAttachment('${imageData.id}')" title="Remove image">×</button>
    `;
    
    attachmentsContainer.appendChild(attachmentDiv);
}

function removeImageAttachment(imageId) {
    imageAttachments = imageAttachments.filter(img => img.id !== imageId);
    
    const attachmentElement = document.querySelector(`[data-id="${imageId}"]`);
    if (attachmentElement) {
        attachmentElement.remove();
    }
    
    updateAttachmentsVisibility();
    updateSendButtonState();
}

function updateAttachmentsVisibility() {
    if (imageAttachments.length > 0) {
        attachmentsContainer.classList.add('has-attachments');
    } else {
        attachmentsContainer.classList.remove('has-attachments');
    }
}

function clearImageAttachments() {
    imageAttachments = [];
    attachmentsContainer.innerHTML = '';
    updateAttachmentsVisibility();
}

function updateSendButtonState() {
    const hasText = msgInput.value.trim().length > 0;
    const hasImages = imageAttachments.length > 0;
    
    // GitHub Copilot behavior: need text for send (can't send image-only)
    sendBtn.disabled = !hasText;
}

function showImageTooltip(element) {
    const tooltip = element.querySelector('.image-tooltip');
    tooltip.classList.add('show');
    
    setTimeout(() => {
        tooltip.classList.remove('show');
    }, 2000);
}

function showError(message) {
    // Could integrate with VS Code notifications or show inline error
    console.error('Image Error:', message);
    // For now, just log - could enhance with UI feedback later
}

function navigateHistory(direction) {
    // Get messageHistory from the extension context via postMessage
    vscode.postMessage({
        type: 'navigateHistory',
        direction: direction
    });
}

function sendMessage() {
    const message = msgInput.value.trim();
    if (!message) return;
    
    // Prepare images for sending
    const imagesToSend = imageAttachments.map(img => ({
        data: img.data,
        type: img.type,
        name: img.name
    }));
    
    vscode.postMessage({
        type: 'sendMessage',
        message: message,
        images: imagesToSend,
        mode: currentMode,
        model: currentModel,
        currentFile: currentFileContext
    });
    
    // Clear input and attachments
    msgInput.value = '';
    msgInput.style.height = 'auto';
    clearImageAttachments();
    updateSendButtonState();
}

function addMessage(content, role, images = []) {
    // Remove empty state
    const emptyState = chatContainer.querySelector('.empty-state');
    const isFirstMessage = emptyState !== null;
    if (emptyState) emptyState.remove();
    
    // GitHub Copilot behavior: Add separator for user messages when previous message wasn't from user
    const existingMessages = chatContainer.querySelectorAll('.message');
    const lastMessage = existingMessages[existingMessages.length - 1];
    const shouldAddSeparator = role === 'user' && (!lastMessage || !lastMessage.classList.contains('user'));
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    // Add simple separator like GitHub Copilot (not "New Conversation" unless first message)
    if (shouldAddSeparator) {
        messageDiv.classList.add('conversation-starter');
        
        // Only show "New Conversation" for truly first message
        if (isFirstMessage) {
            messageDiv.classList.add('truly-new-conversation');
        }
    }
    
    const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const displayName = role === 'user' ? 'You' : 'AIDA';
    const avatar = role === 'user' ? '👤' : '🤖';
    
    // Parse markdown content
    const parsedContent = parseMarkdown(content);
    
    // Build images HTML for user messages
    let imagesHTML = '';
    if (role === 'user' && images && images.length > 0) {
        imagesHTML = '<div class="message-images">';
        images.forEach(img => {
            imagesHTML += `<img src="${img.data}" alt="${img.name || 'Image'}" class="message-image" onclick="expandImage(this)">`;
        });
        imagesHTML += '</div>';
    }
    
    messageDiv.innerHTML = `
        <div class="message-meta">
            <div class="msg-avatar">${avatar}</div>
            <span>${displayName}</span>
            <span>${timestamp}</span>
        </div>
        <div class="message-body">${parsedContent}${imagesHTML}</div>
    `;
    
    chatContainer.appendChild(messageDiv);
    
    // Convert button placeholders to actual buttons
    const messageBody = messageDiv.querySelector('.message-body');
    if (messageBody) {
        const buttonPlaceholders = messageBody.querySelectorAll('.button-placeholder');
        buttonPlaceholders.forEach(placeholder => {
            const title = placeholder.getAttribute('data-title');
            const command = placeholder.getAttribute('data-command');
            const args = placeholder.getAttribute('data-args');
            const tooltip = placeholder.getAttribute('data-tooltip');
            
            const button = document.createElement('button');
            button.className = 'file-diff-btn';
            button.textContent = title;
            button.title = tooltip;
            button.onclick = function() {
                try {
                    const parsedArgs = JSON.parse(args);
                    openDiffView(command, JSON.stringify(parsedArgs));
                } catch (e) {
                    console.error('Failed to parse button args:', e);
                }
            };
            
            placeholder.parentNode.replaceChild(button, placeholder);
        });
    }
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showTyping() {
    // Remove any existing typing message
    const existingTyping = chatContainer.querySelector('.typing-message');
    if (existingTyping) {
        existingTyping.remove();
    }
    
    // Remove empty state if exists
    const emptyState = chatContainer.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    // Create temporary typing message like GitHub Copilot
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant typing-message';
    
    const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    typingDiv.innerHTML = 
        '<div class="message-meta">' +
            '<div class="msg-avatar">🤖</div>' +
            '<span>AIDA</span>' +
            '<span>' + timestamp + '</span>' +
        '</div>' +
        '<div class="message-body">' +
            '<div class="inline-typing">' +
                '<span>AIDA is thinking</span>' +
                '<div class="typing-dots">' +
                    '<div class="typing-dot"></div>' +
                    '<div class="typing-dot"></div>' +
                    '<div class="typing-dot"></div>' +
                '</div>' +
            '</div>' +
        '</div>';
    
    chatContainer.appendChild(typingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showTypingWithMessage(message) {
    // Remove any existing typing message
    const existingTyping = chatContainer.querySelector('.typing-message');
    if (existingTyping) {
        existingTyping.remove();
    }
    
    // Remove empty state if exists
    const emptyState = chatContainer.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    // Create temporary typing message with custom message
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant typing-message';
    
    const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    typingDiv.innerHTML = 
        '<div class="message-meta">' +
            '<div class="msg-avatar">🤖</div>' +
            '<span>AIDA Agent</span>' +
            '<span>' + timestamp + '</span>' +
        '</div>' +
        '<div class="message-body">' +
            '<div class="inline-typing">' +
                '<span>' + message + '</span>' +
                '<div class="typing-dots">' +
                    '<div class="typing-dot"></div>' +
                    '<div class="typing-dot"></div>' +
                    '<div class="typing-dot"></div>' +
                '</div>' +
            '</div>' +
        '</div>';
    
    chatContainer.appendChild(typingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function hideTyping() {
    // Remove typing message instead of hiding indicator
    const typingMessage = chatContainer.querySelector('.typing-message');
    if (typingMessage) {
        typingMessage.remove();
    }
}

function parseMarkdown(text) {
    try {
        // Configure marked for GitHub Copilot style with highlight.js
        if (typeof marked !== 'undefined' && typeof hljs !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: false,
                mangle: false,
                sanitize: false,  // Allow HTML for buttons
                pedantic: false,
                highlight: function(code, lang) {
                    if (lang && hljs.getLanguage(lang)) {
                        try {
                            return hljs.highlight(code, { language: lang }).value;
                        } catch (err) {
                            console.warn('Highlight.js error:', err);
                        }
                    }
                    return hljs.highlightAuto(code).value;
                }
            });
            
            const html = marked.parse(text);
            
            // Apply syntax highlighting to any remaining code blocks
            setTimeout(() => {
                document.querySelectorAll('pre code:not(.hljs)').forEach((block) => {
                    hljs.highlightElement(block);
                });
            }, 100);
            
            return html;
        } else if (typeof marked !== 'undefined') {
            // Fallback without highlight.js
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: false,
                mangle: false,
                sanitize: false,
                pedantic: false
            });
            return marked.parse(text);
        } else {
            // Fallback to simple parsing with HTML support
            text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
            text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
            text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            text = text.replace(/\n/g, '<br>');
            return text;
        }
    } catch (error) {
        console.error('Markdown parsing error:', error);
        return text.replace(/\n/g, '<br>');
    }
}

// Streaming message handling
let currentStreamingMessage = null;

function startStreamingMessage() {
    // Remove empty state
    const emptyState = chatContainer.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    // Create streaming message container
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant streaming-message';
    
    const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    messageDiv.innerHTML = 
        '<div class="message-meta">' +
            '<div class="msg-avatar">🤖</div>' +
            '<span>AIDA</span>' +
            '<span>' + timestamp + '</span>' +
        '</div>' +
        '<div class="message-body">' +
            '<div class="streaming-content"></div>' +
        '</div>';
    
    chatContainer.appendChild(messageDiv);
    currentStreamingMessage = messageDiv;
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    console.log('✅ Started streaming message');
}

function appendStreamingChunk(chunk) {
    if (!currentStreamingMessage) {
        console.warn('⚠️ No streaming message active, starting new one');
        startStreamingMessage();
    }
    
    const contentDiv = currentStreamingMessage.querySelector('.streaming-content');
    if (contentDiv) {
        // Append chunk and parse as markdown
        const currentContent = contentDiv.getAttribute('data-raw-content') || '';
        const newContent = currentContent + chunk;
        
        // Store raw content for parsing
        contentDiv.setAttribute('data-raw-content', newContent);
        
        // Parse and update display
        contentDiv.innerHTML = parseMarkdown(newContent);
        
        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

function endStreamingMessage() {
    if (currentStreamingMessage) {
        // Remove streaming class
        currentStreamingMessage.classList.remove('streaming-message');
        
        // Convert streaming content to final message body
        const streamingContent = currentStreamingMessage.querySelector('.streaming-content');
        const messageBody = currentStreamingMessage.querySelector('.message-body');
        
        if (streamingContent && messageBody) {
            const finalContent = streamingContent.getAttribute('data-raw-content') || '';
            messageBody.innerHTML = parseMarkdown(finalContent);
        }
        
        currentStreamingMessage = null;
        console.log('✅ Ended streaming message');
    }
}

// Handle messages from extension
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.type) {
        case 'addUserMessage':
            addMessage(message.message, 'user', message.images);
            break;
            
        case 'addAssistantMessage':
            hideTyping();
            addMessage(message.message, 'assistant');
            break;
            
        case 'startStreamingMessage':
            hideTyping();
            startStreamingMessage();
            break;
            
        case 'addStreamingChunk':
            appendStreamingChunk(message.chunk);
            break;
            
        case 'endStreamingMessage':
            endStreamingMessage();
            break;
            
        case 'showTyping':
            showTyping();
            break;
            
        case 'showTypingWithMessage':
            showTypingWithMessage(message.message);
            break;
            
        case 'showError':
            hideTyping();
            addMessage(`❌ ${message.error}`, 'assistant');
            break;
            
        case 'clearChat':
            chatContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🤖</div>
                    <h3>Hi! I'm AIDA</h3>
                    <p>I can help you review code, analyze changes, and more!</p>
                </div>
            `;
            break;
            
        case 'syncInfo':
            hideTyping();
            addMessage(message.syncResult, 'assistant');
            break;
            
        case 'updateCurrentFile':
            updateCurrentFileDisplay(message.fileName, message.fullPath);
            break;
            
        case 'setInputValue':
            msgInput.value = message.value;
            msgInput.focus();
            // Auto-resize input
            msgInput.style.height = 'auto';
            const newHeight = Math.max(Math.min(msgInput.scrollHeight, 120), 36); // Min 36px, max 120px
            msgInput.style.height = newHeight + 'px';
            // Position cursor at end
            msgInput.setSelectionRange(msgInput.value.length, msgInput.value.length);
            // Update send button state
            updateSendButtonState();
            break;
    }
});

// Focus input on load
msgInput.focus();

// Initialize send button state
updateSendButtonState();

// Image expand function
window.expandImage = function(img) {
    // Simple image expansion - could enhance with modal
    const newWindow = window.open('', '_blank');
    newWindow.document.write(`
        <html>
            <head><title>Image Preview</title></head>
            <body style="margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #000;">
                <img src="${img.src}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
            </body>
        </html>
    `);
};

// Handle file diff button clicks
window.openDiffView = function(command, argsJson) {
    let args = [];
    try {
        args = argsJson ? JSON.parse(argsJson) : [];
    } catch (e) {
        args = [];
    }
    vscode.postMessage({
        type: 'runDiffCommand',
        command,
        arguments: args
    });
};