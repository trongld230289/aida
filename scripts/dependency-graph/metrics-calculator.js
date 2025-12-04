/**
 * Metrics calculator for dependency graph analysis
 * Calculates various metrics for understanding code architecture and quality
 */
class MetricsCalculator {
    constructor() {
        this.metrics = {};
    }

    /**
     * Calculate comprehensive metrics for the dependency graph
     * @param {Object} graph - Dependency graph with nodes and edges
     * @returns {Object} - Comprehensive metrics object
     */
    calculateMetrics(graph) {
        const metrics = {
            // Basic metrics
            basic: this.calculateBasicMetrics(graph),
            
            // Complexity metrics
            complexity: this.calculateComplexityMetrics(graph),
            
            // Connectivity metrics
            connectivity: this.calculateConnectivityMetrics(graph),
            
            // Architecture metrics
            architecture: this.calculateArchitectureMetrics(graph),
            
            // Quality metrics
            quality: this.calculateQualityMetrics(graph),
            
            // Performance indicators
            performance: this.calculatePerformanceMetrics(graph),
            
            // Distribution metrics
            distribution: this.calculateDistributionMetrics(graph),
            
            // Calculated at
            calculatedAt: new Date()
        };

        // Calculate composite scores
        metrics.scores = this.calculateCompositeScores(metrics);
        
        return metrics;
    }

    /**
     * Calculate basic graph metrics
     * @param {Object} graph - Dependency graph
     * @returns {Object} - Basic metrics
     */
    calculateBasicMetrics(graph) {
        return {
            totalNodes: graph.nodes.length,
            totalEdges: graph.edges.length,
            density: this.calculateGraphDensity(graph),
            averageNodeDegree: this.calculateAverageNodeDegree(graph),
            averageInDegree: this.calculateAverageInDegree(graph),
            averageOutDegree: this.calculateAverageOutDegree(graph)
        };
    }

    /**
     * Calculate complexity metrics
     * @param {Object} graph - Dependency graph
     * @returns {Object} - Complexity metrics
     */
    calculateComplexityMetrics(graph) {
        const complexities = graph.nodes.map(node => node.complexity || 0);
        const nodeSizes = graph.nodes.map(node => node.size || 0);
        
        return {
            averageComplexity: this.calculateAverage(complexities),
            maxComplexity: Math.max(...complexities),
            minComplexity: Math.min(...complexities),
            complexityStandardDeviation: this.calculateStandardDeviation(complexities),
            
            averageFileSize: this.calculateAverage(nodeSizes),
            maxFileSize: Math.max(...nodeSizes),
            totalLinesOfCode: nodeSizes.reduce((sum, size) => sum + size, 0),
            
            highComplexityNodes: graph.nodes.filter(n => (n.complexity || 0) > 10).length,
            mediumComplexityNodes: graph.nodes.filter(n => {
                const c = n.complexity || 0;
                return c >= 5 && c <= 10;
            }).length,
            lowComplexityNodes: graph.nodes.filter(n => (n.complexity || 0) < 5).length
        };
    }

    /**
     * Calculate connectivity metrics
     * @param {Object} graph - Dependency graph
     * @returns {Object} - Connectivity metrics
     */
    calculateConnectivityMetrics(graph) {
        const inDegrees = graph.nodes.map(node => node.inDegree || 0);
        const outDegrees = graph.nodes.map(node => node.outDegree || 0);
        
        return {
            maxInDegree: Math.max(...inDegrees),
            maxOutDegree: Math.max(...outDegrees),
            
            // Coupling metrics
            afferentCoupling: this.calculateAfferentCoupling(graph),
            efferentCoupling: this.calculateEfferentCoupling(graph),
            instability: this.calculateInstability(graph),
            
            // Connectivity patterns
            entryPoints: graph.nodes.filter(n => n.isEntryPoint).length,
            leafNodes: graph.nodes.filter(n => n.isLeaf).length,
            isolatedNodes: graph.nodes.filter(n => 
                (n.inDegree || 0) === 0 && (n.outDegree || 0) === 0
            ).length,
            
            // Hub analysis
            hubs: this.identifyHubs(graph),
            authorities: this.identifyAuthorities(graph),
            
            // Clustering
            clusteringCoefficient: this.calculateClusteringCoefficient(graph)
        };
    }

