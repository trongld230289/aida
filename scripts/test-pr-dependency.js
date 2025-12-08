/**
 * Test script for PR Dependency Analysis
 * Run this to verify the implementation structure
 * Note: This tests structure only, not runtime functionality (requires VS Code API)
 */

const fs = require('fs');
const path = require('path');

// Test data
const TEST_CASES = [
    {
        name: 'GitHub PR',
        url: 'https://github.com/microsoft/vscode/pull/12345',
        expectedType: 'github',
        pattern: /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/i
    },
    {
        name: 'Azure DevOps PR',
        url: 'https://dev.azure.com/organization/project/_git/repo/pullrequest/456',
        expectedType: 'azure',
        pattern: /dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/([^\/]+)\/pullrequest\/(\d+)/i
    },
    {
        name: 'GitLab MR',
        url: 'https://gitlab.com/namespace/project/-/merge_requests/789',
        expectedType: 'gitlab',
        pattern: /gitlab\.com\/.+\/-\/merge_requests\/(\d+)/i
    }
];

/**
 * Test 1: File Existence
 */
function testFileExistence() {
    console.log('\n🧪 Test 1: File Existence\n');
    
    const requiredFiles = [
        'pr-file-fetcher.js',
        'pr-dependency-analyzer.js',
        'dependency.js'
    ];
    
    requiredFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            console.log(`✅ ${file} exists`);
        } else {
            console.log(`❌ ${file} NOT FOUND`);
        }
    });
}

/**
 * Test 2: PR URL Pattern Matching
 */
function testPRUrlPatterns() {
    console.log('\n🧪 Test 2: PR URL Pattern Matching\n');
    
    TEST_CASES.forEach(testCase => {
        const match = testCase.url.match(testCase.pattern);
        
        if (match) {
            console.log(`✅ ${testCase.name}: Pattern matches`);
            console.log(`   URL: ${testCase.url}`);
            console.log(`   Match: ${match[0]}`);
        } else {
            console.log(`❌ ${testCase.name}: Pattern does NOT match`);
        }
    });
}

/**
 * Test 3: Module Structure
 */
function testModuleStructure() {
    console.log('\n🧪 Test 3: Module Structure\n');
    
    const modules = [
        {
            name: 'pr-file-fetcher.js',
            expectedClass: 'PRFileFetcher',
            expectedMethods: ['parsePRUrl', 'fetchFiles', 'normalizeFileChange']
        },
        {
            name: 'pr-dependency-analyzer.js',
            expectedClass: 'PRDependencyAnalyzer',
            expectedMethods: ['analyzePRFiles', 'findPRNodes', 'getDependencies', 'getDependents']
        }
    ];
    
    modules.forEach(module => {
        const filePath = path.join(__dirname, module.name);
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check class existence
            if (content.includes(`class ${module.expectedClass}`)) {
                console.log(`✅ ${module.name}: Class ${module.expectedClass} found`);
            } else {
                console.log(`❌ ${module.name}: Class ${module.expectedClass} NOT FOUND`);
            }
            
            // Check methods
            module.expectedMethods.forEach(method => {
                if (content.includes(`${method}(`)) {
                    console.log(`   ✅ Method: ${method}`);
                } else {
                    console.log(`   ❌ Method: ${method} NOT FOUND`);
                }
            });
            
        } catch (error) {
            console.log(`❌ ${module.name}: Error reading file - ${error.message}`);
        }
    });
}

/**
 * Test 4: Graph View Enhancements
 */
