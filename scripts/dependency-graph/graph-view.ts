// @ts-nocheck

// Acquire VS Code API for webview messaging
const vscode = acquireVsCodeApi();

const graphData = __GRAPH_DATA__;
const searchTerm = __SEARCH_TERM__;
const workspaceRoot = __WORKSPACE_ROOT__;

let simulation;
let svg;
let g;
let zoom;
let physicsEnabled = true;
let isHierarchyView = false;

function initializeGraph() {
  svg = d3.select('#d3-graph');
  const container = document.querySelector('.left-panel');
  const width = container.clientWidth - 40;
  const height = container.clientHeight - 140;

  svg.attr('width', width).attr('height', height);

  // Update summary statistics
  document.getElementById('edgeCount').textContent = graphData.edges.length;

  // Calculate circular dependencies (simple cycle detection)
  const circularCount = detectCircularDependencies(graphData.nodes, graphData.edges);
  document.getElementById('circularCount').textContent = circularCount;

  zoom = d3.zoom()
    .scaleExtent([0.2, 3])
    .on('zoom', function (event) {
      g.attr('transform', event.transform);
    });

  svg.call(zoom);

  svg.on('dblclick.zoom', function () {
    svg.transition().duration(750).call(
      zoom.transform,
      d3.zoomIdentity
    );
  });

  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#6A9EDB');

  g = svg.append('g');

  simulation = d3.forceSimulation(graphData.nodes)
    .force('link', d3.forceLink(graphData.edges).id(d => d.id).distance(200))
    .force('charge', d3.forceManyBody().strength(-800))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(50));

  renderGraph();
}

function renderGraph() {
  const link = g.selectAll('.link')
    .data(graphData.edges)
    .enter().append('line')
    .attr('class', 'link');

  const node = g.selectAll('.node-circle')
    .data(graphData.nodes)
    .enter().append('circle')
    .attr('r', 6)
    .attr('class', d => {
      let classes = 'node-circle';
      if (d.entityType) {
        classes += ' ' + d.entityType;
      } else {
        const fileName = (d.fileName || d.id || '').toLowerCase();
        if (fileName.includes('service')) classes += ' service';
        else if (fileName.includes('component')) classes += ' component';
        else if (fileName.includes('module')) classes += ' module';
        else if (fileName.includes('model')) classes += ' model';
      }
      return classes;
    })
    .on('click', (event, d) => {
      console.log('Clicked:', d.fileName);
      graphData.nodes.forEach(node => node.selected = false);
      d.selected = true;
      updateNodeStyles();
      showNodeDetails(d);

      // Update search input with clicked node name
      const searchInput = document.getElementById('nodeSearch');
      if (searchInput) {
        searchInput.value = d.displayName || d.fileName || d.id;
      }

      // Trigger building selected node object
      vscode.postMessage({
        command: 'buildSelectedNodeObject',
        nodeId: d.id
      });
    })
    .on('mouseenter', (event, d) => {
      const tooltip = document.getElementById('nodeTooltip');
      const entityInfo = d.displayName !== d.fileName ?
        `<strong>${d.displayName}</strong> (${d.entityType})<br><small>${d.fileName}</small>` :
        `<strong>${d.fileName}</strong><br><small>${d.relativePath}</small>`;
      tooltip.innerHTML = entityInfo;
      tooltip.style.opacity = '1';
      tooltip.style.left = event.pageX + 10 + 'px';
      tooltip.style.top = event.pageY + 10 + 'px';
    })
    .on('mouseleave', () => {
      document.getElementById('nodeTooltip').style.opacity = '0';
    })
    .call(d3.drag()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        if (!physicsEnabled) {
          d.fx = d.x;
          d.fy = d.y;
        } else {
          d.fx = null;
          d.fy = null;
        }
      }));

  const nodeText = g.selectAll('.node-text')
    .data(graphData.nodes)
    .enter().append('text')
    .attr('class', 'node-text')
    .text(d => {
      const name = d.displayName || d.fileName || 'unknown';
      return name.length > 15 ? name.substring(0, 13) + '..' : name;
    })
    .attr('dy', 20);

  node.classed('search-match', d =>
    (d.fileName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);

    nodeText
      .attr('x', d => d.x)
      .attr('y', d => d.y);
  });
}

function updateNodeStyles() {
  svg.selectAll('.node-circle')
    .style('fill', d => d.selected ? '#ff6b6b' : null)
    .style('stroke', d => d.selected ? '#fff' : null)
    .style('stroke-width', d => d.selected ? '3px' : null);
}