    /**
     * Calculate architecture metrics
     * @param {Object} graph - Dependency graph
     * @returns {Object} - Architecture metrics
     */
    calculateArchitectureMetrics(graph) {
        const groupDistribution = this.calculateGroupDistribution(graph);
        const categoryDistribution = this.calculateCategoryDistribution(graph);
        
        return {
            groupDistribution,
            categoryDistribution,
            
            // Layer analysis
            layers: this.calculateLayerMetrics(graph),
            
            // Modularity
            modularity: this.calculateModularity(graph),
            
            // Cross-cutting concerns
            crossGroupDependencies: this.calculateCrossGroupDependencies(graph),
            
            // Angular-specific metrics
            angular: this.calculateAngularMetrics(graph)
        };
    }

    /**
     * Calculate quality metrics
     * @param {Object} graph - Dependency graph
     * @returns {Object} - Quality metrics
     */
    calculateQualityMetrics(graph) {
        return {
            // Maintainability
            maintainabilityIndex: this.calculateMaintainabilityIndex(graph),
            
            // Testability
            testabilityScore: this.calculateTestabilityScore(graph),
            
            // Reusability
            reusabilityScore: this.calculateReusabilityScore(graph),
            
            // Stability
            stabilityMetrics: this.calculateStabilityMetrics(graph),
            
            // Code organization
            organizationScore: this.calculateOrganizationScore(graph)
        };
    }

    /**
     * Calculate performance metrics
     * @param {Object} graph - Dependency graph
     * @returns {Object} - Performance metrics
     */
    calculatePerformanceMetrics(graph) {
        return {
            // Bundle analysis
            estimatedBundleImpact: this.calculateBundleImpact(graph),
            
            // Loading dependencies
            criticalPath: this.calculateCriticalPath(graph),
            
            // Circular dependency impact
            circularDependencyImpact: this.calculateCircularImpact(graph)
        };
    }

    /**
     * Calculate distribution metrics
     * @param {Object} graph - Dependency graph
     * @returns {Object} - Distribution metrics
     */
    calculateDistributionMetrics(graph) {
        const inDegrees = graph.nodes.map(node => node.inDegree || 0);
        const outDegrees = graph.nodes.map(node => node.outDegree || 0);
        
        return {
            inDegreeDistribution: this.calculateDistribution(inDegrees),
            outDegreeDistribution: this.calculateDistribution(outDegrees),
            complexityDistribution: this.calculateDistribution(
                graph.nodes.map(n => n.complexity || 0)
            ),
            fileSizeDistribution: this.calculateDistribution(
                graph.nodes.map(n => n.size || 0)
            )
        };
    }

    /**
     * Calculate graph density
     * @param {Object} graph - Dependency graph
     * @returns {number} - Graph density (0-1)
     */
    calculateGraphDensity(graph) {
        const n = graph.nodes.length;
        if (n <= 1) return 0;
        
        const maxPossibleEdges = n * (n - 1); // Directed graph
        return graph.edges.length / maxPossibleEdges;
    }

    /**
     * Calculate average node degree
     * @param {Object} graph - Dependency graph
     * @returns {number} - Average node degree
     */
    calculateAverageNodeDegree(graph) {
        if (graph.nodes.length === 0) return 0;
        
        const totalDegree = graph.nodes.reduce((sum, node) => 
            sum + (node.inDegree || 0) + (node.outDegree || 0), 0);
        
        return totalDegree / graph.nodes.length;
    }

    /**
     * Calculate average in-degree
     * @param {Object} graph - Dependency graph
     * @returns {number} - Average in-degree
     */
    calculateAverageInDegree(graph) {
        if (graph.nodes.length === 0) return 0;
        
        const totalInDegree = graph.nodes.reduce((sum, node) => 
            sum + (node.inDegree || 0), 0);
        
        return totalInDegree / graph.nodes.length;
    }

    /**
     * Calculate average out-degree
     * @param {Object} graph - Dependency graph
     * @returns {number} - Average out-degree
     */
    calculateAverageOutDegree(graph) {
        if (graph.nodes.length === 0) return 0;
        
        const totalOutDegree = graph.nodes.reduce((sum, node) => 
            sum + (node.outDegree || 0), 0);
        
        return totalOutDegree / graph.nodes.length;
    }

