// Temporary check script - delete after use
const fs = require('fs');
const c = fs.readFileSync('dist/extension.js', 'utf8');

// Find the bridge code
const bridgeIdx = c.indexOf('Object.defineProperty(e,"extensionPath"');
if (bridgeIdx === -1) {
    console.log('BRIDGE NOT FOUND');
    process.exit(1);
}

// Show 200 chars before the bridge to see if it's in an IIFE or just a function expression
const before = c.substring(Math.max(0, bridgeIdx - 200), bridgeIdx);
console.log('=== BEFORE BRIDGE (200 chars) ===');
console.log(before);
console.log('=== BRIDGE START ===');
console.log(c.substring(bridgeIdx, bridgeIdx + 100));

// Find the end of the bridge block  
const afterBridge = c.indexOf('currentPRData', bridgeIdx);
if (afterBridge !== -1) {
    const end = c.indexOf('})', afterBridge) + 2;
    console.log('\n=== AFTER BRIDGE END (50 chars) ===');
    console.log(c.substring(end, end + 50));
}
