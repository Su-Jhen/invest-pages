/* ============================================================
   TW-Stock Treasury — map.js
   知識地圖渲染邏輯 (Cytoscape.js + dagre)
   ============================================================ */
(function () {
  'use strict';

  // ----------------------------------------------------------
  // 1. CDN degradation check
  // ----------------------------------------------------------
  if (typeof cytoscape === 'undefined' || typeof dagre === 'undefined') {
    document.getElementById('cy').style.display = 'none';
    document.getElementById('degrade-msg').removeAttribute('hidden');
    return;
  }

  // ----------------------------------------------------------
  // 2. Color palette (light/dark)
  // ----------------------------------------------------------
  var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  var COLORS = {
    profit:     isDark ? '#60a5fa' : '#3b82f6',
    valuation:  isDark ? '#4ade80' : '#22c55e',
    nodeText:   isDark ? '#1e293b' : '#ffffff',
    compose:    isDark ? '#60a5fa' : '#3b82f6',
    contrast:   isDark ? '#6b7280' : '#9ca3af',
    sequence:   isDark ? '#fb923c' : '#f97316',
    dimmed:     isDark ? '#374151' : '#e5e7eb',
    dimmedEdge: isDark ? '#1f2937' : '#f3f4f6'
  };

  var SUB_TAG_COLORS = {
    '獲利能力': COLORS.profit,
    '評價指標': COLORS.valuation
  };

  // ----------------------------------------------------------
  // 3. State
  // ----------------------------------------------------------
  var cy = null;
  var allTermsMap = {};
  var modalOpen = false;

  // ----------------------------------------------------------
  // 4. Data loading
  // ----------------------------------------------------------
  function init() {
    fetch('data/terms.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then(function (data) {
        buildGraph(data);
        setupInteractions();
        setupLegend();
        setupHint();
        handleHash();
      })
      .catch(function () {
        document.getElementById('cy').style.display = 'none';
        document.getElementById('degrade-msg').removeAttribute('hidden');
      });
  }

  // ----------------------------------------------------------
  // 5. Build Cytoscape graph
  // ----------------------------------------------------------
  function buildGraph(data) {
    var terms = data.terms || [];
    var edges = data.edges || [];

    // Build term lookup and connected set
    var connectedIds = {};
    for (var e = 0; e < edges.length; e++) {
      connectedIds[edges[e].source] = true;
      connectedIds[edges[e].target] = true;
    }

    // Nodes: only connected terms
    var nodes = [];
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      allTermsMap[t.id] = t;
      if (!connectedIds[t.id]) continue;
      var subTag = (t.sub_tags && t.sub_tags[0]) || '';
      nodes.push({
        data: {
          id: t.id,
          label: t.name_zh,
          subTag: subTag,
          color: SUB_TAG_COLORS[subTag] || COLORS.profit
        }
      });
    }

    // Edges
    var cyEdges = [];
    for (var j = 0; j < edges.length; j++) {
      var edge = edges[j];
      cyEdges.push({
        data: {
          id: 'e' + j,
          source: edge.source,
          target: edge.target,
          edgeType: edge.type,
          label: edge.label || ''
        }
      });
    }

    cy = cytoscape({
      container: document.getElementById('cy'),
      elements: { nodes: nodes, edges: cyEdges },
      minZoom: 0.4,
      maxZoom: 3,
      style: [
        // --- Nodes ---
        {
          selector: 'node',
          style: {
            'shape': 'round-rectangle',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '12px',
            'font-weight': 'bold',
            'color': COLORS.nodeText,
            'background-color': 'data(color)',
            'width': 'label',
            'height': 44,
            'padding': '10px',
            'text-wrap': 'wrap',
            'text-max-width': '80px',
            'border-width': 0,
            'text-outline-width': 0
          }
        },
        // --- Edges: compose (solid, arrow) ---
        {
          selector: 'edge[edgeType="compose"]',
          style: {
            'line-style': 'solid',
            'line-color': COLORS.compose,
            'target-arrow-color': COLORS.compose,
            'target-arrow-shape': 'triangle',
            'arrow-scale': 1.2,
            'width': 2,
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '10px',
            'text-rotation': 'autorotate',
            'text-background-color': isDark ? '#1e293b' : '#ffffff',
            'text-background-opacity': 0.8,
            'text-background-padding': '2px',
            'color': isDark ? '#d1d5db' : '#6b7280'
          }
        },
        // --- Edges: contrast (dashed, no arrow) ---
        {
          selector: 'edge[edgeType="contrast"]',
          style: {
            'line-style': 'dashed',
            'line-color': COLORS.contrast,
            'target-arrow-shape': 'none',
            'width': 2,
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '10px',
            'text-rotation': 'autorotate',
            'text-background-color': isDark ? '#1e293b' : '#ffffff',
            'text-background-opacity': 0.8,
            'text-background-padding': '2px',
            'color': isDark ? '#d1d5db' : '#6b7280'
          }
        },
        // --- Edges: sequence (dotted, arrow) ---
        {
          selector: 'edge[edgeType="sequence"]',
          style: {
            'line-style': 'dotted',
            'line-color': COLORS.sequence,
            'target-arrow-color': COLORS.sequence,
            'target-arrow-shape': 'triangle',
            'arrow-scale': 1.2,
            'width': 2,
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '10px',
            'text-rotation': 'autorotate',
            'text-background-color': isDark ? '#1e293b' : '#ffffff',
            'text-background-opacity': 0.8,
            'text-background-padding': '2px',
            'color': isDark ? '#d1d5db' : '#6b7280'
          }
        },
        // --- Dimmed state ---
        {
          selector: '.dimmed',
          style: {
            'opacity': 0.15
          }
        },
        // --- Highlighted node ---
        {
          selector: '.highlighted',
          style: {
            'border-width': 3,
            'border-color': isDark ? '#fbbf24' : '#f59e0b'
          }
        }
      ],
      layout: {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 40,
        rankSep: 60,
        edgeSep: 20,
        padding: 30
      }
    });
  }

  // ----------------------------------------------------------
  // 6. Interactions
  // ----------------------------------------------------------
  function setupInteractions() {
    // Tap node -> highlight + modal
    cy.on('tap', 'node', function (evt) {
      var node = evt.target;
      highlightNode(node);
      showModal(node.id());
    });

    // Tap background -> reset
    cy.on('tap', function (evt) {
      if (evt.target === cy) {
        resetHighlight();
        closeModal();
      }
    });
  }

  function highlightNode(node) {
    resetHighlight();
    var neighborhood = node.neighborhood().add(node);
    cy.elements().not(neighborhood).addClass('dimmed');
    node.addClass('highlighted');
  }

  function resetHighlight() {
    if (!cy) return;
    cy.elements().removeClass('dimmed highlighted');
  }

  // ----------------------------------------------------------
  // 7. Modal
  // ----------------------------------------------------------
  function showModal(termId) {
    var term = allTermsMap[termId];
    if (!term) return;

    document.getElementById('modal-title').textContent = term.name_zh;
    document.getElementById('modal-en').textContent = term.name_en || '';
    document.getElementById('modal-def').textContent = term.definition || '';
    document.getElementById('modal-mnemonic').textContent = term.mnemonic
      ? '口訣：' + term.mnemonic
      : '';
    document.getElementById('modal-link').href = 'index.html#term-' + term.id;

    var modal = document.getElementById('modal');
    modal.removeAttribute('hidden');

    // Pause canvas interaction
    cy.userPanningEnabled(false);
    cy.userZoomingEnabled(false);
    cy.boxSelectionEnabled(false);

    // History state (only push once)
    if (!modalOpen) {
      history.pushState({ modal: true }, '');
      modalOpen = true;
    }

    // Close handlers
    modal.querySelector('.modal-close').onclick = closeModal;
    modal.querySelector('.modal-overlay').onclick = closeModal;
  }

  function closeModal() {
    var modal = document.getElementById('modal');
    if (modal.hasAttribute('hidden')) return;

    modal.setAttribute('hidden', '');
    resetHighlight();

    // Restore canvas interaction
    if (cy) {
      cy.userPanningEnabled(true);
      cy.userZoomingEnabled(true);
      cy.boxSelectionEnabled(true);
    }

    if (modalOpen) {
      modalOpen = false;
      history.back();
    }
  }

  // Android back button
  window.addEventListener('popstate', function () {
    if (modalOpen) {
      modalOpen = false;
      var modal = document.getElementById('modal');
      modal.setAttribute('hidden', '');
      resetHighlight();
      if (cy) {
        cy.userPanningEnabled(true);
        cy.userZoomingEnabled(true);
        cy.boxSelectionEnabled(true);
      }
    }
  });

  // ----------------------------------------------------------
  // 8. Legend
  // ----------------------------------------------------------
  function setupLegend() {
    var legend = document.getElementById('legend');
    var toggle = document.getElementById('legend-toggle');

    // Desktop default open, mobile default closed
    if (window.innerWidth > 640) {
      legend.classList.add('open');
    }

    toggle.addEventListener('click', function () {
      legend.classList.toggle('open');
    });
  }

  // ----------------------------------------------------------
  // 9. Hint (fade out + localStorage)
  // ----------------------------------------------------------
  function setupHint() {
    var hint = document.getElementById('hint');
    if (!hint) return;

    if (localStorage.getItem('map-hint-seen')) {
      hint.classList.add('hidden');
      return;
    }

    hint.addEventListener('click', function () {
      dismissHint();
    });

    setTimeout(function () {
      dismissHint();
    }, 4000);

    function dismissHint() {
      hint.classList.add('hidden');
      localStorage.setItem('map-hint-seen', '1');
    }
  }

  // ----------------------------------------------------------
  // 10. URL hash handling
  // ----------------------------------------------------------
  function handleHash() {
    var hash = window.location.hash;
    if (!hash || !hash.startsWith('#term-')) return;

    var termId = hash.replace('#term-', '');

    cy.on('layoutstop', function onLayout() {
      cy.off('layoutstop', onLayout);
      var node = cy.getElementById(termId);
      if (node && node.length > 0) {
        cy.animate({
          center: { eles: node },
          duration: 300
        });
        setTimeout(function () {
          highlightNode(node);
          showModal(termId);
        }, 350);
      }
    });
  }

  // ----------------------------------------------------------
  // 11. Boot
  // ----------------------------------------------------------
  document.addEventListener('DOMContentLoaded', init);

})();