function showNodeDetails(node) {
  console.log('showNodeDetails called with:', node);
  const detailView = document.getElementById('detailView');

  if (!detailView) {
    console.error('Detail view element not found!');
    return;
  }

  const dependencies = graphData.edges
    .filter(edge => {
      const sourceId = edge.source.id || edge.source;
      return sourceId === node.id;
    })
    .map(edge => {
      const targetId = edge.target.id || edge.target;
      return graphData.nodes.find(n => n.id === targetId);
    })
    .filter(n => n);

  const dependents = graphData.edges
    .filter(edge => {
      const targetId = edge.target.id || edge.target;
      return targetId === node.id;
    })
    .map(edge => {
      const sourceId = edge.source.id || edge.source;
      return graphData.nodes.find(n => n.id === sourceId);
    })
    .filter(n => n);

  console.log('Dependencies found:', dependencies.length);
  console.log('Dependents found:', dependents.length);

  let dependenciesHtml = '';
  dependencies.forEach(dep => {
    dependenciesHtml += `
            <div class="dependency-item" onclick="focusOnNode('${dep.id}')">
                <strong>${dep.fileName || dep.id}</strong><br>
                <small>${dep.relativePath || 'Unknown path'}</small>
            </div>
        `;
  });

  let dependentsHtml = '';
  dependents.forEach(dep => {
    dependentsHtml += `
            <div class="dependency-item" onclick="focusOnNode('${dep.id}')">
                <strong>${dep.fileName || dep.id}</strong><br>
                <small>${dep.relativePath || 'Unknown path'}</small>
            </div>
        `;
  });

  const html = `
        <div class="module-title">${node.fileName || node.id}</div>
        <div class="detail-section">
            <h4>📂 File Path</h4>
            <div>${node.relativePath || 'Unknown path'}</div>
        </div>
        
        <div class="detail-section">
            <h4>📥 Dependencies (${dependencies.length}) - What this module needs</h4>
            <div style="max-height: 250px; overflow-y: auto;">
                ${dependenciesHtml || '<p>No dependencies found</p>'}
            </div>
        </div>
        
        <div class="detail-section">
            <h4>📤 Dependents (${dependents.length}) - What needs this module</h4>
            <div style="max-height: 250px; overflow-y: auto;">
                ${dependentsHtml || '<p>No dependents found</p>'}
            </div>
        </div>
        
        <div class="detail-section">
            <button class="ai-analyst-btn" onclick="analyzeWithAI('${node.id}')">
                🤖 AI Impact Analysis
            </button>
            <div id="ai-analysis-${node.id}" class="ai-analysis-result"></div>
        </div>
    `;

  console.log('Setting detail view HTML');
  detailView.innerHTML = html;
}

function focusOnNode(nodeId) {
  const node = graphData.nodes.find(n => n.id === nodeId);
  if (node) {
    graphData.nodes.forEach(n => n.selected = false);
    node.selected = true;
    updateNodeStyles();
    showNodeDetails(node);

    // Update search input with clicked node name
    const searchInput = document.getElementById('nodeSearch');
    if (searchInput) {
      searchInput.value = node.displayName || node.fileName || node.id;
    }

    if (node.x && node.y) {
      const container = document.querySelector('.left-panel');
      const width = container.clientWidth - 40;
      const height = container.clientHeight - 140;

      const transform = d3.zoomIdentity
        .translate(width / 2 - node.x, height / 2 - node.y)
        .scale(1.5);
      svg.transition().duration(750).call(
        zoom.transform,
        transform
      );
    }
  }
}

