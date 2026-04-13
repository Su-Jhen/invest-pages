/* ============================================================
   TW-Stock Treasury — articles.js
   台股投資金庫 深度分析頁面核心邏輯
   ============================================================ */
(function () {
  'use strict';

  // ----------------------------------------------------------
  // 1. State
  // ----------------------------------------------------------
  var allArticles = [];
  var termsMap = {};
  var filters = { categories: [] };

  var CATEGORIES = ['策略分析', '盤勢觀察', '指標研究', '學習筆記'];

  // ----------------------------------------------------------
  // 2. Security: L1 marked.js renderer + L2 DOMPurify config
  // ----------------------------------------------------------

  function getMarkedOptions() {
    var renderer = new marked.Renderer();

    // L1: 禁用圖片 → 渲染為純文字
    renderer.image = function (href, title, text) {
      return text || '';
    };

    // L1: 連結只允許 https://
    renderer.link = function (href, title, text) {
      if (href && !href.startsWith('https://')) return text;
      var titleAttr = title ? ' title="' + title + '"' : '';
      return '<a href="' + href + '" rel="noopener"' + titleAttr + '>' + text + '</a>';
    };

    return { gfm: true, breaks: false, renderer: renderer };
  }

  var PURIFY_CONFIG = {
    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','a','strong','em',
                   'code','pre','blockquote','table','thead','tbody','tr',
                   'th','td','ul','ol','li','hr','br','del'],
    ALLOWED_ATTR: ['href','rel','title'],
    ALLOWED_URI_REGEXP: /^https:\/\//i
  };

  function renderMarkdown(md) {
    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
      return null; // CDN 載入失敗
    }
    var rawHtml = marked.parse(md, getMarkedOptions());
    return DOMPurify.sanitize(rawHtml, PURIFY_CONFIG);
  }

  // ----------------------------------------------------------
  // 3. Data Layer
  // ----------------------------------------------------------

  function fetchData() {
    return Promise.all([
      fetch('data/articles.json').then(function (r) {
        if (!r.ok) throw { type: 'network' };
        return r.json();
      }),
      fetch('data/terms.json').then(function (r) {
        if (!r.ok) throw null;
        return r.json();
      }).catch(function () { return null; })
    ]).then(function (results) {
      var articlesData = results[0];
      var termsData = results[1];

      if (!articlesData.articles || !Array.isArray(articlesData.articles)) {
        throw { type: 'empty' };
      }

      allArticles = articlesData.articles;

      // Sort by date descending
      allArticles.sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });

      // Build terms lookup
      if (termsData && termsData.terms) {
        for (var i = 0; i < termsData.terms.length; i++) {
          var t = termsData.terms[i];
          termsMap[t.id] = t.name_zh;
        }
      }

      return articlesData;
    }).catch(function (err) {
      if (err && err.type === 'empty') {
        showMessage('尚無文章。');
      } else {
        showMessage('資料載入失敗，請重新整理。');
      }
      throw err;
    });
  }

  function fetchArticleContent(id) {
    return fetch('articles/' + encodeURIComponent(id) + '.md').then(function (r) {
      if (!r.ok) throw new Error('fetch failed');
      return r.text();
    });
  }

  // ----------------------------------------------------------
  // 4. Render Layer
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

  function createListCard(article) {
    var html = '<article class="articles-list-card" data-id="' + escapeHTML(article.id) + '">';

    // Header: date + category
    html += '<div class="articles-header">';
    html += '<span class="articles-date">' + escapeHTML(article.date) + '</span>';
    html += ' <span class="badge category-badge">' + escapeHTML(article.category) + '</span>';
    html += '</div>';

    // Title
    html += '<h3 class="articles-card-title">' + escapeHTML(article.title) + '</h3>';

    // Summary
    html += '<p class="articles-summary">' + escapeHTML(article.summary) + '</p>';

    // Tags
    var tags = article.tags || [];
    if (tags.length > 0) {
      html += '<div class="articles-tags">';
      for (var i = 0; i < tags.length; i++) {
        html += '<span class="badge articles-tag-badge">' + escapeHTML(tags[i]) + '</span>';
      }
      html += '</div>';
    }

    html += '</article>';
    return html;
  }

  function renderList(articles) {
    var container = document.getElementById('articles-list');
    var countEl = document.getElementById('count');

    if (!articles || articles.length === 0) {
      container.innerHTML = '<p class="status-message">此分類尚無文章。</p>';
      countEl.textContent = '顯示 0 / ' + allArticles.length + ' 篇文章';
      return;
    }

    var html = '';
    for (var i = 0; i < articles.length; i++) {
      html += createListCard(articles[i]);
    }
    container.innerHTML = html;
    countEl.textContent = '顯示 ' + articles.length + ' / ' + allArticles.length + ' 篇文章';
  }

  function renderArticleContent(article, mdHtml) {
    var container = document.getElementById('articles-content');
    var html = '<a href="articles.html" class="articles-back">&larr; 返回文章列表</a>';

    // Article meta
    html += '<div class="articles-meta">';
    html += '<span class="articles-date">' + escapeHTML(article.date) + '</span>';
    html += ' <span class="badge category-badge">' + escapeHTML(article.category) + '</span>';
    html += '</div>';

    // Rendered markdown
    html += '<div class="articles-content">' + mdHtml + '</div>';

    // Tags
    var tags = article.tags || [];
    if (tags.length > 0) {
      html += '<div class="articles-tags" style="margin-top:1.5rem">';
      for (var i = 0; i < tags.length; i++) {
        html += '<span class="badge articles-tag-badge">' + escapeHTML(tags[i]) + '</span>';
      }
      html += '</div>';
    }

    // Related terms
    var related = article.related_terms || [];
    if (related.length > 0) {
      html += '<div class="card-related" style="margin-top:0.75rem"><small><strong>相關名詞：</strong></small>';
      for (var j = 0; j < related.length; j++) {
        var termId = related[j];
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

    html += '<div style="margin-top:2rem"><a href="articles.html" class="articles-back">&larr; 返回文章列表</a></div>';
    container.innerHTML = html;
  }

  function showMessage(msg) {
    var list = document.getElementById('articles-list');
    var content = document.getElementById('articles-content');
    if (list) list.innerHTML = '<p class="status-message">' + escapeHTML(msg) + '</p>';
    if (content) content.innerHTML = '';
  }

  function renderFilterChips() {
    var container = document.getElementById('category-chips');
    var html = '';
    for (var i = 0; i < CATEGORIES.length; i++) {
      html += '<button class="chip" data-filter="category" data-value="'
        + escapeHTML(CATEGORIES[i]) + '">' + escapeHTML(CATEGORIES[i]) + '</button>';
    }
    container.innerHTML = html;
  }

  // ----------------------------------------------------------
  // 5. View Switching (list ↔ article)
  // ----------------------------------------------------------

  function showListView() {
    document.getElementById('list-view').removeAttribute('hidden');
    document.getElementById('article-view').setAttribute('hidden', '');
    document.title = '深度分析 — 台股投資金庫';
    applyFilters();
  }

  function showArticleView(id) {
    var article = null;
    for (var i = 0; i < allArticles.length; i++) {
      if (allArticles[i].id === id) { article = allArticles[i]; break; }
    }

    if (!article) {
      document.getElementById('list-view').setAttribute('hidden', '');
      document.getElementById('article-view').removeAttribute('hidden');
      document.getElementById('articles-content').innerHTML =
        '<p class="status-message">找不到此文章。</p>' +
        '<p style="text-align:center"><a href="articles.html">&larr; 返回文章列表</a></p>';
      return;
    }

    document.getElementById('list-view').setAttribute('hidden', '');
    document.getElementById('article-view').removeAttribute('hidden');
    document.getElementById('articles-content').innerHTML =
      '<p class="status-message">載入中...</p>';
    document.title = article.title + ' — 台股投資金庫';

    fetchArticleContent(article.id).then(function (md) {
      var html = renderMarkdown(md);
      if (html === null) {
        document.getElementById('articles-content').innerHTML =
          '<p class="status-message">Markdown 渲染元件載入失敗，請重新整理頁面。</p>' +
          '<p style="text-align:center"><a href="articles.html">&larr; 返回文章列表</a></p>';
        return;
      }
      renderArticleContent(article, html);
    }).catch(function () {
      document.getElementById('articles-content').innerHTML =
        '<p class="status-message">文章載入失敗，請重試。</p>' +
        '<p style="text-align:center"><a href="articles.html">&larr; 返回文章列表</a></p>';
    });
  }

  function handleRoute() {
    var hash = window.location.hash;
    if (hash && hash.startsWith('#article-')) {
      var id = hash.substring('#article-'.length);
      showArticleView(decodeURIComponent(id));
    } else {
      showListView();
    }
  }

  // ----------------------------------------------------------
  // 6. Event Handlers
  // ----------------------------------------------------------

  function applyFilters() {
    var result = allArticles;
    if (filters.categories.length > 0) {
      result = result.filter(function (a) {
        return filters.categories.indexOf(a.category) !== -1;
      });
    }
    renderList(result);
  }

  function onChipClick(e) {
    var btn = e.target;
    if (!btn.classList.contains('chip')) return;
    var val = btn.getAttribute('data-value');

    var idx = filters.categories.indexOf(val);
    if (idx === -1) {
      filters.categories.push(val);
    } else {
      filters.categories.splice(idx, 1);
    }
    btn.classList.toggle('active');
    applyFilters();
  }

  function onListClick(e) {
    var card = e.target.closest('.articles-list-card');
    if (!card) return;
    var id = card.getAttribute('data-id');
    if (id) {
      window.location.hash = '#article-' + id;
    }
  }

  function onBackClick(e) {
    if (e.target.classList.contains('articles-back')) {
      e.preventDefault();
      window.location.hash = '';
    }
  }

  function onFilterToggle() {
    var panel = document.getElementById('filter-panel');
    if (panel.hasAttribute('hidden')) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }
  }

  // ----------------------------------------------------------
  // 7. Init
  // ----------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function () {
    fetchData()
      .then(function () {
        renderFilterChips();
        handleRoute();

        window.addEventListener('hashchange', handleRoute);

        document.getElementById('filter-toggle')
          .addEventListener('click', onFilterToggle);

        document.getElementById('category-chips')
          .addEventListener('click', onChipClick);

        document.getElementById('articles-list')
          .addEventListener('click', onListClick);

        document.getElementById('article-view')
          .addEventListener('click', onBackClick);
      })
      .catch(function () {});
  });

})();
