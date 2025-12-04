const fs = require('fs');
const path = require('path');
const FileAnalyzer = require('./file-analyzer');
const GraphBuilder = require('./graph-builder');
const CircularDetector = require('./circular-detector');
const MetricsCalculator = require('./metrics-calculator');
const ReportGenerator = require('./report-generator');

/**
 * Main dependency analyzer class
 * Orchestrates the entire dependency analysis process
 */
class DependencyAnalyzer {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.fileAnalyzer = new FileAnalyzer(projectRoot);
        this.graphBuilder = new GraphBuilder();
        this.circularDetector = new CircularDetector();
        this.metricsCalculator = new MetricsCalculator();
        this.reportGenerator = new ReportGenerator();
        
        // Cache for performance
        this.cache = new Map();
        this.lastAnalysisTime = null;
    }

    /**
     * Main analysis method
     * @returns {Object} - Complete dependency graph
     */
    analyze() {
        try {
            console.log('🔍 Starting dependency analysis...');
            
            // Step 1: Scan and parse all files
            console.log('📂 Scanning project files...');
            const files = this.fileAnalyzer.scanFiles();
            
            console.log(`📄 Found ${files.length} files to analyze`);
            
            // Step 2: Parse files and extract dependencies
            console.log('🔍 Parsing dependencies...');
            const parsedFiles = this.fileAnalyzer.parseFiles(files);
            
            // Step 3: Build dependency graph
            console.log('🕸️ Building dependency graph...');
            const graph = this.graphBuilder.buildGraph(parsedFiles);
            
            // Step 4: Add metadata and metrics
            console.log('📊 Calculating metrics...');
            this.enhanceGraphWithMetrics(graph);
            
            // Cache results
            this.cache.set('lastGraph', graph);
            this.lastAnalysisTime = new Date();
            
            console.log('✅ Analysis complete!');
            return graph;
            
        } catch (error) {
            console.error('❌ Analysis failed:', error);
            throw new Error(`Dependency analysis failed: ${error.message}`);
        }
    }

    /**
     * Generate comprehensive analysis report
     * @param {Object} graph - Dependency graph
     * @returns {Object} - Analysis report
     */
    generateReport(graph) {
        try {
            console.log('📋 Generating analysis report...');
            
            // Detect circular dependencies
            const circularDependencies = this.circularDetector.detectCircularDependencies(graph);
            
            // Calculate metrics
            const metrics = this.metricsCalculator.calculateMetrics(graph);
            
            // Generate summary
            const summary = this.generateSummary(graph, circularDependencies);
            
            // Generate recommendations
            const recommendations = this.generateRecommendations(graph, metrics, circularDependencies);
            
            return {
                summary,
                metrics,
                circularDependencies,
                recommendations,
                generatedAt: new Date(),
                projectPath: this.projectRoot
            };
            
        } catch (error) {
            console.error('❌ Report generation failed:', error);
            throw new Error(`Report generation failed: ${error.message}`);
        }
    }

    /**
     * Generate project summary
     * @param {Object} graph - Dependency graph
     * @param {Array} circularDeps - Circular dependencies
     * @returns {Object} - Summary object
     */
    generateSummary(graph, circularDeps) {
        const typeDistribution = {};
        
        graph.nodes.forEach(node => {
            const ext = path.extname(node.filePath);
            const type = this.getFileType(ext, node.content);
            typeDistribution[type] = (typeDistribution[type] || 0) + 1;
        });
        
        return {
            totalFiles: graph.nodes.length,
            totalDependencies: graph.edges.length,
            circularDependencies: circularDeps.length,
            typeDistribution,
            analyzedAt: new Date(),
            projectName: path.basename(this.projectRoot)
        };
    }

    /**
     * Generate AI-powered recommendations
     * @param {Object} graph - Dependency graph
     * @param {Object} metrics - Calculated metrics
     * @param {Array} circularDeps - Circular dependencies
     * @returns {Array} - Array of recommendations
     */
    generateRecommendations(graph, metrics, circularDeps) {
        const recommendations = [];

        // Circular dependency recommendations
        if (circularDeps.length > 0) {
            recommendations.push({
                type: 'error',
                title: 'Resolve Circular Dependencies',
                description: 'Break circular dependencies to improve code maintainability and testability.',
                impact: 'high',
                effort: 'medium'
            });
        }

        // High complexity recommendations
        const highComplexityNodes = graph.nodes.filter(n => (n.complexity || 0) > 10);
        if (highComplexityNodes.length > 0) {
            recommendations.push({
                type: 'warning',
                title: 'Reduce Module Complexity',
                description: `${highComplexityNodes.length} modules have high complexity. Consider breaking them down.`,
                impact: 'medium',
                effort: 'medium'
            });
        }

        // Coupling recommendations
        if (metrics.averageInDegree > 5) {
            recommendations.push({
                type: 'warning',
                title: 'Reduce Module Coupling',
                description: 'High coupling detected. Consider using interfaces and dependency injection.',
                impact: 'medium',
                effort: 'high'
            });
        }

        // Architecture recommendations
        if (graph.nodes.length > 100 && !this.hasModularStructure(graph)) {
            recommendations.push({
                type: 'info',
                title: 'Consider Feature Modules',
                description: 'Large project would benefit from feature-based module organization.',
                impact: 'high',
                effort: 'high'
            });
        }

        return recommendations;
    }

    /**
     * Enhance graph with additional metrics
     * @param {Object} graph - Dependency graph
     */
    enhanceGraphWithMetrics(graph) {
        // Add complexity scores
        graph.nodes.forEach(node => {
            node.complexity = this.calculateNodeComplexity(node);
            node.inDegree = graph.edges.filter(e => e.target === node.id).length;
            node.outDegree = graph.edges.filter(e => e.source === node.id).length;
        });

        // Add edge weights
        graph.edges.forEach(edge => {
            edge.weight = this.calculateEdgeWeight(edge);
        });
    }

    /**
     * Calculate node complexity
     * @param {Object} node - Graph node
     * @returns {number} - Complexity score
     */
    calculateNodeComplexity(node) {
        if (!node.content) return 0;
        
        let complexity = 0;
        const content = node.content;
        
        // Count various complexity indicators
        const patterns = {
            classes: /(class|interface)\s+\w+/g,
            methods: /(function|method|\w+\s*\([^)]*\)\s*{)/g,
            conditionals: /(if|switch|while|for|catch)\s*\(/g,
            imports: /(import|require)\s+/g
        };
        
        Object.values(patterns).forEach(pattern => {
            const matches = content.match(pattern);
            complexity += matches ? matches.length : 0;
        });
        
        return complexity;
    }

    /**
     * Calculate edge weight based on dependency strength
     * @param {Object} edge - Graph edge
     * @returns {number} - Weight score
     */
    calculateEdgeWeight(edge) {
        // Default weight, can be enhanced based on dependency type
        return 1;
    }

    /**
     * Determine file type from extension and content
     * @param {string} ext - File extension
     * @param {string} content - File content
     * @returns {string} - File type
     */
    getFileType(ext, content) {
        if (ext === '.ts') {
            if (content.includes('@Component')) return 'Component';
            if (content.includes('@Injectable')) return 'Service';
            if (content.includes('@Directive')) return 'Directive';
            if (content.includes('@Pipe')) return 'Pipe';
            if (content.includes('@NgModule')) return 'Module';
            if (content.includes('interface')) return 'Interface';
            return 'TypeScript';
        }
        
        if (ext === '.js') return 'JavaScript';
        if (ext === '.html') return 'Template';
        if (ext === '.css' || ext === '.scss' || ext === '.sass') return 'Stylesheet';
        if (ext === '.json') return 'Configuration';
        
        return 'Other';
    }

    /**
     * Check if project has modular structure
     * @param {Object} graph - Dependency graph
     * @returns {boolean} - True if modular
     */
    hasModularStructure(graph) {
        const moduleFiles = graph.nodes.filter(n => 
            n.filePath.includes('module.ts') || 
            n.content?.includes('@NgModule')
        );
        
        return moduleFiles.length >= 3; // Arbitrary threshold
    }

    /**
     * Get cached analysis if available and recent
     * @returns {Object|null} - Cached graph or null
     */
    getCachedAnalysis() {
        if (this.lastAnalysisTime && 
            Date.now() - this.lastAnalysisTime.getTime() < 60000) { // 1 minute cache
            return this.cache.get('lastGraph');
        }
        return null;
    }

    /**
     * Clear analysis cache
     */
    clearCache() {
        this.cache.clear();
        this.lastAnalysisTime = null;
    }
}

module.exports = {
    DependencyAnalyzer,
    FileAnalyzer,
    GraphBuilder,
    CircularDetector,
    MetricsCalculator,
    ReportGenerator
};