function populateAutocomplete() {
  const suggestionsContainer = document.getElementById('searchSuggestions');
  const searchInput = document.getElementById('nodeSearch');

  if (!suggestionsContainer || !searchInput) return;

  let selectedIndex = -1;
  let filteredNodes = [];

  function showSuggestions(filter = '') {
    filteredNodes = graphData.nodes.filter(node => {
      const fileName = (node.fileName || node.id).toLowerCase();
      const displayName = (node.displayName || '').toLowerCase();
      const searchTermValue = filter.toLowerCase();
      return fileName.includes(searchTermValue) || displayName.includes(searchTermValue);
    }).slice(0, 8);

    suggestionsContainer.innerHTML = '';

    if (filteredNodes.length > 0 && filter) {
      filteredNodes.forEach((node, index) => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        const displayText = node.displayName !== node.fileName ?
          node.displayName + ' (' + node.entityType + ')' :
          node.fileName || node.id;
        div.textContent = displayText;
        div.addEventListener('click', () => {
          searchInput.value = node.displayName || node.fileName || node.id;
          hideSuggestions();
          searchAndFocus();
        });
        suggestionsContainer.appendChild(div);
      });
      suggestionsContainer.style.display = 'block';
    } else {
      hideSuggestions();
    }
  }

  function hideSuggestions() {
    suggestionsContainer.style.display = 'none';
    selectedIndex = -1;
  }

  function updateSelection() {
    const items = suggestionsContainer.querySelectorAll('.suggestion-item');
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === selectedIndex);
    });
  }

  searchInput.addEventListener('input', (e) => {
    showSuggestions(e.target.value);
    selectedIndex = -1;
  });

  searchInput.addEventListener('focus', (e) => {
    if (e.target.value) {
      showSuggestions(e.target.value);
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      hideSuggestions();
    }
  });

  searchInput.addEventListener('keydown', (e) => {
    const items = suggestionsContainer.querySelectorAll('.suggestion-item');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && items[selectedIndex]) {
        searchInput.value = items[selectedIndex].textContent;
        hideSuggestions();
        searchAndFocus();
      } else {
        searchAndFocus();
      }
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  });
}

function setupSearchInput() {
}

function searchAndFocus() {
  const searchValue = document.getElementById('nodeSearch').value.trim();
  if (!searchValue) return;

  const matchingNode = graphData.nodes.find(node => {
    const fileName = node.fileName || node.id;
    const displayName = node.displayName || '';
    const searchTermLower = searchValue.toLowerCase();
    return fileName.toLowerCase().includes(searchTermLower) ||
      displayName.toLowerCase().includes(searchTermLower);
  });

  if (matchingNode) {
    graphData.nodes.forEach(n => n.selected = false);
    matchingNode.selected = true;
    updateNodeStyles();
    showNodeDetails(matchingNode);

    if (matchingNode.x && matchingNode.y) {
      const container = document.querySelector('.left-panel');
      const width = container.clientWidth - 40;
      const height = container.clientHeight - 140;

      const transform = d3.zoomIdentity
        .translate(width / 2 - matchingNode.x, height / 2 - matchingNode.y)
        .scale(1.5);
      svg.transition().duration(750).call(
        zoom.transform,
        transform
      );
    }
  } else {
    alert('Module not found: ' + searchValue);
  }
}

function zoomIn() {
  svg.transition().duration(300).call(
    zoom.scaleBy, 1.5
  );
}

function zoomOut() {
  svg.transition().duration(300).call(
    zoom.scaleBy, 1 / 1.5
  );
}

function resetZoom() {
  svg.transition().duration(500).call(
    zoom.transform,
    d3.zoomIdentity
  );
}

function switchToHierarchyView() {
  simulation.stop();
  const layers = calculateLayers(graphData.nodes, graphData.edges);

  const layerHeight = height / (layers.length + 1);
  layers.forEach((layer, layerIndex) => {
    const layerWidth = width / (layer.length + 1);
    layer.forEach((node, nodeIndex) => {
      node.fx = (nodeIndex + 1) * layerWidth;
      node.fy = (layerIndex + 1) * layerHeight;
    });
  });

  ticked();

  node.attr('r', d => d.layer === 0 ? 12 : Math.max(6, 10 - d.layer * 1.5))
    .style('fill', d => getLayerColor(d.layer));

  console.log('Switched to hierarchy view with', layers.length, 'layers');
}

function switchToGraphView() {
  graphData.nodes.forEach(d => {
    d.fx = null;
    d.fy = null;
  });

  simulation.alpha(0.3).restart();

  node.attr('r', d => Math.min(8, Math.max(4, Math.log(getNodeConnections(d) + 1) * 2)))
    .style('fill', '#007ACC');

  console.log('Switched to graph view');
}

