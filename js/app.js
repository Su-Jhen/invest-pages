/* ============================================================
   TW-Stock Treasury — app.js
   台股投資金庫 卡片瀏覽核心邏輯
   ============================================================ */
(function () {
  'use strict';

  // ----------------------------------------------------------
  // 1. State
  // ----------------------------------------------------------
  var allTerms = [];
  var metadata = {};
  var filters = {
    search: '',
    categories: [],
    subTags: []
  };

  // ----------------------------------------------------------
  // 2. Utility — debounce
  // ----------------------------------------------------------
  function debounce(fn, ms) {
    var timer;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  // ----------------------------------------------------------
  // 3. Data Layer
  // ----------------------------------------------------------

  /**
   * fetchTerms — 載入 data/terms.json
   * 回傳 Promise，成功時設定 allTerms / metadata
   */
  function fetchTerms() {
    return fetch('data/terms.json')
      .then(function (res) {
        if (!res.ok) {
          // HTTP 非 200
          throw { type: 'network' };
        }
        return res.json().catch(function () {
          throw { type: 'parse' };
        });
      })
      .then(function (data) {
        if (!data.terms || !Array.isArray(data.terms) || data.terms.length === 0) {
          throw { type: 'empty' };
        }
        allTerms = data.terms;
        metadata = (data.metadata && data.metadata.categories) ? data.metadata.categories : {};
        return data;
      })
      .catch(function (err) {
        if (err && err.type === 'parse') {
          showError('資料格式錯誤，請回報問題。');
        } else if (err && err.type === 'empty') {
          showError('目前沒有任何名詞資料。');
        } else {
          showError('無法載入資料，請檢查網路連線後重新整理頁面。');
        }
        throw err; // re-throw so caller knows init failed
      });
  }

  /**
   * filterTerms — 純函式，依 filters 條件篩選 terms
   */
  function filterTerms(terms, f) {
    return terms.filter(function (t) {
      // --- search（跨多欄位，不分大小寫）---
      if (f.search) {
        var q = f.search.toLowerCase();
        var haystack = [
          t.name_zh || '',
          t.name_en || '',
          t.definition || '',
          t.mnemonic || ''
        ].join(' ').toLowerCase();
        if (haystack.indexOf(q) === -1) return false;
      }

      // --- categories（OR）---
      if (f.categories.length > 0) {
        if (f.categories.indexOf(t.category) === -1) return false;
      }

      // --- subTags（OR）---
      if (f.subTags.length > 0) {
        var match = false;
        var termTags = t.sub_tags || [];
        for (var i = 0; i < f.subTags.length; i++) {
          if (termTags.indexOf(f.subTags[i]) !== -1) {
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
  // 4. Render Layer
  // ----------------------------------------------------------

  /**
   * escapeHTML — 轉義 HTML 特殊字元，防止 XSS
   */
  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * createCard — 產生單張卡片 HTML 字串
   */
  function createCard(term) {
    // --- badges ---
    var badgesHTML = '<div class="card-badges">';
    badgesHTML += '<span class="badge category-badge">' + escapeHTML(term.category) + '</span>';
    var tags = term.sub_tags || [];
    for (var i = 0; i < tags.length; i++) {
      badgesHTML += ' <span class="badge subtag-badge">' + escapeHTML(tags[i]) + '</span>';
    }
    badgesHTML += '</div>';

    // --- title ---
    var titleHTML = '<hgroup class="card-title">'
      + '<h3>' + escapeHTML(term.name_zh) + '</h3>'
      + '<p>' + escapeHTML(term.name_en) + '</p>'
      + '</hgroup>';

    // --- definition ---
    var defHTML = '<p class="card-definition">' + escapeHTML(term.definition) + '</p>';

    // --- expandable details ---
    var sections = [
      { label: '公式', value: term.formula },
      { label: '生活比喻', value: term.analogy },
      { label: '台股實務', value: term.action_tw },
      { label: '對比差異', value: term.contrast },
      { label: '記憶口訣', value: term.mnemonic }
    ];

    var detailsHTML = '';
    for (var j = 0; j < sections.length; j++) {
      if (sections[j].value) {
        detailsHTML += '<details>'
          + '<summary>' + escapeHTML(sections[j].label) + '</summary>'
          + '<p>' + escapeHTML(sections[j].value) + '</p>'
          + '</details>';
      }
    }

    // --- qa (深度理解) ---
    var qaHTML = '';
    var qaItems = term.qa || [];
    if (qaItems.length > 0) {
      qaHTML = '<details><summary>深度理解</summary>';
      for (var q = 0; q < qaItems.length; q++) {
        qaHTML += '<div class="qa-item">'
          + '<p class="qa-question">Q：' + escapeHTML(qaItems[q].question) + '</p>'
          + '<p class="qa-insight">&#x1F4A1; ' + escapeHTML(qaItems[q].key_insight) + '</p>'
          + '</div>';
      }
      qaHTML += '</details>';
    }

    // --- related terms ---
    var relatedHTML = '';
    var related = term.related || [];
    if (related.length > 0) {
      relatedHTML = '<div class="card-related"><small><strong>相關名詞：</strong></small>';
      for (var k = 0; k < related.length; k++) {
        relatedHTML += ' <span class="badge related-badge">' + escapeHTML(related[k]) + '</span>';
      }
      relatedHTML += '</div>';
    }

    return '<article class="term-card">'
      + badgesHTML
      + titleHTML
      + defHTML
      + detailsHTML
      + qaHTML
      + relatedHTML
      + '</article>';
  }

  /**
   * renderCards — 渲染卡片到 #card-container
   */
  function renderCards(terms) {
    var container = document.getElementById('card-container');
    if (!terms || terms.length === 0) {
      container.innerHTML = '<p class="status-message">沒有符合條件的名詞，請調整篩選條件。</p>';
      return;
    }
    var html = '<div class="card-grid">';
    for (var i = 0; i < terms.length; i++) {
      html += createCard(terms[i]);
    }
    html += '</div>';
    container.innerHTML = html;
  }

  /**
   * renderFilterChips — 根據 metadata 生成篩選 chips
   */
  function renderFilterChips(meta) {
    var catContainer = document.getElementById('category-chips');
    var subContainer = document.getElementById('subtag-chips');
    var catHTML = '';
    var subHTML = '';

    var categories = Object.keys(meta);
    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      catHTML += '<button class="chip" data-value="' + escapeHTML(cat) + '">'
        + escapeHTML(cat) + '</button>';

      // sub_tags
      var subs = meta[cat].sub_tags || [];
      for (var j = 0; j < subs.length; j++) {
        subHTML += '<button class="chip" data-value="' + escapeHTML(subs[j]) + '">'
          + escapeHTML(subs[j]) + '</button>';
      }
    }

    catContainer.innerHTML = catHTML;
    subContainer.innerHTML = subHTML;
  }

  /**
   * renderCount — 更新計數文字
   */
  function renderCount(shown, total) {
    var el = document.getElementById('count');
    el.textContent = '顯示 ' + shown + ' / ' + total + ' 筆';
  }

  // ----------------------------------------------------------
  // 5. Error Handling
  // ----------------------------------------------------------

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
  // 6. Event Handlers
  // ----------------------------------------------------------

  function applyFilters() {
    var result = filterTerms(allTerms, filters);
    renderCards(result);
    renderCount(result.length, allTerms.length);
  }

  /**
   * onSearchInput — debounced 搜尋
   */
  var onSearchInput = debounce(function (e) {
    filters.search = e.target.value.trim();
    applyFilters();
  }, 200);

  /**
   * onFilterToggle — 顯示/隱藏篩選面板
   */
  function onFilterToggle() {
    var panel = document.getElementById('filter-panel');
    if (panel.hasAttribute('hidden')) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }
  }

  /**
   * toggleArrayValue — 在陣列中 toggle 某值
   */
  function toggleArrayValue(arr, val) {
    var idx = arr.indexOf(val);
    if (idx === -1) {
      arr.push(val);
    } else {
      arr.splice(idx, 1);
    }
  }

  /**
   * onCategoryChipClick — category chip 點擊
   */
  function onCategoryChipClick(e) {
    var btn = e.target;
    if (!btn.classList.contains('chip')) return;
    var val = btn.getAttribute('data-value');
    toggleArrayValue(filters.categories, val);
    btn.classList.toggle('active');
    applyFilters();
  }

  /**
   * onSubTagChipClick — subTag chip 點擊
   */
  function onSubTagChipClick(e) {
    var btn = e.target;
    if (!btn.classList.contains('chip')) return;
    var val = btn.getAttribute('data-value');
    toggleArrayValue(filters.subTags, val);
    btn.classList.toggle('active');
    applyFilters();
  }

  // ----------------------------------------------------------
  // 7. Init
  // ----------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function () {
    fetchTerms()
      .then(function () {
        // Render filter chips
        renderFilterChips(metadata);

        // Render all cards
        renderCards(allTerms);
        renderCount(allTerms.length, allTerms.length);

        // Bind events
        document.getElementById('search-input')
          .addEventListener('input', onSearchInput);

        document.getElementById('filter-toggle')
          .addEventListener('click', onFilterToggle);

        document.getElementById('category-chips')
          .addEventListener('click', onCategoryChipClick);

        document.getElementById('subtag-chips')
          .addEventListener('click', onSubTagChipClick);
      })
      .catch(function () {
        // Error already shown by fetchTerms, nothing else to do
      });
  });

})();