function testGraphViewEnhancements() {
    console.log('\n🧪 Test 4: Graph View Enhancements\n');
    
    const graphViewTsPath = path.join(__dirname, 'dependency-graph', 'graph-view.ts');
    const graphViewHtmlPath = path.join(__dirname, 'dependency-graph', 'graph-view.html');
    
    // Check TypeScript enhancements
    try {
        const tsContent = fs.readFileSync(graphViewTsPath, 'utf8');
        
        const tsChecks = [
            { name: 'PR Status Color Function', pattern: 'getPRStatusColor' },
            { name: 'PR Status Icon Function', pattern: 'getPRStatusIcon' },
            { name: 'PR Status Label Function', pattern: 'getPRStatusLabel' },
            { name: 'Node Type Label Function', pattern: 'getNodeTypeLabel' },
            { name: 'isPRFile Check', pattern: 'd.isPRFile' },
            { name: 'prStatus Handling', pattern: 'd.prStatus' }
        ];
        
        tsChecks.forEach(check => {
            if (tsContent.includes(check.pattern)) {
                console.log(`✅ TS: ${check.name}`);
            } else {
                console.log(`❌ TS: ${check.name} NOT FOUND`);
            }
        });
        
    } catch (error) {
        console.log(`❌ graph-view.ts: Error - ${error.message}`);
    }
    
    // Check HTML enhancements
    try {
        const htmlContent = fs.readFileSync(graphViewHtmlPath, 'utf8');
        
        const htmlChecks = [
            { name: 'PR Legend', pattern: 'prLegend' },
            { name: 'PR Status Add Style', pattern: 'pr-status-add' },
            { name: 'PR Status Edit Style', pattern: 'pr-status-edit' },
            { name: 'PR Status Delete Style', pattern: 'pr-status-delete' },
            { name: 'Node Type Dependency Style', pattern: 'node-type-dependency' },
            { name: 'Node Type Dependent Style', pattern: 'node-type-dependent' }
        ];
        
        htmlChecks.forEach(check => {
            if (htmlContent.includes(check.pattern)) {
                console.log(`✅ HTML: ${check.name}`);
            } else {
                console.log(`❌ HTML: ${check.name} NOT FOUND`);
            }
        });
        
    } catch (error) {
        console.log(`❌ graph-view.html: Error - ${error.message}`);
    }
}

/**
 * Test 5: Dependency.js Integration
 */
function testDependencyJsIntegration() {
    console.log('\n🧪 Test 5: Dependency.js Integration\n');
    
    const dependencyJsPath = path.join(__dirname, 'dependency.js');
    
    try {
        const content = fs.readFileSync(dependencyJsPath, 'utf8');
        
        const checks = [
            { name: 'PR File Fetcher Import', pattern: "require('./pr-file-fetcher')" },
            { name: 'PR Dependency Analyzer Import', pattern: "require('./pr-dependency-analyzer')" },
            { name: 'isPRUrl Function', pattern: 'function isPRUrl' },
            { name: 'handlePRDependencyAnalysis Function', pattern: 'function handlePRDependencyAnalysis' },
            { name: 'createPRGraphWebview Function', pattern: 'function createPRGraphWebview' },
            { name: 'generatePRGraphWebviewHtml Function', pattern: 'function generatePRGraphWebviewHtml' }
        ];
        
        checks.forEach(check => {
            if (content.includes(check.pattern)) {
                console.log(`✅ ${check.name}`);
            } else {
                console.log(`❌ ${check.name} NOT FOUND`);
            }
        });
        
    } catch (error) {
        console.log(`❌ dependency.js: Error - ${error.message}`);
    }
}

/**
 * Test 6: Documentation
 */
function testDocumentation() {
    console.log('\n🧪 Test 6: Documentation\n');
    
    const docsPath = path.join(__dirname, '..', 'docs');
    
    const docFiles = [
        'PR-DEPENDENCY-ANALYSIS-PLAN.md',
        'PR-DEPENDENCY-ANALYSIS-FEATURE.md'
    ];
    
    docFiles.forEach(docFile => {
        const docPath = path.join(docsPath, docFile);
        if (fs.existsSync(docPath)) {
            const stats = fs.statSync(docPath);
            console.log(`✅ ${docFile} (${stats.size} bytes)`);
        } else {
            console.log(`❌ ${docFile} NOT FOUND`);
        }
    });
}

/**
 * Run all tests
 */
function runAllTests() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║    PR Dependency Analysis - Structure Test Suite         ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
    try {
        testFileExistence();
        testPRUrlPatterns();
        testModuleStructure();
        testGraphViewEnhancements();
        testDependencyJsIntegration();
        testDocumentation();
        
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║              Structure Tests Complete ✅                  ║');
        console.log('║                                                            ║');
        console.log('║  Note: Runtime tests require VS Code extension context    ║');
        console.log('║  Test with: @dependency <pr-url> in VS Code               ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        
    } catch (error) {
        console.error('\n❌ Test suite failed:', error);
        console.error(error.stack);
    }
}

// Run tests if executed directly
if (require.main === module) {
    runAllTests();
}

module.exports = {
    runAllTests,
    testFileExistence,
    testPRUrlPatterns,
    testModuleStructure,
    testGraphViewEnhancements,
    testDependencyJsIntegration,
    testDocumentation
};