function calculateLayers(nodes, edges) {
  const layers = [];
  const visited = new Set();
  const nodeToLayer = new Map();

  const searchMatchIds = new Set(nodes.filter(n =>
    (n.fileName || '').toLowerCase().includes('service')
  ).map(n => n.id));

  const rootNodes = nodes.filter(node => {
    const hasIncomingFromSearchMatch = edges.some(e =>
      e.target === node.id && searchMatchIds.has(e.source)
    );
    return searchMatchIds.has(node.id) || !hasIncomingFromSearchMatch;
  });

  if (rootNodes.length > 0) {
    layers.push(rootNodes.slice(0, 8));
    rootNodes.slice(0, 8).forEach(node => {
      visited.add(node.id);
      nodeToLayer.set(node.id, 0);
      node.layer = 0;
    });
  }

  for (let layer = 0; layer < 4; layer++) {
    const currentLayer = layers[layer] || [];
    const nextLayer = [];

    currentLayer.forEach(node => {
      edges.forEach(edge => {
        if (edge.source === node.id && !visited.has(edge.target)) {
          const targetNode = nodes.find(n => n.id === edge.target);
          if (targetNode && nextLayer.length < 10) {
            nextLayer.push(targetNode);
            visited.add(edge.target);
            nodeToLayer.set(edge.target, layer + 1);
            targetNode.layer = layer + 1;
          }
        }
      });
    });

    if (nextLayer.length > 0) {
      layers.push(nextLayer);
    } else {
      break;
    }
  }

  return layers;
}

function exportGraph() {
  const svgData = new XMLSerializer().serializeToString(document.getElementById('d3-graph'));
  const blob = new Blob([svgData], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dependency-graph-${searchTerm}.svg`;
  a.click();
}

let isResizing = false;
const resizer = document.getElementById('resizer');
const leftPanel = document.querySelector('.left-panel');
const rightPanel = document.querySelector('.right-panel');

resizer.addEventListener('mousedown', (e) => {
  isResizing = true;
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
});

function handleResize(e) {
  if (!isResizing) return;

  const containerRect = document.querySelector('.main-container').getBoundingClientRect();
  const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

  const constrainedWidth = Math.min(Math.max(newLeftWidth, 20), 80);

  leftPanel.style.width = constrainedWidth + '%';

  if (window.resizeGraph) {
    setTimeout(() => window.resizeGraph(), 10);
  }
}

function stopResize() {
  isResizing = false;
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

window.resizeGraph = function () {
  const container = document.querySelector('.left-panel');
  const newWidth = container.clientWidth - 40;
  const newHeight = container.clientHeight - 140;

  svg.attr('width', newWidth).attr('height', newHeight);
  simulation.force('center', d3.forceCenter(newWidth / 2, newHeight / 2));
  simulation.alpha(0.3).restart();
};

window.addEventListener('resize', () => {
  setTimeout(window.resizeGraph, 100);
});

window.addEventListener('load', function () {
  initializeGraph();
  populateAutocomplete();
  setupSearchInput();
});

function analyzeWithAI(nodeId) {
  console.log('🤖 AI Analysis clicked for nodeId:', nodeId);

  const resultDiv = document.getElementById('ai-analysis-' + nodeId);
  if (!resultDiv) {
    console.error('❌ Result div not found');
    return;
  }

  // Show loading state
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<div class="ai-analysis-loading">🤖 Analyzing impact... Please wait</div>';

  // Trigger building selected node object and send to AI
  vscode.postMessage({
    command: 'buildSelectedNodeObject',
    nodeId: nodeId
  });
}

// Listen for AI analysis response from extension
window.addEventListener('message', event => {
  const message = event.data;

  if (message.command === 'aiAnalysisComplete') {
    const resultDiv = document.getElementById('ai-analysis-' + message.nodeId);
    if (resultDiv) {
      resultDiv.innerHTML = `
        <div class="ai-analysis-content">
          <h4>📊 Impact Analysis Results</h4>
          <div class="ai-response">${formatMarkdown(message.analysis)}</div>
        </div>
      `;
    }
  } else if (message.command === 'aiAnalysisError') {
    const resultDiv = document.getElementById('ai-analysis-' + message.nodeId);
    if (resultDiv) {
      resultDiv.innerHTML = `
        <div class="ai-analysis-error">
          ❌ Error: ${message.error}
        </div>
      `;
    }
  }
});

// Simple markdown formatter
function formatMarkdown(text) {
  return text
    .replace(/^### (.*$)/gim, '<h5>$1</h5>')
    .replace(/^## (.*$)/gim, '<h4>$1</h4>')
    .replace(/^# (.*$)/gim, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hl]|<li)/gim, '<p>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
}

// Detect circular dependencies using DFS
function detectCircularDependencies(nodes, edges) {
  const visited = new Set();
  const recursionStack = new Set();
  let circularCount = 0;

  function hasCycle(nodeId) {
    if (recursionStack.has(nodeId)) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const outgoingEdges = edges.filter(e => (e.source.id || e.source) === nodeId);
    for (const edge of outgoingEdges) {
      const targetId = edge.target.id || edge.target;
      if (hasCycle(targetId)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id) && hasCycle(node.id)) {
      circularCount++;
    }
  }

  return circularCount;
}