    /**
     * Calculate afferent coupling (incoming dependencies)
     * @param {Object} graph - Dependency graph
     * @returns {number} - Average afferent coupling
     */
    calculateAfferentCoupling(graph) {
        return this.calculateAverageInDegree(graph);
    }

    /**
     * Calculate efferent coupling (outgoing dependencies)
     * @param {Object} graph - Dependency graph
     * @returns {number} - Average efferent coupling
     */
    calculateEfferentCoupling(graph) {
        return this.calculateAverageOutDegree(graph);
    }

    /**
     * Calculate instability metric
     * @param {Object} graph - Dependency graph
     * @returns {number} - Instability score (0-1)
     */
    calculateInstability(graph) {
        const afferent = this.calculateAfferentCoupling(graph);
        const efferent = this.calculateEfferentCoupling(graph);
        
        if (afferent + efferent === 0) return 0;
        return efferent / (afferent + efferent);
    }

    /**
     * Identify hub nodes (high out-degree)
     * @param {Object} graph - Dependency graph
     * @returns {Array} - Hub nodes
     */
    identifyHubs(graph) {
        const avgOutDegree = this.calculateAverageOutDegree(graph);
        return graph.nodes
            .filter(node => (node.outDegree || 0) > avgOutDegree * 2)
            .sort((a, b) => (b.outDegree || 0) - (a.outDegree || 0))
            .slice(0, 5);
    }

    /**
     * Identify authority nodes (high in-degree)
     * @param {Object} graph - Dependency graph
     * @returns {Array} - Authority nodes
     */
    identifyAuthorities(graph) {
        const avgInDegree = this.calculateAverageInDegree(graph);
        return graph.nodes
            .filter(node => (node.inDegree || 0) > avgInDegree * 2)
            .sort((a, b) => (b.inDegree || 0) - (a.inDegree || 0))
            .slice(0, 5);
    }

