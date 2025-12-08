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

  // Show PR legend if in PR mode
  if (graphData.prMode) {
    const prLegend = document.getElementById('prLegend');
    if (prLegend) {
      prLegend.style.display = 'flex';
    }
  }

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
    .attr('class', 'link')
    .attr('data-source', d => d.source.id || d.source)
    .attr('data-target', d => d.target.id || d.target);

  const node = g.selectAll('.node-circle')
    .data(graphData.nodes)
    .enter().append('circle')
    .attr('r', d => d.isPRFile ? 8 : 6) // Larger radius for PR files
    .attr('class', d => {
      let classes = 'node-circle';

      // PR-specific styling takes priority
      if (d.isPRFile && d.prStatus) {
        classes += ' pr-file pr-status-' + d.prStatus;
      } else if (d.nodeType && d.nodeType !== 'pr-file') {
        classes += ' node-type-' + d.nodeType;
      } else if (d.entityType) {
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

      // Build tooltip content with PR info if available
      let tooltipContent = '';

      if (d.isPRFile && d.prStatus) {
        const statusIcons = {
          add: '➕',
          edit: '✏️',
          delete: '❌',
          rename: '↔️'
        };
        const statusLabels = {
          add: 'Added',
          edit: 'Modified',
          delete: 'Deleted',
          rename: 'Renamed'
        };

        tooltipContent += `<div style="border-bottom: 2px solid #007acc; padding-bottom: 5px; margin-bottom: 5px;">`;
        tooltipContent += `<strong style="color: #ffc107;">${statusIcons[d.prStatus]} PR File - ${statusLabels[d.prStatus]}</strong><br>`;

        if (d.prChanges) {
          tooltipContent += `<span style="color: #28a745;">+${d.prChanges.additions}</span> / `;
          tooltipContent += `<span style="color: #dc3545;">-${d.prChanges.deletions}</span>`;
        }
        tooltipContent += `</div>`;
      }

      if (d.displayName !== d.fileName) {
        tooltipContent += `<strong>${d.displayName}</strong> (${d.entityType})<br>`;
        tooltipContent += `<small>${d.fileName}</small>`;
      } else {
        tooltipContent += `<strong>${d.fileName}</strong><br>`;
        tooltipContent += `<small>${d.relativePath}</small>`;
      }

      if (d.nodeType && !d.isPRFile) {
        const typeLabels = {
          dependency: '📦 Dependency',
          dependent: '🔗 Dependent',
          both: '🔄 Dep + Dependent',
          indirect: '🔀 Indirect'
        };
        tooltipContent += `<br><span style="color: #17a2b8;">${typeLabels[d.nodeType] || ''}</span>`;
      }

      tooltip.innerHTML = tooltipContent;

      // Temporarily show tooltip to measure size (but keep invisible)
      tooltip.style.visibility = 'hidden';
      tooltip.style.opacity = '1';
      tooltip.style.display = 'block';

      // Force reflow to get accurate dimensions
      const tooltipRect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Get container boundary to respect the split view
      const container = document.querySelector('.left-panel');
      const boundaryRight = container ? container.getBoundingClientRect().right : viewportWidth;

      // Use clientX/clientY for accurate positioning relative to viewport
      let left = event.clientX + 10;
      let top = event.clientY + 10;

      // If tooltip overflows right edge (of container), position it to the left of cursor
      if (left + tooltipRect.width > boundaryRight) {
        left = event.clientX - tooltipRect.width - 10;
      }

      // If tooltip overflows bottom edge, position it above cursor
      if (top + tooltipRect.height > viewportHeight) {
        top = event.clientY - tooltipRect.height - 10;
      }

      // Ensure tooltip doesn't go off left edge
      if (left < 0) {
        left = 10;
      }

      // Ensure tooltip doesn't go off top edge
      if (top < 0) {
        top = 10;
      }

      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';

      // Now make tooltip visible
      tooltip.style.visibility = 'visible';
    })
    .on('mouseleave', () => {
      const tooltip = document.getElementById('nodeTooltip');
      tooltip.style.opacity = '0';
      tooltip.style.visibility = 'visible'; // Reset visibility for next hover
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
    .style('stroke-width', d => d.selected ? '3px' : null)
    .classed('node-selected', d => d.selected); // Add animation class

  // Update link styles based on selected node
  const selectedNode = graphData.nodes.find(n => n.selected);

  svg.selectAll('.link')
    .classed('link-highlighted', false) // Reset all
    .classed('link-dependency', false)
    .classed('link-dependent', false);

  if (selectedNode) {
    // Highlight dependency links (selected -> others)
    svg.selectAll('.link')
      .filter(function () {
        const sourceId = d3.select(this).attr('data-source');
        return sourceId === selectedNode.id;
      })
      .classed('link-highlighted', true)
      .classed('link-dependency', true);

    // Highlight dependent links (others -> selected)
    svg.selectAll('.link')
      .filter(function () {
        const targetId = d3.select(this).attr('data-target');
        return targetId === selectedNode.id;
      })
      .classed('link-highlighted', true)
      .classed('link-dependent', true);
  }
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
        
        ${node.isPRFile && node.prStatus ? `
        <div class="detail-section" style="background: linear-gradient(135deg, #2d2d30 0%, #1a1a1a 100%); border-left: 4px solid ${getPRStatusColor(node.prStatus)};">
            <h4 style="color: ${getPRStatusColor(node.prStatus)};">
                ${getPRStatusIcon(node.prStatus)} PR File - ${getPRStatusLabel(node.prStatus)}
            </h4>
            ${node.prChanges ? `
            <div style="display: flex; gap: 20px; font-size: 16px; font-weight: bold; margin-top: 10px;">
                <span style="color: #28a745;">+${node.prChanges.additions} additions</span>
                <span style="color: #dc3545;">-${node.prChanges.deletions} deletions</span>
            </div>
            ` : ''}
            ${node.prPath ? `
            <div style="margin-top: 10px; font-size: 11px; color: #888;">
                PR Path: ${node.prPath}
            </div>
            ` : ''}
        </div>
        ` : ''}
        
        ${node.nodeType && !node.isPRFile ? `
        <div class="detail-section" style="border-left: 4px solid #17a2b8;">
            <h4 style="color: #17a2b8;">${getNodeTypeLabel(node.nodeType)}</h4>
            <div style="font-size: 12px; color: #aaa;">
                ${getNodeTypeDescription(node.nodeType)}
            </div>
        </div>
        ` : ''}
        
        <div class="detail-section">
            <h4>📂 File Path</h4>
            <div style="word-break: break-all; font-size: 0.9em; color: #ccc;">${node.relativePath || 'Unknown path'}</div>
        </div>

        <!-- Actions Bar: Moved to top for better accessibility -->
        <div class="detail-section" style="margin-bottom: 15px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <button class="ai-analyst-btn" style="font-size: 11px; padding: 8px 4px; display: flex; align-items: center; justify-content: center; gap: 4px;" onclick="analyzeWithAI('${node.id}')">
                    <span>🤖</span> AI Analysis
                </button>
                <button class="ai-analyst-btn" style="font-size: 11px; padding: 8px 4px; background: linear-gradient(135deg, #9C27B0 0%, #673AB7 100%); display: flex; align-items: center; justify-content: center; gap: 4px;" onclick="analyzeDeepImpact('${node.id}')">
                    <span>🔍</span> Deep Impact
                </button>
            </div>
            <div id="ai-analysis-${node.id}" class="ai-analysis-result"></div>
        </div>
        
        <div class="detail-section">
            <h4 style="border-bottom: 3px solid #ff6b6b; padding-bottom: 8px;">📥 Dependencies (${dependencies.length}) - What I Need</h4>
            <div style="max-height: 250px; overflow-y: auto;">
                ${dependenciesHtml || '<p style="opacity:0.6; font-style:italic;">No dependencies found</p>'}
            </div>
        </div>
        
        <div class="detail-section">
            <h4 style="border-bottom: 3px solid #ffa500; padding-bottom: 8px;">📤 Dependents (${dependents.length}) - Who Needs Me</h4>
            <div style="max-height: 250px; overflow-y: auto;">
                ${dependentsHtml || '<p style="opacity:0.6; font-style:italic;">No dependents found</p>'}
            </div>
        </div>
    `;

  console.log('Setting detail view HTML');
  detailView.innerHTML = html;
}

function analyzeDeepImpact(nodeId) {
  vscode.postMessage({
    command: 'analyzeDeepImpact',
    nodeId: nodeId
  });
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

    // Function to center the node
    const centerNode = () => {
      if (node.x && node.y) {
        const svgElement = document.getElementById('d3-graph');
        const width = parseFloat(svgElement.getAttribute('width')) || 800;
        const height = parseFloat(svgElement.getAttribute('height')) || 600;

        // Use current zoom level or 0.8 for better overview
        const currentScale = d3.zoomTransform(svgElement).k;
        const targetScale = Math.max(0.8, Math.min(currentScale, 1.2));

        const transform = d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(targetScale)
          .translate(-node.x, -node.y);

        svg.transition().duration(750).call(
          zoom.transform,
          transform
        );
      }
    };

    // If node doesn't have coordinates yet, wait for simulation to tick
    if (!node.x || !node.y) {
      // Resume simulation if it's stopped
      if (simulation && simulation.alpha() < 0.1) {
        simulation.alpha(0.3).restart();
      }

      // Wait for next simulation tick
      const tickHandler = () => {
        if (node.x && node.y) {
          simulation.on('tick.focus', null); // Remove listener
          centerNode();
        }
      };

      if (simulation) {
        simulation.on('tick.focus', tickHandler);
      }

      // Fallback: try after 500ms regardless
      setTimeout(() => {
        simulation.on('tick.focus', null);
        centerNode();
      }, 500);
    } else {
      // Node already has coordinates, center immediately
      centerNode();
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
    // Use the same logic as focusOnNode for consistency
    focusOnNode(matchingNode.id);
  } else {
    alert('Module not found: ' + searchValue);
  }
}

function recenterGraph() {
  svg.transition().duration(750).call(
    zoom.transform,
    d3.zoomIdentity
  );
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

// PR-specific helper functions
function getPRStatusColor(status) {
  const colors = {
    add: '#28a745',
    edit: '#ffc107',
    delete: '#dc3545',
    rename: '#17a2b8'
  };
  return colors[status] || '#6c757d';
}

function getPRStatusIcon(status) {
  const icons = {
    add: '➕',
    edit: '✏️',
    delete: '❌',
    rename: '↔️'
  };
  return icons[status] || '📄';
}

function getPRStatusLabel(status) {
  const labels = {
    add: 'Added',
    edit: 'Modified',
    delete: 'Deleted',
    rename: 'Renamed'
  };
  return labels[status] || 'Unknown';
}

function getNodeTypeLabel(nodeType) {
  const labels = {
    dependency: '📦 Dependency',
    dependent: '🔗 Dependent',
    both: '🔄 Dependency & Dependent',
    indirect: '🔀 Indirect Relation'
  };
  return labels[nodeType] || 'File';
}

function getNodeTypeDescription(nodeType) {
  const descriptions = {
    dependency: 'This file is imported by PR files',
    dependent: 'This file imports PR files',
    both: 'This file both imports and is imported by PR files',
    indirect: 'This file has an indirect relationship with PR files'
  };
  return descriptions[nodeType] || '';
}

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

function copyGraphJson() {
  try {
    const exportData = {
      metadata: {
        timestamp: new Date().toISOString(),
        workspaceRoot: workspaceRoot,
        searchTerm: searchTerm,
        statistics: {
          totalFiles: graphData.nodes.length,
          totalDependencies: graphData.edges.length,
          circularDependencies: parseInt(document.getElementById('circularCount').textContent || '0')
        }
      },
      nodes: graphData.nodes.map(node => ({
        id: node.id,
        label: node.label,
        type: node.type,
        path: node.path,
        x: node.x,
        y: node.y
      })),
      edges: graphData.edges.map(edge => ({
        source: edge.source.id || edge.source,
        target: edge.target.id || edge.target
      }))
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      // Show success feedback
      const btn = document.querySelector('.copy-json-btn');
      const originalText = btn.innerHTML;
      btn.innerHTML = '✅ Copied!';
      btn.style.background = 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)';

      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy JSON:', err);
      alert('Failed to copy to clipboard. Please check console for details.');
    });
  } catch (error) {
    console.error('Error generating JSON:', error);
    alert('Failed to generate JSON data.');
  }
}
