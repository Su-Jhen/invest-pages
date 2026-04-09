/* ============================================================
   TW-Stock Treasury — insights.js
   台股投資金庫 市場觀察頁面核心邏輯
   ============================================================ */
(function () {
  'use strict';

  // ----------------------------------------------------------
  // 1. State
  // ----------------------------------------------------------
  var allInsights = [];
  var termsMap = {};  // id → name_zh lookup
  var allTags = [];   // unique tags collected from data
  var filters = {
    categories: [],
    tags: []
  };

  var CATEGORIES = ['市場機制', '盤勢觀察', '政策事件', '個股案例'];

  // ----------------------------------------------------------
  // 2. Data Layer
  // ----------------------------------------------------------

  function fetchData() {
    return Promise.all([
      fetch('data/insights.json').then(function (r) {
        if (!r.ok) throw { type: 'network' };
        return r.json();
      }),
      fetch('data/terms.json').then(function (r) {
        if (!r.ok) throw null;
        return r.json();
      }).catch(function () { return null; })
    ]).then(function (results) {
      var insightsData = results[0];
      var termsData = results[1];

      if (!insightsData.insights || !Array.isArray(insightsData.insights)) {
        throw { type: 'empty' };
      }

      allInsights = insightsData.insights;

      // Sort by date descending
      allInsights.sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });

      // Build terms lookup
      if (termsData && termsData.terms) {
        for (var i = 0; i < termsData.terms.length; i++) {
          var t = termsData.terms[i];
          termsMap[t.id] = t.name_zh;
        }
      }

      // Collect unique tags
      var tagSet = {};
      for (var j = 0; j < allInsights.length; j++) {
        var tags = allInsights[j].tags || [];
        for (var k = 0; k < tags.length; k++) {
          tagSet[tags[k]] = true;
        }
      }
      allTags = Object.keys(tagSet).sort();

      return insightsData;
    }).catch(function (err) {
      if (err && err.type === 'empty') {
        showError('目前沒有任何觀察資料。');
      } else {
        showError('無法載入資料，請檢查網路連線後重新整理頁面。');
      }
      throw err;
    });
  }

  function filterInsights(insights, f) {
    return insights.filter(function (ins) {
      if (f.categories.length > 0) {
        if (f.categories.indexOf(ins.category) === -1) return false;
      }
      if (f.tags.length > 0) {
        var insTags = ins.tags || [];
        var match = false;
        for (var i = 0; i < f.tags.length; i++) {
          if (insTags.indexOf(f.tags[i]) !== -1) {
            match = true;
            break;
          }
        }
        if (!match) return false;
      }
      return true;
    });
  }

  // ----------------------------------------------------------
  // 3. Render Layer
  // ----------------------------------------------------------

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function createCard(ins) {
    var html = '<article class="insights-card" id="insight-' + escapeHTML(ins.id) + '">';

    // Header: date + category badge
    html += '<div class="insights-header">';
    html += '<span class="insights-date">' + escapeHTML(ins.date) + '</span>';
    html += ' <span class="badge category-badge">' + escapeHTML(ins.category) + '</span>';
    html += '</div>';

    // Title
    html += '<h3 class="insights-title">' + escapeHTML(ins.title) + '</h3>';

    // Context
    html += '<p class="insights-context">' + escapeHTML(ins.context) + '</p>';

    // QA section
    var qaItems = ins.qa || [];
    if (qaItems.length > 0) {
      html += '<div class="insights-qa">';
      for (var i = 0; i < qaItems.length; i++) {
        var q = qaItems[i];
        html += '<div class="qa-item">';
        html += '<p class="qa-question">Q：' + escapeHTML(q.question) + '</p>';
        html += '<p class="qa-insight">&#x1F4A1; ' + escapeHTML(q.key_insight) + '</p>';
        if (q.answer) {
          html += '<details><summary>完整回答</summary>';
          html += '<p class="insights-answer">' + escapeHTML(q.answer) + '</p>';
          html += '</details>';
        }
        html += '</div>';
      }
      html += '</div>';
    }

    // Key takeaway
    html += '<div class="insights-takeaway">';
    html += '<strong>Key Takeaway：</strong>' + escapeHTML(ins.key_takeaway);
    html += '</div>';

    // Tags
    var tags = ins.tags || [];
    if (tags.length > 0) {
      html += '<div class="insights-tags">';
      for (var j = 0; j < tags.length; j++) {
        html += '<span class="badge insights-tag-badge" data-tag="' + escapeHTML(tags[j]) + '">'
          + escapeHTML(tags[j]) + '</span>';
      }
      html += '</div>';
    }

    // Related terms
    var related = ins.related_terms || [];
    if (related.length > 0) {
      html += '<div class="card-related"><small><strong>相關名詞：</strong></small>';
      for (var k = 0; k < related.length; k++) {
        var termId = related[k];
        var termName = termsMap[termId];
        if (termName) {
          html += ' <a class="badge related-badge" href="index.html#term-' + escapeHTML(termId) + '">'
            + escapeHTML(termName) + '</a>';
        } else {
          html += ' <span class="badge related-badge">' + escapeHTML(termId) + '</span>';
        }
      }
      html += '</div>';
    }

    html += '</article>';
    return html;
  }

  function renderCards(insights) {
    var container = document.getElementById('card-container');
    if (!insights || insights.length === 0) {
      container.innerHTML = '<p class="status-message">沒有符合條件的觀察，請調整篩選條件。</p>';
      return;
    }
    var html = '<div class="card-grid insights-grid">';
    for (var i = 0; i < insights.length; i++) {
      html += createCard(insights[i]);
    }
    html += '</div>';
    container.innerHTML = html;
  }

  function renderFilterChips() {
    var catContainer = document.getElementById('category-chips');
    var tagContainer = document.getElementById('tag-chips');

    var catHTML = '';
    for (var i = 0; i < CATEGORIES.length; i++) {
      catHTML += '<button class="chip" data-filter="category" data-value="'
        + escapeHTML(CATEGORIES[i]) + '">' + escapeHTML(CATEGORIES[i]) + '</button>';
    }
    catContainer.innerHTML = catHTML;

    var tagHTML = '';
    for (var j = 0; j < allTags.length; j++) {
      tagHTML += '<button class="chip" data-filter="tag" data-value="'
        + escapeHTML(allTags[j]) + '">' + escapeHTML(allTags[j]) + '</button>';
    }
    tagContainer.innerHTML = tagHTML;
  }

  function renderCount(shown, total) {
    var el = document.getElementById('count');
    el.textContent = '顯示 ' + shown + ' / ' + total + ' 筆觀察';
  }

  function showError(message) {
    var container = document.getElementById('card-container');
    container.innerHTML = '';
    var p = document.createElement('p');
    p.className = 'status-message';
    p.textContent = message;
    p.style.textAlign = 'center';
    container.appendChild(p);
  }

  // ----------------------------------------------------------
  // 4. Event Handlers
  // ----------------------------------------------------------

  function toggleArrayValue(arr, val) {
    var idx = arr.indexOf(val);
    if (idx === -1) {
      arr.push(val);
    } else {
      arr.splice(idx, 1);
    }
  }

  function applyFilters() {
    var result = filterInsights(allInsights, filters);
    renderCards(result);
    renderCount(result.length, allInsights.length);
  }

  function onFilterToggle() {
    var panel = document.getElementById('filter-panel');
    if (panel.hasAttribute('hidden')) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }
  }

  function onChipClick(e) {
    var btn = e.target;
    if (!btn.classList.contains('chip')) return;
    var filterType = btn.getAttribute('data-filter');
    var val = btn.getAttribute('data-value');

    if (filterType === 'category') {
      toggleArrayValue(filters.categories, val);
    } else if (filterType === 'tag') {
      toggleArrayValue(filters.tags, val);
    }
    btn.classList.toggle('active');
    applyFilters();
  }

  function onTagBadgeClick(e) {
    var badge = e.target;
    if (!badge.classList.contains('insights-tag-badge')) return;
    var tagVal = badge.getAttribute('data-tag');
    if (!tagVal) return;

    // Activate the tag in filters if not already
    if (filters.tags.indexOf(tagVal) === -1) {
      filters.tags.push(tagVal);
      // Activate the corresponding chip in filter panel
      var chips = document.querySelectorAll('#tag-chips .chip');
      for (var i = 0; i < chips.length; i++) {
        if (chips[i].getAttribute('data-value') === tagVal) {
          chips[i].classList.add('active');
        }
      }
      // Show filter panel
      document.getElementById('filter-panel').removeAttribute('hidden');
      applyFilters();
    }
  }

  // ----------------------------------------------------------
  // 5. Hash scroll
  // ----------------------------------------------------------

  function handleHashScroll() {
    var hash = window.location.hash;
    if (!hash || !hash.startsWith('#insight-')) return;
    var el = document.getElementById(hash.substring(1));
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.outline = '3px solid var(--pico-primary)';
    el.style.outlineOffset = '4px';
    el.style.borderRadius = '0.75rem';
    setTimeout(function () {
      el.style.outline = '';
      el.style.outlineOffset = '';
    }, 2000);
  }

  // ----------------------------------------------------------
  // 6. Init
  // ----------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function () {
    fetchData()
      .then(function () {
        renderFilterChips();
        renderCards(allInsights);
        renderCount(allInsights.length, allInsights.length);

        document.getElementById('filter-toggle')
          .addEventListener('click', onFilterToggle);

        document.getElementById('category-chips')
          .addEventListener('click', onChipClick);

        document.getElementById('tag-chips')
          .addEventListener('click', onChipClick);

        document.getElementById('card-container')
          .addEventListener('click', onTagBadgeClick);

        handleHashScroll();
      })
      .catch(function () {});
  });

})();
