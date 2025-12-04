// Simple test to verify extension loading
// Run this in VS Code terminal: node test-extension-load.js

console.log('🔍 Testing AIDA Extension Dependencies...\n');

// Test 1: Check if files exist
const fs = require('fs');
const path = require('path');

const requiredFiles = [
    './dependency.js',
    './dependency-graph/index.js',
    './dependency-graph/file-analyzer.js',
    './dependency-graph/graph-builder.js',
    './dependency-graph/circular-detector.js',
    './dependency-graph/metrics-calculator.js',
    './dependency-graph/report-generator.js',
    '../icons/dependency-icon.svg'
];

console.log('📂 Checking required files...');
let allFilesExist = true;

requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} - MISSING!`);
        allFilesExist = false;
    }
});

if (!allFilesExist) {
    console.log('\n❌ Some required files are missing!');
    process.exit(1);
}

// Test 2: Check syntax
console.log('\n🔍 Checking JavaScript syntax...');

const filesToCheck = [
    './dependency-graph/index.js',
    './dependency-graph/file-analyzer.js',
    './dependency-graph/graph-builder.js',
    './dependency-graph/circular-detector.js',
    './dependency-graph/metrics-calculator.js',
    './dependency-graph/report-generator.js'
];

let syntaxOK = true;

filesToCheck.forEach(file => {
    try {
        require(file);
        console.log(`✅ ${file} - syntax OK`);
    } catch (error) {
        console.log(`❌ ${file} - syntax error: ${error.message}`);
        syntaxOK = false;
    }
});

if (syntaxOK) {
    console.log('\n✅ All dependency files are ready!');
    console.log('\n🚀 Next steps:');
    console.log('1. Restart VS Code (or Developer: Reload Window)');
    console.log('2. Open VS Code Chat (Ctrl+Shift+I)');
    console.log('3. Look for @dependency in participant list');
    console.log('4. Try: @dependency health');
} else {
    console.log('\n❌ Fix syntax errors before testing!');
}

console.log('\n💡 If @dependency still not visible:');
console.log('- Check VS Code Developer Console (Help → Toggle Developer Tools)');
console.log('- Look for extension loading errors');
console.log('- Make sure GitHub Copilot Chat is enabled');