    /**
     * Calculate clustering coefficient
     * @param {Object} graph - Dependency graph
     * @returns {number} - Clustering coefficient
     */
    calculateClusteringCoefficient(graph) {
        // Simplified clustering coefficient for directed graphs
        let totalCoefficient = 0;
        let validNodes = 0;

        graph.nodes.forEach(node => {
            const neighbors = this.getNodeNeighbors(node, graph);
            if (neighbors.length < 2) return;

            let connections = 0;
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    if (this.hasEdge(neighbors[i], neighbors[j], graph)) {
                        connections++;
                    }
                }
            }

            const maxConnections = (neighbors.length * (neighbors.length - 1)) / 2;
            totalCoefficient += connections / maxConnections;
            validNodes++;
        });

        return validNodes > 0 ? totalCoefficient / validNodes : 0;
    }

    /**
     * Calculate group distribution
     * @param {Object} graph - Dependency graph
     * @returns {Object} - Group distribution
     */
    calculateGroupDistribution(graph) {
        const distribution = {};
        graph.nodes.forEach(node => {
            const group = node.group || 'unknown';
            distribution[group] = (distribution[group] || 0) + 1;
        });
        return distribution;
    }

    /**
     * Calculate category distribution
     * @param {Object} graph - Dependency graph
     * @returns {Object} - Category distribution
     */
    calculateCategoryDistribution(graph) {
        const distribution = {};
        graph.nodes.forEach(node => {
            const category = node.category || 'unknown';
            distribution[category] = (distribution[category] || 0) + 1;
        });
        return distribution;
    }

    /**
     * Calculate layer metrics
     * @param {Object} graph - Dependency graph
     * @returns {Object} - Layer metrics
     */
    calculateLayerMetrics(graph) {
        const layers = {};
        graph.nodes.forEach(node => {
            const level = node.level || 0;
            if (!layers[level]) {
                layers[level] = { count: 0, nodes: [] };
            }
            layers[level].count++;
            layers[level].nodes.push(node.id);
        });

        return {
            totalLayers: Object.keys(layers).length,
            layers,
            maxLayerSize: Math.max(...Object.values(layers).map(l => l.count)),
            averageLayerSize: this.calculateAverage(Object.values(layers).map(l => l.count))
        };
    }

    /**
     * Calculate modularity
     * @param {Object} graph - Dependency graph
     * @returns {number} - Modularity score
     */
    calculateModularity(graph) {
        // Simplified modularity based on groups
        const groups = new Set(graph.nodes.map(n => n.group));
        let intraGroupEdges = 0;
        let totalEdges = graph.edges.length;

        if (totalEdges === 0) return 0;

        const nodeGroups = new Map(graph.nodes.map(n => [n.id, n.group]));

        graph.edges.forEach(edge => {
            const sourceGroup = nodeGroups.get(edge.source);
            const targetGroup = nodeGroups.get(edge.target);
            if (sourceGroup === targetGroup) {
                intraGroupEdges++;
            }
        });

        return intraGroupEdges / totalEdges;
    }

    /**
     * Calculate cross-group dependencies
     * @param {Object} graph - Dependency graph
     * @returns {number} - Cross-group dependency count
     */
    calculateCrossGroupDependencies(graph) {
        const nodeGroups = new Map(graph.nodes.map(n => [n.id, n.group]));
        let crossGroupEdges = 0;

        graph.edges.forEach(edge => {
            const sourceGroup = nodeGroups.get(edge.source);
            const targetGroup = nodeGroups.get(edge.target);
            if (sourceGroup !== targetGroup) {
                crossGroupEdges++;
            }
        });

        return crossGroupEdges;
    }

    /**
     * Calculate Angular-specific metrics
     * @param {Object} graph - Dependency graph
     * @returns {Object} - Angular metrics
     */
    calculateAngularMetrics(graph) {
        const angularNodes = {
            components: graph.nodes.filter(n => n.metadata?.isComponent).length,
            services: graph.nodes.filter(n => n.metadata?.isService).length,
            modules: graph.nodes.filter(n => n.metadata?.isModule).length,
            directives: graph.nodes.filter(n => n.metadata?.isDirective).length,
            pipes: graph.nodes.filter(n => n.metadata?.isPipe).length
        };

        return {
            ...angularNodes,
            componentToServiceRatio: angularNodes.services > 0 ? 
                angularNodes.components / angularNodes.services : angularNodes.components,
            averageModuleSize: angularNodes.modules > 0 ? 
                graph.nodes.length / angularNodes.modules : 0
        };
    }

    /**
     * Calculate maintainability index
     * @param {Object} graph - Dependency graph
     * @returns {number} - Maintainability index (0-100)
     */
    calculateMaintainabilityIndex(graph) {
        const avgComplexity = this.calculateComplexityMetrics(graph).averageComplexity;
        const coupling = this.calculateConnectivityMetrics(graph).maxInDegree;
        const linesOfCode = this.calculateComplexityMetrics(graph).totalLinesOfCode;
        
        // Simplified maintainability calculation
        let mi = 171 - 5.2 * Math.log(linesOfCode || 1) - 0.23 * avgComplexity - 16.2 * Math.log(coupling || 1);
        return Math.max(0, Math.min(100, mi));
    }

    /**
     * Calculate testability score
     * @param {Object} graph - Dependency graph
     * @returns {number} - Testability score (0-100)
     */
    calculateTestabilityScore(graph) {
        let score = 100;
        
        // Penalize high coupling
        const avgInDegree = this.calculateAverageInDegree(graph);
        score -= avgInDegree * 5;
        
        // Penalize complexity
        const avgComplexity = this.calculateComplexityMetrics(graph).averageComplexity;
        score -= avgComplexity * 2;
        
        // Bonus for service-oriented architecture
        const serviceRatio = graph.nodes.filter(n => n.metadata?.isService).length / graph.nodes.length;
        score += serviceRatio * 10;
        
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calculate reusability score
     * @param {Object} graph - Dependency graph
     * @returns {number} - Reusability score (0-100)
     */
    calculateReusabilityScore(graph) {
        let score = 50; // Base score
        
        // Higher score for shared modules
        const sharedNodes = graph.nodes.filter(n => n.group === 'shared' || n.group === 'core').length;
        score += (sharedNodes / graph.nodes.length) * 30;
        
        // Higher score for services
        const serviceNodes = graph.nodes.filter(n => n.metadata?.isService).length;
        score += (serviceNodes / graph.nodes.length) * 20;
        
        // Penalize tight coupling
        const avgOutDegree = this.calculateAverageOutDegree(graph);
        score -= avgOutDegree * 2;
        
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calculate stability metrics
     * @param {Object} graph - Dependency graph
     * @returns {Object} - Stability metrics
     */
    calculateStabilityMetrics(graph) {
        const instability = this.calculateInstability(graph);
        const volatileNodes = graph.nodes.filter(n => 
            n.group === 'component' || n.group === 'template'
        ).length;
        
        return {
            instability,
            volatility: volatileNodes / graph.nodes.length,
            stabilityScore: (1 - instability) * 100
        };
    }

    /**
     * Calculate organization score
     * @param {Object} graph - Dependency graph
     * @returns {number} - Organization score (0-100)
     */
    calculateOrganizationScore(graph) {
        const modularity = this.calculateModularity(graph);
        const layering = this.calculateLayerMetrics(graph);
        const groupDiversity = Object.keys(this.calculateGroupDistribution(graph)).length;
        
        let score = modularity * 40; // Good modularity
        score += Math.min(layering.totalLayers * 5, 30); // Good layering
        score += Math.min(groupDiversity * 3, 30); // Good organization
        
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calculate composite scores
     * @param {Object} metrics - All calculated metrics
     * @returns {Object} - Composite scores
     */
    calculateCompositeScores(metrics) {
        return {
            overallQuality: this.calculateOverallQuality(metrics),
            architecturalHealth: this.calculateArchitecturalHealth(metrics),
            technicalDebt: this.calculateTechnicalDebt(metrics),
            riskScore: this.calculateRiskScore(metrics)
        };
    }

    /**
     * Calculate overall quality score
     * @param {Object} metrics - All metrics
     * @returns {number} - Overall quality (0-100)
     */
    calculateOverallQuality(metrics) {
        const weights = {
            maintainability: 0.3,
            testability: 0.25,
            organization: 0.25,
            reusability: 0.2
        };
        
        return (
            metrics.quality.maintainabilityIndex * weights.maintainability +
            metrics.quality.testabilityScore * weights.testability +
            metrics.quality.organizationScore * weights.organization +
            metrics.quality.reusabilityScore * weights.reusability
        );
    }

    /**
     * Calculate architectural health
     * @param {Object} metrics - All metrics
     * @returns {number} - Architectural health (0-100)
     */
    calculateArchitecturalHealth(metrics) {
        let health = 100;
        
        // Penalize high coupling
        if (metrics.basic.density > 0.3) health -= 20;
        if (metrics.connectivity.maxInDegree > 10) health -= 15;
        
        // Reward good modularity
        if (metrics.architecture.modularity > 0.7) health += 10;
        
        // Penalize cross-cutting concerns
        const crossCutting = metrics.architecture.crossGroupDependencies / metrics.basic.totalEdges;
        if (crossCutting > 0.3) health -= 15;
        
        return Math.max(0, Math.min(100, health));
    }

    /**
     * Calculate technical debt score
     * @param {Object} metrics - All metrics
     * @returns {number} - Technical debt (0-100, higher is worse)
     */
    calculateTechnicalDebt(metrics) {
        let debt = 0;
        
        // High complexity adds debt
        debt += metrics.complexity.highComplexityNodes * 5;
        
        // Poor organization adds debt
        debt += (100 - metrics.quality.organizationScore) * 0.3;
        
        // High coupling adds debt
        debt += metrics.connectivity.maxInDegree * 2;
        
        // Low testability adds debt
        debt += (100 - metrics.quality.testabilityScore) * 0.4;
        
        return Math.max(0, Math.min(100, debt));
    }

    /**
     * Calculate risk score
     * @param {Object} metrics - All metrics
     * @returns {number} - Risk score (0-100, higher is riskier)
     */
    calculateRiskScore(metrics) {
        let risk = 0;
        
        // Critical nodes increase risk
        const criticalNodes = metrics.connectivity.hubs.length + 
                             metrics.connectivity.authorities.length;
        risk += criticalNodes * 5;
        
        // High instability increases risk
        risk += metrics.connectivity.instability * 30;
        
        // Poor maintainability increases risk
        risk += (100 - metrics.quality.maintainabilityIndex) * 0.4;
        
        return Math.max(0, Math.min(100, risk));
    }

    // Utility functions
    
    /**
     * Calculate average of array
     * @param {Array} values - Array of numbers
     * @returns {number} - Average value
     */
    calculateAverage(values) {
        if (values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    /**
     * Calculate standard deviation
     * @param {Array} values - Array of numbers
     * @returns {number} - Standard deviation
     */
    calculateStandardDeviation(values) {
        if (values.length === 0) return 0;
        const avg = this.calculateAverage(values);
        const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
        return Math.sqrt(this.calculateAverage(squaredDiffs));
    }

    /**
     * Calculate distribution statistics
     * @param {Array} values - Array of numbers
     * @returns {Object} - Distribution statistics
     */
    calculateDistribution(values) {
        if (values.length === 0) return {};
        
        const sorted = [...values].sort((a, b) => a - b);
        return {
            mean: this.calculateAverage(values),
            median: this.calculateMedian(sorted),
            min: sorted[0],
            max: sorted[sorted.length - 1],
            standardDeviation: this.calculateStandardDeviation(values),
            percentile25: this.calculatePercentile(sorted, 0.25),
            percentile75: this.calculatePercentile(sorted, 0.75)
        };
    }

    /**
     * Calculate median
     * @param {Array} sortedValues - Sorted array of numbers
     * @returns {number} - Median value
     */
    calculateMedian(sortedValues) {
        const len = sortedValues.length;
        if (len === 0) return 0;
        if (len % 2 === 0) {
            return (sortedValues[len / 2 - 1] + sortedValues[len / 2]) / 2;
        }
        return sortedValues[Math.floor(len / 2)];
    }

    /**
     * Calculate percentile
     * @param {Array} sortedValues - Sorted array of numbers
     * @param {number} percentile - Percentile (0-1)
     * @returns {number} - Percentile value
     */
    calculatePercentile(sortedValues, percentile) {
        if (sortedValues.length === 0) return 0;
        const index = Math.ceil(sortedValues.length * percentile) - 1;
        return sortedValues[Math.max(0, index)];
    }

    /**
     * Get node neighbors
     * @param {Object} node - Graph node
     * @param {Object} graph - Dependency graph
     * @returns {Array} - Neighbor node IDs
     */
    getNodeNeighbors(node, graph) {
        const neighbors = new Set();
        
        graph.edges.forEach(edge => {
            if (edge.source === node.id) {
                neighbors.add(edge.target);
            }
            if (edge.target === node.id) {
                neighbors.add(edge.source);
            }
        });
        
        return Array.from(neighbors);
    }

    /**
     * Check if edge exists between two nodes
     * @param {string} nodeId1 - First node ID
     * @param {string} nodeId2 - Second node ID
     * @param {Object} graph - Dependency graph
     * @returns {boolean} - True if edge exists
     */
    hasEdge(nodeId1, nodeId2, graph) {
        return graph.edges.some(edge => 
            (edge.source === nodeId1 && edge.target === nodeId2) ||
            (edge.source === nodeId2 && edge.target === nodeId1)
        );
    }

    /**
     * Calculate bundle impact (stub implementation)
     * @param {Object} graph - Dependency graph
     * @returns {Object} - Bundle impact metrics
     */
    calculateBundleImpact(graph) {
        return {
            estimatedSize: graph.nodes.reduce((sum, n) => sum + (n.size || 0), 0),
            compressionRatio: 0.3, // Estimated
            lazyLoadingOpportunities: graph.nodes.filter(n => n.group === 'feature').length
        };
    }

    /**
     * Calculate critical path (stub implementation)
     * @param {Object} graph - Dependency graph
     * @returns {Array} - Critical path nodes
     */
    calculateCriticalPath(graph) {
        // Find longest path from entry points
        const entryPoints = graph.nodes.filter(n => n.isEntryPoint);
        if (entryPoints.length === 0) return [];
        
        // Simplified: return path with highest sum of complexities
        return entryPoints[0]?.id ? [entryPoints[0].id] : [];
    }

    /**
     * Calculate circular dependency impact (stub implementation)
     * @param {Object} graph - Dependency graph
     * @returns {number} - Impact score
     */
    calculateCircularImpact(graph) {
        // This would integrate with CircularDetector results
        return 0; // Placeholder
    }
}

module.exports = MetricsCalculator;