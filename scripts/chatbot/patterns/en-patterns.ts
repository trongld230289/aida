const CONTEXT_REQUIRED: RegExp[] = [
    /explain\s+this\s+(function|method|class|component)/i,
    /what\s+does\s+this\s+(do|function|method|return)/i,
    /fix\s+the\s+bug\s+(here|in\s+this)/i,
    /why\s+.*\s+(error|fail|not\s+work)/i,
    /review\s+this\s+(code|function|implementation)/i,
    /optimize\s+this\s+(function|method|algorithm)/i,
    /test\s+this\s+(function|method|component)/i,
    /debug\s+this\s+(issue|problem|error)/i,
    /refactor\s+this\s+(code|function|class)/i,
    /document\s+this\s+(function|method|class)/i,
    /add\s+comments?\s+to\s+this/i,
    /what's\s+wrong\s+with\s+this/i,
    /how\s+can\s+I\s+(improve|fix|optimize)\s+this/i,
    /trace\s+through\s+this/i,
];

const NO_CONTEXT: RegExp[] = [
    /how\s+to\s+(create|build|make)\s+\w+/i,
    /what\s+is\s+\w+\s*\??$/i,
    /explain\s+\w+\s+(concept|pattern|principle)/i,
    /best\s+practices?\s+for\s+\w+/i,
    /difference\s+between\s+\w+\s+and\s+\w+/i,
    /when\s+to\s+use\s+\w+/i,
    /pros\s+and\s+cons\s+of\s+\w+/i,
    /tutorial\s+for\s+\w+/i,
    /guide\s+to\s+\w+/i,
    /introduction\s+to\s+\w+/i,
];

export { CONTEXT_REQUIRED, NO_CONTEXT };
