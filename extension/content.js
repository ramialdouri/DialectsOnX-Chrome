const catalog = globalThis.DialexCatalog;
const DEFAULT_DIALECT = catalog?.DEFAULT_DIALECT || "arabic_msa";
const DEFAULT_LANGUAGE = catalog?.DEFAULT_LANGUAGE || "arabic";
const MSA_DIALECT = "arabic_msa";
const DEFAULT_BACKEND_URL =
  "https://dialex-backend-f6b7-1086119311146.europe-west3.run.app";
const DIALEX_PAD_URL = "https://dialex-app.com/#pad";

let preferredDialect = DEFAULT_DIALECT;
let preferredLanguage = DEFAULT_LANGUAGE;
let autoTranslateEnabled = true;
let settingsReady = false;
let dialxActive = false;
let activePanelCleanup = null;
let domObserver = null;
let domObserverTarget = null;
let visibilityObserver = null;
let extensionWatchTimer = null;

const postStates = new Map();
const registeredPosts = new WeakSet();
const globalTranslationCache = new Map();
const pendingTranslationByKey = new Map();

const PRIORITY_MAIN_BODY = 20;
const PRIORITY_QUOTED = 8;
const PRIORITY_REPLY = 0;
const PRIORITY_FOCUSED_BONUS = 5;
const REPLY_REGISTER_DELAY_MS = 600;
const SCAN_DEBOUNCE_MS = 600;
const QUOTE_EXPAND_SCAN_DELAY_MS = 300;
const MAX_AUTO_TRANSLATE_PER_VISIBLE_BATCH = 3;
const MAX_UI_REGISTER_PER_SCAN = 12;
const INTERSECTION_VISIBLE_RATIO = 0.25;
const VISIBILITY_FLUSH_MS = 200;
const ARTICLE_UI_WATCH_DEBOUNCE_MS = 500;

let scanDebounceTimer = null;
let visibilityFlushTimer = null;
let scrollScanTimer = null;
let scrollScanListenerReady = false;
let suppressDomScan = false;
let lastScrollAt = 0;

const SCROLL_SCAN_DEBOUNCE_MS = 250;
// Hold off starting auto-translations until scrolling has settled, so posts
// that merely fly past the viewport during a fast scroll never get requested.
const SCROLL_SETTLE_MS = 350;

const MAX_CONCURRENT_TRANSLATIONS = 2;

const NON_FEED_REGION_SELECTOR = [
  '[data-testid="sidebarColumn"]',
  '[data-testid="secondaryColumn"]',
  '[data-testid="trend"]',
  '[data-testid="whoToFollow"]',
  '[data-testid="placementTracking"]',
  '[data-testid="userCell"]',
  '[data-testid="DMDrawer"]',
  '[data-testid="HoverCard"]',
  '[data-testid="twc-cc-mask"]',
  '[data-testid="inlinePrompt"]',
  '[data-testid="signupLanding"]',
  '[data-testid="carousel"]',
  '[role="dialog"]',
  '[aria-modal="true"]'
].join(",");
let activeTranslations = 0;
const translationQueue = [];

function dialectLabel(dialectId) {
  const id = catalog?.normalizeDialectId(dialectId) || dialectId;
  const dialect = catalog?.dialectById(id);
  if (!dialect) return dialectId || "";
  if (id === MSA_DIALECT) return `🌐 ${dialect.name}`;
  return dialect.name;
}

function dialectAbbrev(dialectId) {
  const id = catalog?.normalizeDialectId(dialectId) || dialectId;
  if (id === MSA_DIALECT) return "🌐 MSA";
  const dialect = catalog?.dialectById(id);
  if (!dialect) return dialectId || "";
  // Compact control-bar label
  return dialect.name.length > 18 ? dialect.name.slice(0, 16) + "…" : dialect.name;
}

function allDialectIds() {
  return (catalog?.dialects || []).filter((d) => !d.hidden).map((d) => d.id);
}

function injectDialxStyles() {
  if (!document.getElementById("dialex-manrope")) {
    const link = document.createElement("link");
    link.id = "dialex-manrope";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }
  let style = document.getElementById("dialx-styles");
  if (!style) {
    style = document.createElement("style");
    style.id = "dialx-styles";
    document.head.appendChild(style);
  }

  let logoUrl = "";
  try {
    logoUrl = chrome.runtime.getURL("DialectsOnX-logo.png");
  } catch {
    logoUrl = "";
  }

  style.textContent = `
    .dialx-control-bar {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      margin-top: 6px;
      font-size: 13px;
      position: relative;
      font-family: Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .dialx-translation {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      unicode-bidi: plaintext;
    }
    .dialx-overlay-showmore {
      color: rgb(29, 155, 240);
      cursor: pointer;
      white-space: nowrap;
    }
    .dialx-overlay-showmore:hover {
      text-decoration: underline;
    }
    .dialx-btn,
    .dialx-btn-sm {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      background: rgb(32, 35, 39);
      color: rgb(152, 157, 162);
      border: 1px solid rgb(47, 51, 54);
      cursor: pointer;
      font-weight: 500;
      font-size: 13px;
      font-family: inherit;
      line-height: 1.3;
      transition: background 0.15s ease, border-color 0.15s ease;
      box-sizing: border-box;
    }
    .dialx-btn-sm {
      padding: 3px 10px;
      font-size: 12px;
      border-radius: 9999px;
    }
    .dialx-btn-main {
      padding: 5px 14px;
      font-size: 14px;
    }
    .dialx-btn-selector {
      padding: 2px 9px;
      font-size: 11px;
    }
    .dialx-btn:hover,
    .dialx-btn-sm:hover:not(:disabled) {
      background: rgb(39, 43, 48);
      border-color: rgb(62, 68, 73);
    }
    .dialx-btn-sm:disabled {
      opacity: 0.55;
      cursor: default;
    }
    .dialx-logo {
      display: inline-block;
      height: 20px;
      width: 54px;
      margin-left: 4px;
      flex-shrink: 0;
      pointer-events: none;
      background-color: rgb(152, 157, 162);
      -webkit-mask-image: url("${logoUrl}");
      mask-image: url("${logoUrl}");
      -webkit-mask-repeat: no-repeat;
      mask-repeat: no-repeat;
      -webkit-mask-position: center;
      mask-position: center;
      -webkit-mask-size: contain;
      mask-size: contain;
      mask-mode: luminance;
    }
  `;
}

function globalCacheKey(text, dialect, statusId) {
  if (statusId) return `${dialect}\nstatus:${statusId}`;
  return `${dialect}\n${text}`;
}

function getStatusIdFromScope(root, excludeSubtree = null) {
  if (!root) return null;
  for (const link of root.querySelectorAll('a[href*="/status/"]')) {
    if (excludeSubtree && excludeSubtree.contains(link)) continue;
    const match = (link.getAttribute("href") || "").match(/\/status\/(\d+)/);
    if (match) return match[1];
  }
  return null;
}

function getTweetStatusId(article) {
  const quoteTweet = getEmbeddedQuoteContainer(article);

  const timeLink = article
    .querySelector("time[datetime]")
    ?.closest('a[href*="/status/"]');
  if (timeLink && (!quoteTweet || !quoteTweet.contains(timeLink))) {
    const match = (timeLink.getAttribute("href") || "").match(/\/status\/(\d+)/);
    if (match) return match[1];
  }

  return getStatusIdFromScope(article, quoteTweet);
}

function getQuotedTweetStatusId(article) {
  const quoteTweet = getEmbeddedQuoteContainer(article);
  if (!quoteTweet) return null;
  return getStatusIdFromScope(quoteTweet, null);
}

function isOnStatusDetailPage() {
  return /\/status\/\d+/.test(location.pathname);
}

function getPageMainStatusId() {
  const match = location.pathname.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

function getFocusedArticle() {
  const pageId = getPageMainStatusId();
  if (!pageId) return null;

  const matches = [];
  for (const article of getTweetArticles()) {
    if (isNestedQuoteArticle(article)) continue;
    if (getTweetStatusId(article) === pageId) matches.push(article);
  }
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  return (
    matches.find((a) => !matches.some((b) => b !== a && b.contains(a))) ||
    matches[0]
  );
}

/** Parent/ancestor tweets on a /status/ thread (above the focused comment). */
function isThreadAncestorArticle(article) {
  if (!isOnStatusDetailPage()) return false;
  const focused = getFocusedArticle();
  if (!focused || article === focused) return false;
  return Boolean(
    article.compareDocumentPosition(focused) & Node.DOCUMENT_POSITION_PRECEDING
  );
}

/** The tweet opened by the current /status/ URL (e.g. a comment you clicked). */
function isFocusedPostArticle(article) {
  const pageId = getPageMainStatusId();
  if (!pageId) return false;
  return getTweetStatusId(article) === pageId;
}

/** Replies below the focal tweet on a /status/ page. */
function isReplyBelowFocused(article) {
  if (!isOnStatusDetailPage()) return false;

  const focalCell = getStatusPageFocalCell();
  if (focalCell) {
    if (focalCell.contains(article)) return false;
    return Boolean(
      focalCell.compareDocumentPosition(article) & Node.DOCUMENT_POSITION_FOLLOWING
    );
  }

  const focused = getFocusedArticle();
  if (!focused || focused === article) return false;
  return Boolean(focused.compareDocumentPosition(article) & Node.DOCUMENT_POSITION_FOLLOWING);
}

/** Nested tweet card inside another post's quote - never register inline. */
function isNestedQuoteArticle(article) {
  const outer = article.parentElement?.closest?.('article[data-testid="tweet"]');
  if (!outer || outer === article) return false;
  const quote = getEmbeddedQuoteContainer(outer);
  return Boolean(quote?.contains(article));
}

function shouldRegisterArticle(article) {
  if (!isValidTweetArticle(article)) return false;
  if (!isInPrimaryFeed(article)) return false;
  if (isNestedQuoteArticle(article)) return false;
  if (isAdvertisement(article)) return false;
  return true;
}

function allArticlePostsAutoTranslated(article) {
  const postIds = getPostIdsForArticle(article);
  if (postIds.length === 0) return false;
  return postIds.every((id) => postStates.get(id)?.autoTranslated);
}

function maybeUnobserveArticle(article) {
  if (article && allArticlePostsAutoTranslated(article)) {
    visibilityObserver?.unobserve(article);
  }
}

function isPrimaryDetailPagePost(article) {
  if (!isOnStatusDetailPage()) return false;
  const pageId = getPageMainStatusId();
  return Boolean(pageId && getTweetStatusId(article) === pageId);
}

function getTargetPriority(target) {
  const { article, isQuoted } = target;
  if (isQuoted) return PRIORITY_QUOTED;
  if (isPrimaryDetailPagePost(article)) return PRIORITY_MAIN_BODY + 15;
  if (isReplyBelowFocused(article)) return PRIORITY_REPLY;
  let priority = PRIORITY_MAIN_BODY;
  if (isFocusedPostArticle(article)) priority += PRIORITY_FOCUSED_BONUS;
  if (isThreadAncestorArticle(article)) priority += PRIORITY_FOCUSED_BONUS;
  return priority;
}

function buildPostId(target) {
  const { article, isQuoted, statusId, el } = target;
  if (isQuoted) {
    const quoteId = getQuotedTweetStatusId(article) || statusId;
    if (quoteId) return `tweet-${quoteId}-quoted`;
    const mainId = statusId || getTweetStatusId(article);
    if (mainId) return `tweet-${mainId}-quoted`;
  } else {
    const mainId = statusId || getTweetStatusId(article);
    if (mainId) return `tweet-${mainId}-main`;
  }
  // No stable status id: reuse the id already assigned to this text element so
  // re-scans don't mint a fresh random id (and thus a duplicate bar) each time.
  if (el?.dataset?.postId) return el.dataset.postId;
  return `post-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getCacheStatusId(target) {
  if (target.isQuoted) {
    return getQuotedTweetStatusId(target.article) || target.statusId;
  }
  return target.statusId || getTweetStatusId(target.article);
}

function isElementInViewport(el, minVisibleRatio = 0) {
  if (!el?.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const visibleTop = Math.max(rect.top, 0);
  const visibleBottom = Math.min(rect.bottom, vh);
  const visibleLeft = Math.max(rect.left, 0);
  const visibleRight = Math.min(rect.right, vw);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  const visibleWidth = Math.max(0, visibleRight - visibleLeft);
  if (visibleHeight <= 0 || visibleWidth <= 0) return false;

  if (minVisibleRatio <= 0) return true;

  const visibleArea = visibleHeight * visibleWidth;
  const totalArea = rect.height * rect.width;
  return totalArea > 0 && visibleArea / totalArea >= minVisibleRatio;
}

function isPostVisible(state) {
  return Boolean(
    state?.postElement?.isConnected &&
    isElementInViewport(state.postElement, INTERSECTION_VISIBLE_RATIO)
  );
}

function shouldDelayRegistration(article) {
  return isReplyBelowFocused(article);
}

function mergeOriginalText(state, newText) {
  const prev = state.originalText;
  if (!newText || newText === prev) return;
  if (newText.length <= prev.length) return;

  if (newText.startsWith(prev)) {
    state.originalText = newText;
    return;
  }

  state.originalText = newText;
  state.translationCache.clear();
  state.autoTranslated = false;
}

/** Disabled - per-post subtree observers caused severe jank on scroll. */
function protectTranslatedPost(_state) {}

function isExtensionContextValid() {
  try {
    return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function isValidDialect(dialect) {
  return Boolean(catalog?.isValidDialect(dialect));
}

function normalizeStoredDialect(dialect) {
  return catalog?.normalizeDialectId(dialect) || null;
}

function normalizeStoredLanguage(language) {
  return catalog?.resolveLanguageId(language) || null;
}

function canOperate() {
  return (
    dialxActive &&
    settingsReady &&
    isExtensionContextValid()
  );
}

function canAutoTranslate() {
  return canOperate() && autoTranslateEnabled;
}

function loadSettings() {
  return new Promise((resolve) => {
    if (!isExtensionContextValid()) {
      dialxActive = false;
      settingsReady = false;
      resolve();
      return;
    }

    chrome.storage.sync.get(
      {
        preferredDialect: DEFAULT_DIALECT,
        preferredLanguage: DEFAULT_LANGUAGE,
        autoTranslate: true
      },
      (data) => {
        if (chrome.runtime.lastError || !isExtensionContextValid()) {
          dialxActive = false;
          settingsReady = false;
          resolve();
          return;
        }

        dialxActive = true;
        const migrated = normalizeStoredDialect(data.preferredDialect) || DEFAULT_DIALECT;
        preferredDialect = migrated;
        preferredLanguage =
          normalizeStoredLanguage(data.preferredLanguage) ||
          catalog?.dialectById(migrated)?.languageId ||
          DEFAULT_LANGUAGE;
        autoTranslateEnabled = data.autoTranslate !== false;
        settingsReady = true;

        if (data.preferredDialect !== migrated || !data.preferredLanguage) {
          chrome.storage.sync.set({
            preferredDialect: migrated,
            preferredLanguage
          });
        }
        resolve();
      }
    );
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !isExtensionContextValid()) return;

  if (changes.preferredDialect?.newValue) {
    const next = normalizeStoredDialect(changes.preferredDialect.newValue);
    if (next) preferredDialect = next;
  }
  if (changes.preferredLanguage?.newValue) {
    preferredLanguage = changes.preferredLanguage.newValue || DEFAULT_LANGUAGE;
  }
  if (changes.autoTranslate) {
    autoTranslateEnabled = changes.autoTranslate.newValue !== false;
    if (!autoTranslateEnabled) {
      postStates.forEach((state) => {
        if (state.autoTranslatePending && state.abortController) {
          state.abortController.abort();
          state.autoTranslatePending = false;
          state.abortController = null;
        }
        if (state.article) visibilityObserver?.unobserve(state.article);
      });
    } else if (canOperate()) {
      document.querySelectorAll('article[data-testid="tweet"][data-dialx-observed="1"]').forEach(
        (article) => {
          visibilityObserver?.observe(article);
        }
      );
    }
  }
});

function clearTranslationQueue() {
  while (translationQueue.length > 0) {
    const { reject } = translationQueue.shift();
    reject(new DOMException("DialectsOnX inactive", "AbortError"));
  }
  activeTranslations = 0;
}

function removeAllDialxUi() {
  document.querySelectorAll(".dialx-control-bar").forEach((bar) => bar.remove());
  document.getElementById("dialect-panel")?.remove();

  document.querySelectorAll("article[data-dialx-observed]").forEach((article) => {
    delete article.dataset.dialxObserved;
  });
  document.querySelectorAll('[data-testid="tweetText"][data-post-id]').forEach((el) => {
    delete el.dataset.postId;
    el.removeAttribute("data-dialx-ignore-mutations");
  });
}

function shutdownDialx() {
  dialxActive = false;
  settingsReady = false;
  suppressDomScan = true;

  domObserver?.disconnect();
  domObserver = null;
  domObserverTarget = null;
  visibilityObserver?.disconnect();
  visibilityObserver = null;

  if (replyRegisterTimer) {
    clearTimeout(replyRegisterTimer);
    replyRegisterTimer = null;
  }
  if (scanDebounceTimer) {
    clearTimeout(scanDebounceTimer);
    scanDebounceTimer = null;
  }
  if (scrollScanTimer) {
    clearTimeout(scrollScanTimer);
    scrollScanTimer = null;
  }
  if (visibilityFlushTimer) {
    clearTimeout(visibilityFlushTimer);
    visibilityFlushTimer = null;
  }

  pendingTranslationByKey.clear();

  for (const article of watchedArticles) {
    disconnectArticleWatcher(article);
  }
  watchedArticles.clear();

  postStates.forEach((state) => {
    state.translationObserver?.disconnect();
    state.translationObserver = null;
    if (state.autoTranslatePending && state.abortController) {
      state.abortController.abort();
      state.autoTranslatePending = false;
      state.abortController = null;
    }
  });
  postStates.clear();

  clearTranslationQueue();
  activePanelCleanup?.();
  removeAllDialxUi();
}

function watchExtensionContext() {
  if (extensionWatchTimer) return;

  extensionWatchTimer = setInterval(() => {
    if (!isExtensionContextValid()) {
      shutdownDialx();
      clearInterval(extensionWatchTimer);
      extensionWatchTimer = null;
    }
  }, 1500);
}

function runQueuedTranslation(task, priority = PRIORITY_REPLY) {
  if (!canOperate()) {
    return Promise.reject(new DOMException("DialectsOnX inactive", "AbortError"));
  }

  return new Promise((resolve, reject) => {
    translationQueue.push({ task, resolve, reject, priority });
    translationQueue.sort((a, b) => b.priority - a.priority);
    drainTranslationQueue();
  });
}

function drainTranslationQueue() {
  while (
    canOperate() &&
    activeTranslations < MAX_CONCURRENT_TRANSLATIONS &&
    translationQueue.length > 0
  ) {
    const { task, resolve, reject } = translationQueue.shift();
    activeTranslations++;
    task()
      .then(resolve, reject)
      .finally(() => {
        activeTranslations--;
        drainTranslationQueue();
      });
  }
}

function getTranslateEndpoint() {
  return `${DEFAULT_BACKEND_URL}/translate`;
}

async function translateText(text, targetDialect, signal, clientSource = "clip") {
  if (!canOperate()) {
    throw new DOMException("DialectsOnX inactive", "AbortError");
  }

  const dialectId = normalizeStoredDialect(targetDialect) || targetDialect;

  try {
    const response = await fetch(getTranslateEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        target_dialect: dialectId,
        source_language: "auto",
        client_source: clientSource
      }),
      signal
    });
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const err = await response.json();
        detail = err.detail?.detail || err.detail || err.error || detail;
        if (typeof detail !== "string") detail = JSON.stringify(detail);
      } catch {
        /* ignore */
      }
      console.error("Translation error:", detail);
      throw new Error(detail);
    }
    const data = await response.json();
    return data.translation;
  } catch (e) {
    if (e.name === "AbortError") throw e;
    console.error("Translation error:", e);
    throw e;
  }
}

function getCachedTranslation(state, dialect) {
  if (state.translationCache.has(dialect)) {
    return state.translationCache.get(dialect);
  }

  const cacheId = state.cacheStatusId || state.statusId;
  if (cacheId) {
    const statusKey = globalCacheKey(null, dialect, cacheId);
    if (globalTranslationCache.has(statusKey)) {
      const cached = globalTranslationCache.get(statusKey);
      state.translationCache.set(dialect, cached);
      return cached;
    }
  }

  const globalKey = globalCacheKey(state.originalText, dialect);
  if (globalTranslationCache.has(globalKey)) {
    const cached = globalTranslationCache.get(globalKey);
    state.translationCache.set(dialect, cached);
    return cached;
  }
  return null;
}

function storeTranslation(state, dialect, translated) {
  state.translationCache.set(dialect, translated);
  const cacheId = state.cacheStatusId || state.statusId;
  if (cacheId) {
    globalTranslationCache.set(globalCacheKey(null, dialect, cacheId), translated);
  }
  globalTranslationCache.set(globalCacheKey(state.originalText, dialect), translated);
}

async function fetchTranslation(state, dialect, signal) {
  if (!canOperate()) {
    throw new DOMException("DialectsOnX inactive", "AbortError");
  }

  const cached = getCachedTranslation(state, dialect);
  if (cached) return cached;

  const cacheId = state.cacheStatusId || state.statusId;
  const pendingKey = cacheId
    ? `${cacheId}:${dialect}`
    : `${dialect}\n${state.originalText}`;

  if (pendingTranslationByKey.has(pendingKey)) {
    return pendingTranslationByKey.get(pendingKey);
  }

  const request = translateText(state.originalText, dialect, signal, "clip")
    .then((translated) => {
      storeTranslation(state, dialect, translated);
      return translated;
    })
    .catch((e) => {
      if (e.name === "AbortError") throw e;
      console.error("DialectsOnX translation failed:", e);
      return null;
    })
    .finally(() => {
      pendingTranslationByKey.delete(pendingKey);
    });

  pendingTranslationByKey.set(pendingKey, request);
  return request;
}

function applyTranslated(state, dialect) {
  const translated = getCachedTranslation(state, dialect);
  if (!translated || !state.postElement) return false;

  // Posts truncated with a "Show more" (inside the text node OR next to it) use
  // an overlay so X's native inline expansion keeps working; everything else is
  // replaced in place.
  if (state.useOverlay === undefined) {
    state.useOverlay = Boolean(findPostShowMore(state));
  }
  if (state.useOverlay) return applyTranslatedOverlay(state, dialect, translated);

  // Idempotent: skip the DOM write when the translation is already on screen.
  // Comparing against the normalized read-back avoids redundant writes (and
  // flicker) during the frequent re-scans that keep status pages in sync.
  const alreadyShown =
    state.activeDialect === dialect &&
    !state.showingOriginal &&
    state.appliedHtml != null &&
    state.postElement.innerHTML === state.appliedHtml;

  if (!alreadyShown) {
    suppressDomScan = true;
    // On the timeline, permanently ignore mutations to translated posts for
    // performance. On /status/ pages we must keep detecting X's re-renders so a
    // reverted main/ancestor post can recover, so we rely on suppressDomScan
    // (frame-scoped) instead of the permanent flag there.
    if (!isOnStatusDetailPage()) {
      state.postElement.setAttribute("data-dialx-ignore-mutations", "1");
    }
    state.postElement.innerHTML = translated;
    state.appliedHtml = state.postElement.innerHTML;
    requestAnimationFrame(() => {
      suppressDomScan = false;
    });
  }

  state.activeDialect = dialect;
  state.showingOriginal = false;
  state.autoTranslated = true;
  state.updateMainButton?.();
  return true;
}

/** Hide X's real tweet-text node while leaving it in the DOM (React-controlled). */
function hideOriginalTextNode(tt) {
  tt.style.setProperty("display", "none", "important");
}

function showOriginalTextNode(tt) {
  tt.style.removeProperty("display");
}

/**
 * Overlay rendering for truncated posts. X's tweet-text element is left intact
 * (so its native inline "Show more" expansion keeps working) but hidden, and our
 * translated copy is shown right after it. The copy carries a "Show more" that
 * triggers X's real expansion, then re-translates the now-complete text.
 */
function applyTranslatedOverlay(state, dialect, translated) {
  const tt = state.postElement;
  if (!tt?.parentNode) return false;
  // Don't fight an in-progress expansion that is intentionally showing the real
  // text node; expandAndRetranslate re-applies the overlay when it finishes.
  if (state.expanding) return true;

  suppressDomScan = true;

  if (!state.transEl) {
    state.transEl = document.createElement("div");
  }
  const trans = state.transEl;
  // Borrow X's own text classes so the translation matches the tweet styling, and
  // copy the resolved text color so it stays readable in light and dark themes.
  trans.className = `${tt.className} dialx-translation`.trim();
  trans.setAttribute("dir", "auto");
  const ttColor = getComputedStyle(tt).color;
  if (ttColor) trans.style.color = ttColor;

  // Keep the overlay directly after the (current) text node, and the control
  // bar after the overlay - even if X swapped the text node on a re-render.
  if (trans.previousSibling !== tt) tt.after(trans);
  if (state.bar && tt.contains(state.bar)) trans.after(state.bar);

  if (state.overlayDialect !== dialect || state.overlayText !== translated) {
    renderOverlayContent(state, translated);
    state.overlayDialect = dialect;
    state.overlayText = translated;
  }

  hideOriginalTextNode(tt);
  // A "Show more" rendered as a SIBLING (outside the text node) would stay
  // visible; hide it so only our overlay "Show more" shows. (One inside the text
  // node is already hidden along with it.)
  const native = findPostShowMore(state);
  if (native && !tt.contains(native) && !state.fullyExpanded) {
    native.style.setProperty("display", "none", "important");
    state.nativeShowMore = native;
  }
  trans.style.display = "";

  requestAnimationFrame(() => {
    suppressDomScan = false;
  });

  state.activeDialect = dialect;
  state.showingOriginal = false;
  state.autoTranslated = true;
  state.updateMainButton?.();
  return true;
}

function renderOverlayContent(state, translated) {
  const trans = state.transEl;
  if (!trans) return;
  trans.textContent = translated;

  // Offer expansion only while the original is still truncated.
  if (!state.fullyExpanded && findPostShowMore(state)) {
    trans.appendChild(document.createTextNode(" "));
    const more = document.createElement("span");
    more.className = "dialx-overlay-showmore";
    more.setAttribute("role", "button");
    more.setAttribute("tabindex", "0");
    more.textContent = "Show more";
    const run = (e) => {
      e.preventDefault();
      e.stopPropagation();
      expandAndRetranslate(state);
    };
    more.addEventListener("click", run);
    more.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") run(e);
    });
    trans.appendChild(more);
  }
}

/**
 * Triggered by OUR overlay "Show more": reveal X's real full text via its native
 * control, then translate the complete text and swap it back into the overlay.
 */
async function expandAndRetranslate(state) {
  if (!canOperate()) return;
  let tt = state.postElement;
  if (!tt?.isConnected) return;
  const parent = tt.parentNode;
  const nativeShowMore = findPostShowMore(state);
  if (!nativeShowMore) return;

  // X may update the text node in place OR swap in a brand-new tweetText node on
  // expansion, so always re-query the current node within the same parent.
  const currentTextNode = () =>
    (tt && tt.isConnected ? tt : null) ||
    parent?.querySelector('[data-testid="tweetText"]') ||
    null;

  state.expanding = true;
  try {
    // Reveal the real text + the native control so X can expand it (and innerText
    // reads correctly).
    showOriginalTextNode(tt);
    nativeShowMore.style.removeProperty("display");
    if (state.transEl) state.transEl.style.display = "none";

    const before = (tt.textContent || "").length;
    nativeShowMore.click();

    const grewNode = await new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        const cur = currentTextNode();
        if (cur && (cur.textContent || "").length > before + 3) return resolve(cur);
        if (performance.now() - start > 1500) return resolve(null);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    const cur = grewNode || currentTextNode();
    if (!cur?.isConnected) return; // navigated away - destination handles it
    tt = cur;
    state.postElement = cur;
    showOriginalTextNode(cur);

    if (!grewNode) {
      hideOriginalTextNode(cur);
      if (state.transEl) state.transEl.style.display = "";
      return;
    }

    state.fullyExpanded = true;
    const full = stripShowMoreLabel((cur.innerText || cur.textContent || "").trim());
    if (full && full.length > (state.originalText?.length || 0)) {
      state.originalText = full;
      invalidatePostStatusCache(state);
    }

    // Keep the now-expanded original visible as a loading state while we fetch.
    const dialect = state.activeDialect || resolvePostDialect(state);
    try {
      await runQueuedTranslation(
        () => fetchTranslation(state, dialect),
        state.priority ?? PRIORITY_REPLY
      );
    } catch (_) {
      return; // leave the expanded original visible on failure
    }
    if (!state.postElement?.isConnected || state.showingOriginal) return;
    const translated = getCachedTranslation(state, dialect);
    if (translated) {
      state.expanding = false;
      applyTranslatedOverlay(state, dialect, translated);
    }
  } finally {
    state.expanding = false;
  }
}

/** Skip promoted / sponsored posts on X. */
/** "Boosted" posts are organic posts the author paid to amplify (not ads). */
function isBoostedPost(article) {
  if (!article) return false;
  const social = article.querySelector('[data-testid="socialContext"]');
  if (social && /\bboosted\b/i.test(social.innerText || "")) return true;
  const aria = article.getAttribute("aria-label") || "";
  return /\bboosted\b/i.test(aria);
}

function isAdvertisement(article) {
  if (!article) return false;

  // Boosted posts must be treated as normal posts (UI buttons + dialect
  // translation), so never classify them as ads - this overrides every ad
  // signal below.
  if (isBoostedPost(article)) return false;

  // NOTE: do NOT treat a descendant [data-testid="placementTracking"] as an ad -
  // X wraps the video/media player of ordinary posts in it for impression
  // tracking. Real promoted posts have it as an ANCESTOR, which isInPrimaryFeed
  // already filters out via NON_FEED_REGION_SELECTOR.
  if (article.querySelector('[data-testid="promotedIndicator"]')) return true;

  const social = article.querySelector('[data-testid="socialContext"]');
  if (social) {
    const label = social.innerText.trim().toLowerCase();
    if (label === "ad" || label.startsWith("promoted")) return true;
  }

  const aria = article.getAttribute("aria-label")?.toLowerCase() || "";
  if (aria.includes("advertisement") || aria.includes("promoted")) return true;

  return false;
}

const NEWS_ACCOUNT_PATTERNS = [
  /reuters/i,
  /cnn/i,
  /bbcbreaking/i,
  /bbchd/i,
  /bbcarabic/i,
  /apnews/i,
  /nytimes/i,
  /washingtonpost/i,
  /foxnews/i,
  /skynews/i,
  /alarabiya/i,
  /ajenglish/i,
  /ajarabic/i,
  /mbcalerts/i,
  /whitehouse/i,
  /gov_uk/i,
  /eu_commission/i,
  /nbcnews/i,
  /abcnews/i,
  /cbsnews/i,
  /guardian/i,
  /haaretz/i,
  /timesofisrael/i,
  /france24/i,
  /dwnews/i,
  // Additional popular / regional outlets and agencies (distinctive handles only)
  /aljazeera/i,
  /ajplus/i,
  /alhadath/i,
  /alekhbariya/i,
  /skynewsarabia/i,
  /bloomberg/i,
  /wsj/i,
  /cnbc/i,
  /msnbc/i,
  /economist/i,
  /politico/i,
  /axios/i,
  /thehill/i,
  /newsweek/i,
  /usatoday/i,
  /latimes/i,
  /telegraph/i,
  /dailymail/i,
  /huffpost/i,
  /buzzfeednews/i,
  /propublica/i,
  /sputnik/i,
  /trtworld/i,
  /trtarabi/i,
  /middleeasteye/i,
  /scmp/i,
  /elpais/i,
  /lemonde/i,
  /spiegel/i
];

const ARABIC_OFFICIAL_TEXT_PATTERNS = [
  /(?:^|[\s،.])وزارة[\s،.]/,
  /(?:^|[\s،.])حكومة[\s،.]/,
  /(?:^|[\s،.])بيان\s+رسمي/,
  /(?:^|[\s،.])تقرير\s+رسمي/,
  /(?:^|[\s،.])رئيس\s+الجمهورية/
];

const NEWS_WIRE_TEXT_PATTERNS = [
  /^News Alert:\s/i,
  /^OFFICIAL:\s/i,
  /^Press release:\s/i,
  /^بيان\s+رسمي[:\s]/
];

/** Known news domains shown on a post's link/source card (visible text only). */
const NEWS_DOMAIN_PATTERN =
  /\b(?:reuters\.com|bbc\.(?:co\.uk|com)|cnn\.com|aljazeera\.(?:net|com)|apnews\.com|nytimes\.com|washingtonpost\.com|theguardian\.com|foxnews\.com|skynews(?:arabia)?\.[a-z.]+|alarabiya\.net|alhadath\.[a-z.]+|alekhbariya\.[a-z.]+|bloomberg\.com|wsj\.com|ft\.com|cnbc\.com|nbcnews\.com|abcnews\.go\.com|cbsnews\.com|npr\.org|politico\.com|axios\.com|thehill\.com|newsweek\.com|usatoday\.com|latimes\.com|telegraph\.co\.uk|dailymail\.co\.uk|france24\.com|dw\.com|rt\.com|sputnik[a-z]*\.[a-z.]+|trtworld\.com|middleeasteye\.net|scmp\.com|spa\.gov\.sa|wam\.ae|qna\.org\.qa)/i;

/** Arabic newswire lead-ins / attributions commonly used in reporting. */
const NEWS_ARABIC_LEAD_PATTERNS = [
  /(?:^|[\s،.])أفادت\b/,
  /ذكرت\s+وكالة/,
  /نقل(?:اً|ًا|ا)\s+عن/,
  /في\s+بيان\b/,
  /(?:^|[\s،.])أعلنت\b/,
  /(?:^|[\s،.])صرّ?ح\b/
];

const NEWS_HANDLE_HINTS =
  /(?:^|_)(?:news|alerts?|breaking|media|press|times|herald|tribune|journal|broadcast|wire|gazette|post)(?:$|_)/i;

const NEWS_DISPLAY_NAME_HINTS =
  /\b(news|alert|media|press|reuters|cnn|bbc|associated press|fox news|sky news|ny times|guardian)\b/i;

/**
 * News keywords matched in the account display name or @username. The "news"
 * and "journal" tokens match anywhere (substring); the more ambiguous outlet
 * words (post, times, daily, …) are word-anchored so they don't trip on names
 * like "postman" or "sometimes". Arabic terms are distinctive enough as-is.
 */
const NEWS_NAME_KEYWORDS =
  /news|journal|\b(?:tv|radio|times|post|tribune|gazette|herald|daily|press|media)\b|أخبار|جريدة|وكالة|الآن|عاجل|قناة|صحيفة|تلفزيون|إذاعة/i;

/**
 * Fan / personal / podcast / band accounts that merely append "News" to a
 * non-official name (e.g. "Joe Rogan Podcast News", "Elon Musk News"). These
 * should stay normal posts, so the weak name-keyword signal is suppressed.
 */
const NON_OFFICIAL_NAME_HINTS =
  /\b(podcast|fan|fans|fanpage|stan|band|tour|updates?|tracker|comedian|comedy|musician|rapper|singer|songwriter|dj|gamer|streamer|youtuber|influencer|highlights?|clips?)\b/i;

/**
 * Title-Case "Firstname Lastname … News" - a human/personal name in front of
 * the news word. Real outlets use a brand or acronym (BBC, Fox, Sky), not a
 * two-part human name, so requiring two Title-Case words (case-sensitive, no
 * /i flag) avoids matching them. "Fox News" / "Sky News" have only one word
 * before "News" and are not affected.
 */
const PERSON_PREFIXED_NEWS_NAME =
  /^[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Za-z'’]+)*\s+[Nn]ews\b/;

function isNonOfficialNewsName(name) {
  if (!name) return false;
  return NON_OFFICIAL_NAME_HINTS.test(name) || PERSON_PREFIXED_NEWS_NAME.test(name);
}

const PARODY_HANDLE_HINTS =
  /(parody|satire|comedy|comedian|meme|memes|joke|jokes|funny|humou?r|shitpost|not.?real|fake.?news|clickbait)/i;

const PARODY_PROFILE_HINTS =
  /\b(parody|satire|comedy account|comedian|not real|fake\b|joke\b|meme page|shitpost)\b/i;

/** Obvious joke / sarcasm - exempt from BREAKING: → MSA. */
const PARODY_BREAKING_TEXT_PATTERNS = [
  /\b(lol|lmao|rofl|lmfao|haha|hehe|jk|just kidding)\b/i,
  /\b(parody|satire|sarcas|joke|meme|shitpost|the onion)\b/i,
  /(?:^|\s)[/\\]s(?:\s|$)/i,
  /[🤣😂💀😭🙄]/,
  /^BREAKING:\s*(my |i'm |i am |i just |i cant |i can't |me when|nobody|no one|still waiting)/i,
  /^BREAKING:\s*(local (man|woman|dad|mom|kid|cat|dog)|sources say i )/i,
  /^BREAKING:\s*(i (finally|literally|officially)|when you|can't believe i)/i,
  /^BREAKING:\s*[^.!?]{0,50}(pizza|coffee|bed|wifi|homework|monday|friday|laundry)\b/i
];

function hasNewsSocialContext(article) {
  const social = article.querySelector('[data-testid="socialContext"]');
  if (!social) return false;
  const ctx = social.innerText.trim().toLowerCase();
  return /^(news|official|government)\b/.test(ctx) || /\bnews\s*·|·\s*news\b/.test(ctx);
}

function getAuthorHandle(article) {
  const userNameBlock = article.querySelector('[data-testid="User-Name"]');
  if (!userNameBlock) return null;

  for (const link of userNameBlock.querySelectorAll('a[href^="/"]')) {
    const handle = (link.getAttribute("href") || "").replace(/^\//, "").split("/")[0];
    if (
      handle &&
      !["home", "explore", "notifications", "messages", "search", "i"].includes(handle)
    ) {
      return handle;
    }
  }
  return null;
}

function isKnownNewsAccount(handle) {
  return Boolean(handle && NEWS_ACCOUNT_PATTERNS.some((pattern) => pattern.test(handle)));
}

/**
 * News keyword in the visible display name or @username (e.g. "news", "journal",
 * "أخبار", "جريدة", "وكالة", "الآن", "عاجل"). The User-Name block's text holds
 * both the display name and the handle, so one read covers both.
 */
function hasNewsNameKeyword(article) {
  const block = article.querySelector('[data-testid="User-Name"]');
  const text = block?.innerText || "";
  if (!NEWS_NAME_KEYWORDS.test(text)) return false;

  // The display name (first line) is where fan/personal accounts append "News".
  // If it's a celebrity/podcast/band-style name, don't treat it as official.
  const displayName = text.split("\n")[0].trim();
  if (isNonOfficialNewsName(displayName)) return false;

  return true;
}

/** The post links to a known news domain via its link/source card. */
function hasNewsLinkCard(article) {
  const card = article.querySelector('[data-testid="card.wrapper"]');
  if (!card) return false;
  return NEWS_DOMAIN_PATTERN.test(card.innerText || "");
}

function isVerifiedAccount(article) {
  return Boolean(
    article.querySelector('[data-testid="icon-verified"]') ||
    article.querySelector('[aria-label*="Verified"]')
  );
}

/** True when the text is predominantly Arabic script. */
function isArabicText(text) {
  if (!text) return false;
  const arabic = (
    text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []
  ).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  if (arabic === 0) return false;
  return arabic >= latin;
}

/**
 * Classify the verification badge by its rendered color:
 *   "gold"  → business / organization (yellow badge)
 *   "gray"  → government / official    (gray/silver badge)
 *   "blue"  → individual / Premium
 * Returns null when the account isn't verified.
 */
function getVerifiedBadgeType(article) {
  const userName = article.querySelector('[data-testid="User-Name"]');
  const icon = userName?.querySelector('svg[data-testid="icon-verified"]');
  if (!icon) return null;

  // Gold/business badges are the only ones painted with a gradient fill
  // (fill="url(#...)"). Blue and gray badges have no gradient.
  if (icon.querySelector('linearGradient, radialGradient, [fill^="url("]')) {
    return "gold";
  }

  // Blue (individual/Premium) renders in a distinct blue; gray/official uses the
  // default light icon color (rgb(231,233,234)) with no gradient.
  let color = "";
  try {
    color = getComputedStyle(icon).color;
  } catch {
    return "blue";
  }
  const m = color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    const r = +m[1], g = +m[2], b = +m[3];
    if (b > r + 40 && b > 150) return "blue";
  }
  return "gray";
}

/** Verified outlet-style account (not a random user yelling BREAKING). */
function isMediaOutletAccount(article, handle) {
  if (!handle || !isVerifiedAccount(article)) return false;
  if (NEWS_HANDLE_HINTS.test(handle)) return true;

  const userNameBlock = article.querySelector('[data-testid="User-Name"]');
  const profileText = userNameBlock?.innerText || "";
  return NEWS_DISPLAY_NAME_HINTS.test(profileText);
}

function hasBreakingPrefix(text) {
  return /^BREAKING:\s/i.test(text);
}

function isObviousParodyOrComedy(article, text, handle) {
  if (handle && PARODY_HANDLE_HINTS.test(handle)) return true;

  const userNameBlock = article.querySelector('[data-testid="User-Name"]');
  const profileText = userNameBlock?.innerText || "";
  if (PARODY_PROFILE_HINTS.test(profileText)) return true;

  return PARODY_BREAKING_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

/** BREAKING: is a strong news wire signal unless clearly parody/comedy. */
function isBreakingNewsPost(article, text, handle) {
  if (!hasBreakingPrefix(text)) return false;

  if (
    hasNewsSocialContext(article) ||
    isKnownNewsAccount(handle) ||
    isMediaOutletAccount(article, handle)
  ) {
    return true;
  }

  if (isObviousParodyOrComedy(article, text, handle)) return false;

  return true;
}

/** News/official: badges, UI labels, known outlets, wire prefixes, BREAKING: (minus parody). */
function isNewsOrOfficialPost(article, text) {
  if (hasNewsSocialContext(article)) return true;

  // Gray/silver (government/official) verified accounts always default to MSA.
  // Gold/business accounts are intentionally NOT treated as official.
  if (getVerifiedBadgeType(article) === "gray") return true;

  const handle = getAuthorHandle(article);
  if (isKnownNewsAccount(handle)) return true;

  if (hasNewsNameKeyword(article)) return true;

  if (hasNewsLinkCard(article)) return true;

  if (ARABIC_OFFICIAL_TEXT_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  if (NEWS_ARABIC_LEAD_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  if (NEWS_WIRE_TEXT_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  if (isBreakingNewsPost(article, text, handle)) {
    return true;
  }

  return false;
}

function getAutoTranslateDialect(state) {
  if (state.isNews) return MSA_DIALECT;
  return isValidDialect(preferredDialect) ? preferredDialect : DEFAULT_DIALECT;
}

function findShowMoreElement(article, tweetTextEl) {
  const quoteScope = tweetTextEl.closest('[data-testid="quoteTweet"]');
  // When placing the MAIN post's bar, ignore a "show more" that belongs to the
  // embedded quote - otherwise the main bar lands inside the quote card.
  const quoteContainer = quoteScope ? null : getEmbeddedQuoteContainer(article);
  for (const link of (quoteScope || article).querySelectorAll(
    '[data-testid="tweet-text-show-more-link"]'
  )) {
    if (quoteContainer?.contains(link)) continue;
    return link;
  }

  const tweetRoot = getTweetRoot(article);
  const scope = quoteScope || tweetTextEl.parentElement || tweetRoot;

  for (const el of scope.querySelectorAll('a, button, [role="button"]')) {
    const label = el.innerText.trim().toLowerCase();
    if (label === "show more" || label === "read more") {
      if (tweetTextEl.contains(el) || el.compareDocumentPosition(tweetTextEl) & Node.DOCUMENT_POSITION_PRECEDING) {
        return el;
      }
    }
  }

  let sibling = tweetTextEl.nextElementSibling;
  while (sibling && sibling !== tweetRoot) {
    const directLabel = sibling.innerText?.trim().toLowerCase();
    if (directLabel === "show more" || directLabel === "read more") {
      return sibling.matches("a,button,[role='button']")
        ? sibling
        : sibling.querySelector("a,button,[role='button']") || sibling;
    }
    const nested = sibling.querySelector("a,button,[role='button']");
    if (nested) {
      const nestedLabel = nested.innerText.trim().toLowerCase();
      if (nestedLabel === "show more" || nestedLabel === "read more") {
        return nested;
      }
    }
    sibling = sibling.nextElementSibling;
  }

  return null;
}

/** A "Show more" / "See more" affordance rendered INSIDE the tweet text node. */
function findInlineShowMore(textEl) {
  if (!textEl) return null;
  const byId = textEl.querySelector('[data-testid="tweet-text-show-more-link"]');
  if (byId) return byId;
  for (const el of textEl.querySelectorAll('a, button, [role="button"]')) {
    if (/^(show|see|read)\s+more$/i.test(el.innerText.trim())) return el;
  }
  return null;
}

/**
 * The post's "Show more" affordance, whether it sits INSIDE the tweet-text node
 * or as a SIBLING next to it (X renders it both ways). Used to decide overlay
 * mode and to drive native inline expansion.
 */
function findPostShowMore(state) {
  const tt = state.postElement;
  if (!tt) return null;
  const inside = findInlineShowMore(tt);
  if (inside) return inside;
  const article = state.article || tt.closest("article");
  return article ? findShowMoreElement(article, tt) : null;
}

/** Drop a trailing "Show more"/"See more" label so it isn't sent for translation. */
function stripShowMoreLabel(text) {
  return (text || "").replace(/\s*(show|see|read)\s+more\s*$/i, "").trim();
}

/** Forget cached translations of the truncated text so the full text is re-fetched. */
function invalidatePostStatusCache(state) {
  state.translationCache.clear();
  const cacheId = state.cacheStatusId || state.statusId;
  if (!cacheId) return;
  for (const dialect of allDialectIds()) {
    globalTranslationCache.delete(globalCacheKey(null, dialect, cacheId));
  }
}

/**
 * Anchor the control bar after the tweet text. A "Show more" that lives INSIDE
 * the text node is not a valid anchor (the bar would be hidden when we overlay
 * the translation), so in that case we anchor after the text node itself. If a
 * translation overlay has been injected, the bar belongs after the overlay.
 */
function getControlBarAnchor(tweetTextEl, article) {
  const overlay = tweetTextEl.nextElementSibling;
  if (overlay && overlay.classList?.contains("dialx-translation")) return overlay;
  const showMore = findShowMoreElement(article, tweetTextEl);
  if (showMore && !tweetTextEl.contains(showMore)) return showMore;
  return tweetTextEl;
}

function insertControlBar(tweetTextEl, bar, article) {
  getControlBarAnchor(tweetTextEl, article).after(bar);
}

function repositionControlBar(tweetTextEl, bar, article) {
  const anchor = getControlBarAnchor(tweetTextEl, article);
  if (bar.previousElementSibling === anchor) return;
  anchor.after(bar);
}

const EXCLUDED_ANCESTOR_TESTIDS = new Set([
  "socialContext",
  "card.wrapper",
  "placementTracking",
  "tweet-analytics",
  "app-text-transition-container",
  "sidebarColumn",
  "DMDrawer",
  "trend",
  "whoToFollow",
  "userCell"
]);

const UI_TEXT_PATTERNS = [
  /^options$/i,
  /^replying to\b/i,
  /^show this thread$/i,
  /^translate post$/i,
  /^view post engagements$/i,
  /^read (more|replies)$/i,
  /^show more$/i,
  /^view quotes$/i,
  /^copy link$/i,
  /^embed post$/i,
  /^not interested/i,
  /^mute\b/i,
  /^block\b/i,
  /^report/i,
  /^follow$/i,
  /^unfollow$/i,
  /^promoted$/i,
  /^ad$/i,
  /^(re)?post(ed)?$/i,
  /^\d+\s*(s|m|h|d|w)$/i,
  /^\d+\s*(sec|second|min|minute|hour|day|week|month|year)s?\s*ago$/i,
  /^@\w+$/,
  /^·$/
];

function isUiChromeText(text) {
  const t = text.trim();
  if (!t) return true;
  if (/^https?:\/\/\S+$/i.test(t)) return true;
  if (/^\d+[\d,.KMB\s]*$/.test(t)) return true;
  return UI_TEXT_PATTERNS.some((pattern) => pattern.test(t));
}

function getPrimaryColumn() {
  return document.querySelector('[data-testid="primaryColumn"]');
}

/** Middle timeline column only - not sidebars, trends, ads, or modals. */
function isInPrimaryFeed(el) {
  if (!el?.isConnected) return false;
  const primary = getPrimaryColumn();
  if (!primary || !primary.contains(el)) return false;
  if (el.closest(NON_FEED_REGION_SELECTOR)) return false;
  return true;
}

function getTweetCell(root) {
  if (!root) return null;
  return (
    root.closest('[data-testid="cellInnerDiv"]') ||
    root.closest('[data-testid="tweetDetail"]') ||
    root
  );
}

/** Real X post/comment shell - excludes sidebars and non-tweet shells. */
function isValidTweetArticle(article) {
  if (!article || article.getAttribute("data-testid") !== "tweet") return false;
  const cell = getTweetCell(article);
  if (isAdvertisement(article) || (cell && isAdvertisement(cell))) return false;
  const hasUser =
    article.querySelector('[data-testid="User-Name"]') ||
    cell?.querySelector('[data-testid="User-Name"]');
  const hasTime =
    article.querySelector("time[datetime]") ||
    cell?.querySelector("time[datetime]");
  if (!hasUser || !hasTime) return false;
  return isInPrimaryFeed(article);
}

/** On /status/ pages the focal post often lives in cellInnerDiv, not a reply article. */
function getStatusPageFocalCell() {
  if (!isOnStatusDetailPage()) return null;
  const pageId = getPageMainStatusId();
  const primary = document.querySelector('[data-testid="primaryColumn"]');
  if (!primary || !pageId) return null;

  for (const link of primary.querySelectorAll('a[href*="/status/"]')) {
    const href = link.getAttribute("href") || "";
    if (!href.includes(`/status/${pageId}`)) continue;
    const cell = link.closest('[data-testid="cellInnerDiv"]');
    if (cell) return cell;
  }

  return primary.querySelector('[data-testid="cellInnerDiv"]');
}

function getShellFromCell(cell) {
  if (!cell) return null;
  return (
    cell.querySelector('article[data-testid="tweet"]') ||
    cell.querySelector('[data-testid="tweet"]') ||
    cell
  );
}

function shouldProcessDomMutations(mutations) {
  if (!canOperate() || suppressDomScan) return false;
  const primary = getPrimaryColumn();
  if (!primary) return false;

  for (const mutation of mutations) {
    const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
    for (const node of nodes) {
      if (!(node instanceof Element)) continue;
      if (!primary.contains(node) && node !== primary) continue;
      if (
        node.closest?.(
          ".dialx-control-bar, #dialect-panel, [data-dialx-ignore-mutations]"
        ) ||
        node.matches?.(".dialx-control-bar, #dialect-panel")
      ) {
        continue;
      }
      if (
        node.matches?.('article[data-testid="tweet"]') ||
        node.querySelector?.('article[data-testid="tweet"]') ||
        node.closest?.('article[data-testid="tweet"]') ||
        node.matches?.('[data-testid="tweetText"]') ||
        node.querySelector?.('[data-testid="tweetText"]')
      ) {
        return true;
      }
    }
  }
  return false;
}

function hasExcludedAncestor(el) {
  const inQuoteCard = Boolean(el.closest('[data-testid="quoteTweet"]'));
  let node = el.parentElement;
  while (node) {
    const testId = node.getAttribute?.("data-testid");
    if (testId === "quoteTweet") {
      node = node.parentElement;
      continue;
    }
    if (testId === "card.wrapper" && !inQuoteCard) {
      node = node.parentElement;
      continue;
    }
    if (testId && EXCLUDED_ANCESTOR_TESTIDS.has(testId)) return true;
    const role = node.getAttribute?.("role");
    const tag = node.tagName;
    if (role === "button" || tag === "BUTTON" || tag === "NAV" || tag === "HEADER") {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

function isEligibleTweetTextElement(el, tweetRoot, article) {
  if (!el?.isConnected || el.getAttribute("data-testid") !== "tweetText") return false;
  if (!tweetRoot.contains(el)) return false;
  if (!article || !isValidTweetArticle(article)) return false;
  if (hasExcludedAncestor(el)) return false;

  const text = el.innerText.trim();
  if (!text || isUiChromeText(text)) return false;

  const hasTweetMarkers =
    el.hasAttribute("lang") ||
    el.hasAttribute("dir") ||
    Boolean(el.closest("[lang]")) ||
    el.getAttribute("dir") === "auto";

  if (!hasTweetMarkers) {
    if (!isInsideArticleQuoteCard(el, article) && text.length > 0) return true;
    return false;
  }

  return true;
}

function getTweetRoot(article) {
  if (article.getAttribute("data-testid") === "tweet") return article;
  return article.querySelector('[data-testid="tweet"]') || article;
}

/** Tweet shells - article or div[data-testid="tweet"] (X uses both). */
function getTweetArticleRoots() {
  const roots = [];
  const seen = new Set();
  const scope = getPrimaryColumn();
  if (!scope) return roots;

  scope.querySelectorAll('[data-testid="tweet"]').forEach((el) => {
    const root =
      el.tagName === "ARTICLE"
        ? el
        : el.closest('article[data-testid="tweet"]') || el;
    if (seen.has(root) || !isInPrimaryFeed(root)) return;
    seen.add(root);
    roots.push(root);
  });
  return roots;
}

function getTweetArticles() {
  return getTweetArticleRoots();
}

function getEmbeddedQuoteContainer(article) {
  const all = [...article.querySelectorAll('[data-testid="quoteTweet"]')];
  if (all.length === 0) return null;

  const withContent = all.filter(
    (q) =>
      q.querySelector('[data-testid="tweetText"]') ||
      q.querySelector('[data-testid="User-Name"]') ||
      q.querySelector('article[data-testid="tweet"]')
  );
  const pool = withContent.length ? withContent : all;
  const deepest = pool.find(
    (q) => !pool.some((other) => other !== q && other.contains(q))
  );
  return deepest || pool[pool.length - 1];
}

/** True when tweetText sits inside this article's embedded quote card. */
function isInsideArticleQuoteCard(el, article) {
  const quote = getEmbeddedQuoteContainer(article);
  return Boolean(quote && quote.contains(el));
}

function isBeforeInDocument(el, container) {
  if (!container) return true;
  return Boolean(
    container.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING
  );
}

function collectCandidateTextElements(article, tweetRoot, quoteContainer) {
  const candidates = [];
  const scope = getTweetCell(article) || article;

  // Only genuine tweet text qualifies. Image/video/card-only posts have no
  // [data-testid="tweetText"], so they get no candidates and therefore no UI
  // buttons - translating card titles or image overlays is never wanted.
  for (const el of scope.querySelectorAll('[data-testid="tweetText"]')) {
    if (quoteContainer?.contains(el)) continue;
    if (!scope.contains(el) && !article.contains(el) && !tweetRoot.contains(el)) {
      continue;
    }
    const text = el.innerText.trim();
    if (!text || isUiChromeText(text)) continue;
    candidates.push(el);
  }

  return candidates;
}

function scoreMainTextCandidate(el, article) {
  const text = el.innerText.trim();
  if (!text || isUiChromeText(text)) return -1;
  let score = text.length;
  if (el.getAttribute("data-testid") === "tweetText") score += 500;
  if (el.hasAttribute("lang") || el.closest("[lang]")) score += 50;
  if (
    el.getAttribute("data-testid") !== "tweetText" &&
    hasExcludedAncestor(el)
  ) {
    return -1;
  }
  return score;
}

/**
 * Author's main body - prefer tweetText outside the quote card (DOM order).
 */
function findMainTweetText(article, tweetRoot, quoteContainer) {
  const candidates = collectCandidateTextElements(article, tweetRoot, quoteContainer);

  for (const el of candidates) {
    if (quoteContainer?.contains(el)) continue;
    if (scoreMainTextCandidate(el, article) > 0) return el;
  }

  let best = null;
  let bestScore = -1;
  for (const el of candidates) {
    if (quoteContainer?.contains(el)) continue;
    const score = scoreMainTextCandidate(el, article);
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

function findQuotedTweetText(article, quoteContainer) {
  if (!quoteContainer) return null;

  let best = null;
  let bestLen = 0;
  for (const el of quoteContainer.querySelectorAll('[data-testid="tweetText"]')) {
    if (!quoteContainer.contains(el)) continue;
    const text = el.innerText.trim();
    if (!text || isUiChromeText(text)) continue;
    if (text.length > bestLen) {
      bestLen = text.length;
      best = el;
    }
  }
  return best;
}

/** Main body + embedded quote - each gets its own DialectsOnX UI and translation. */
function getArticleTextTargets(article) {
  if (!isValidTweetArticle(article)) return [];

  const targets = [];
  const tweetRoot = getTweetRoot(article);
  const quoteContainer = getEmbeddedQuoteContainer(article);
  const mainStatusId = getTweetStatusId(article);

  const bestMain = findMainTweetText(article, tweetRoot, quoteContainer);
  if (bestMain) {
    targets.push({
      el: bestMain,
      article,
      statusId: mainStatusId,
      isQuoted: false
    });
  }

  if (quoteContainer) {
    const quotedStatusId = getQuotedTweetStatusId(article);
    const bestQuote = findQuotedTweetText(article, quoteContainer);
    if (bestQuote && bestQuote !== bestMain) {
      targets.push({
        el: bestQuote,
        article,
        statusId: quotedStatusId || (mainStatusId ? `${mainStatusId}-quote` : null),
        isQuoted: true
      });
    }
  }

  return targets;
}

/**
 * Status-page focal post: text is often in cellInnerDiv but outside the inner tweet shell.
 * Comments use normal articles - this path targets the top post explicitly.
 */
function registerStatusPageFocalPost(options = { uiOnly: true }) {
  if (!canOperate() || !isOnStatusDetailPage()) return;

  const pageId = getPageMainStatusId();
  const cell = getStatusPageFocalCell();
  const shell = getShellFromCell(cell);
  if (!pageId || !cell || !shell) return;

  const quoteContainer = getEmbeddedQuoteContainer(shell);
  const tweetRoot = getTweetRoot(shell);
  const article =
    shell.matches?.('article[data-testid="tweet"]') ? shell : shell.closest?.('article[data-testid="tweet"]') || shell;

  const targets = [];
  const bestMain = findMainTweetText(shell, tweetRoot, quoteContainer) ||
    findMainTweetText(cell, cell, quoteContainer);

  if (bestMain) {
    targets.push({
      el: bestMain,
      article,
      statusId: pageId,
      isQuoted: false
    });
  }

  if (quoteContainer) {
    const quotedStatusId = getQuotedTweetStatusId(shell);
    const bestQuote = findQuotedTweetText(shell, quoteContainer);
    if (bestQuote && bestQuote !== bestMain) {
      targets.push({
        el: bestQuote,
        article,
        statusId: quotedStatusId || `${pageId}-quote`,
        isQuoted: true
      });
    }
  }

  if (targets.length === 0) return;

  cell.dataset.dialxFocalCell = "1";
  watchArticleForContent(article);

  const mapped = targets
    .map((t) => ({
      ...t,
      postId: buildPostId(t),
      cacheStatusId: getCacheStatusId(t),
      priority: getTargetPriority(t) + 10
    }))
    .sort((a, b) => (a.isQuoted ? 1 : 0) - (b.isQuoted ? 1 : 0));

  for (const target of mapped) {
    registerPostTarget(target, options);
  }

  observeElementForTranslation(cell);
  observeArticleForTranslation(article);
}

function getExpandedTweetArticles() {
  const articles = [];
  const primary = getPrimaryColumn();
  for (const root of document.querySelectorAll(
    '[role="dialog"], [aria-modal="true"]'
  )) {
    if (primary?.contains(root)) continue;
    for (const article of root.querySelectorAll('article[data-testid="tweet"]')) {
      if (isValidTweetArticle(article) && isInPrimaryFeed(article)) {
        articles.push(article);
      }
    }
  }
  return articles;
}

function registerExpandedQuoteTweets() {
  if (!canOperate()) return;
  for (const article of getExpandedTweetArticles()) {
    if (!isInPrimaryFeed(article)) continue;
    registerArticleTargets(article, { uiOnly: true });
  }
}

let quoteExpandListenersReady = false;
let quoteExpandScanTimer = null;

function setupQuoteExpansionListeners() {
  if (quoteExpandListenersReady) return;
  quoteExpandListenersReady = true;

  const scheduleQuoteExpandScan = () => {
    if (quoteExpandScanTimer) clearTimeout(quoteExpandScanTimer);
    quoteExpandScanTimer = setTimeout(() => {
      quoteExpandScanTimer = null;
      if (!canOperate()) return;
      registerExpandedQuoteTweets();
    }, QUOTE_EXPAND_SCAN_DELAY_MS);
  };

  document.addEventListener(
    "click",
    (e) => {
      if (!e.target.closest('[data-testid="quoteTweet"]')) return;
      scheduleQuoteExpandScan();
    },
    true
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (!e.target.closest('[data-testid="quoteTweet"]')) return;
      scheduleQuoteExpandScan();
    },
    true
  );
}

function controlBarSelector(postId) {
  const value = window.CSS && CSS.escape ? CSS.escape(postId) : postId;
  return `.dialx-control-bar[data-dialx-post-id="${value}"]`;
}

/** The single connected DialectsOnX bar for a post, if one exists in the DOM. */
function findExistingBar(postId) {
  const bar = document.querySelector(controlBarSelector(postId));
  return bar?.isConnected ? bar : null;
}

/** Keep exactly one bar per post; remove any duplicates left by re-renders. */
function removeDuplicateBars(postId, keep) {
  document.querySelectorAll(controlBarSelector(postId)).forEach((bar) => {
    if (bar !== keep) bar.remove();
  });
}

/**
 * Ensure a post has exactly one control bar attached right after its text.
 * The bar is owned by state.bar, so detection never depends on sibling order.
 */
function ensureControlBar(state, el, article) {
  if (!state || !el?.isConnected) return false;

  let bar = state.bar || findExistingBar(state.postId);

  if (!bar) {
    // No bar anywhere - create one.
    bar = createControlBar(el, state.postId, state.isNews, state);
    insertControlBar(el, bar, article);
    requestAnimationFrame(() => repositionControlBar(el, bar, article));
  } else if (!bar.parentNode) {
    // Freshly created but not yet inserted.
    insertControlBar(el, bar, article);
    requestAnimationFrame(() => repositionControlBar(el, bar, article));
  } else if (!el.parentNode?.contains(bar)) {
    // Bar got detached from this text node by a re-render - move it back.
    insertControlBar(el, bar, article);
  }

  state.bar = bar;
  removeDuplicateBars(state.postId, bar);
  state.updateMainButton?.();
  return true;
}

function getTranslatableTextTargets() {
  const results = [];
  const seenElements = new WeakSet();
  const seenKeys = new Set();

  getTweetArticles().forEach((article) => {
    if (!shouldRegisterArticle(article)) return;

    for (const target of getArticleTextTargets(article)) {
      if (!target.el || seenElements.has(target.el)) continue;

      const postId = buildPostId(target);
      const key = `${postId}:${target.el}`;
      if (seenKeys.has(key)) continue;

      seenElements.add(target.el);
      seenKeys.add(key);
      results.push({
        ...target,
        postId,
        cacheStatusId: getCacheStatusId(target),
        priority: getTargetPriority(target)
      });
    }
  });

  results.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.isQuoted !== b.isQuoted) return a.isQuoted ? 1 : -1;
    return 0;
  });
  return results;
}

/** @deprecated Use getTranslatableTextTargets - kept for single-element lookups */
function getMainTweetTextElement(article) {
  const targets = getArticleTextTargets(article);
  return targets.find((t) => !t.isQuoted)?.el || targets[0]?.el || null;
}

function getMainTweetTextElements() {
  return getTranslatableTextTargets();
}

function getPostIdsForArticle(article) {
  return [...postStates.entries()]
    .filter(([, state]) => state.article === article)
    .sort((a, b) => {
      const sa = a[1];
      const sb = b[1];
      if (sa.isQuoted !== sb.isQuoted) return sa.isQuoted ? 1 : -1;
      return (sb.priority || 0) - (sa.priority || 0);
    })
    .map(([postId]) => postId);
}

function refreshPostElementFromArticle(state) {
  if (!state?.article) return false;

  if (isOnStatusDetailPage()) {
    const cell = getStatusPageFocalCell();
    const shell = getShellFromCell(cell);
    if (
      cell &&
      shell &&
      (state.article === shell ||
        state.article === cell ||
        shell.contains(state.article) ||
        cell.contains(state.postElement))
    ) {
      const quoteContainer = getEmbeddedQuoteContainer(shell);
      const tweetRoot = getTweetRoot(shell);
      if (!state.isQuoted) {
        const mainEl =
          findMainTweetText(shell, tweetRoot, quoteContainer) ||
          findMainTweetText(cell, cell, quoteContainer);
        if (mainEl?.isConnected) {
          state.postElement = mainEl;
          return true;
        }
      } else if (quoteContainer) {
        const quoteEl = findQuotedTweetText(shell, quoteContainer);
        if (quoteEl?.isConnected) {
          state.postElement = quoteEl;
          return true;
        }
      }
    }
  }

  const targets = getArticleTextTargets(state.article);
  const target = state.isQuoted
    ? targets.find((t) => t.isQuoted)
    : targets.find((t) => !t.isQuoted);

  if (target?.el?.isConnected) {
    state.postElement = target.el;
    return true;
  }

  return Boolean(state.postElement?.isConnected);
}

function ensurePostControlBar(state, article) {
  if (!state?.postElement) return false;
  if (!state.postElement.isConnected && !refreshPostElementFromArticle(state)) {
    return false;
  }
  if (!isInPrimaryFeed(state.postElement)) return false;

  return ensureControlBar(state, state.postElement, article || state.article);
}

const articleContentWatchers = new WeakMap();
const watchedArticles = new Set();
const articleWatchDebounce = new WeakMap();

function watchArticleForContent(article) {
  if (!isOnStatusDetailPage()) return;
  if (articleContentWatchers.has(article)) return;

  const observer = new MutationObserver(() => {
    if (!canOperate()) return;
    if (articleWatchDebounce.has(article)) return;
    const timer = setTimeout(() => {
      articleWatchDebounce.delete(article);
      if (getStatusPageFocalCell()?.contains(article)) {
        registerStatusPageFocalPost({ uiOnly: true });
      }
    }, ARTICLE_UI_WATCH_DEBOUNCE_MS);
    articleWatchDebounce.set(article, timer);
  });
  observer.observe(article, { childList: true, subtree: true });
  articleContentWatchers.set(article, observer);
  watchedArticles.add(article);
}

function disconnectArticleWatcher(article) {
  const timer = articleWatchDebounce.get(article);
  if (timer) {
    clearTimeout(timer);
    articleWatchDebounce.delete(article);
  }
  const observer = articleContentWatchers.get(article);
  if (observer) {
    observer.disconnect();
    articleContentWatchers.delete(article);
  }
  watchedArticles.delete(article);
}

function observeElementForTranslation(el) {
  if (!el?.isConnected || !isInPrimaryFeed(el)) return;
  if (el.dataset.dialxObserved === "1") return;
  el.dataset.dialxObserved = "1";
  visibilityObserver?.observe(el);
}

function observeArticleForTranslation(article) {
  observeElementForTranslation(article);
}

function setAsDefault(dialect, language) {
  const normalized = normalizeStoredDialect(dialect);
  if (!canOperate() || !normalized) return;
  preferredDialect = normalized;
  preferredLanguage =
    normalizeStoredLanguage(language) ||
    catalog?.dialectById(normalized)?.languageId ||
    preferredLanguage;
  chrome.storage.sync.set({
    preferredDialect: normalized,
    preferredLanguage
  });
}

function resolvePostDialect(state, overrideDialect) {
  if (state.isNews) return MSA_DIALECT;
  const override = normalizeStoredDialect(overrideDialect);
  if (override) return override;
  const active = normalizeStoredDialect(state.activeDialect);
  if (active) return active;
  return getAutoTranslateDialect(state);
}

async function translatePostToDialect(postId, targetDialect, translateBtn) {
  if (!canOperate()) return;

  const state = postStates.get(postId);
  if (!state?.postElement || !state.originalText) return;

  if (getCachedTranslation(state, targetDialect)) {
    applyTranslated(state, targetDialect);
    return;
  }

  if (translateBtn) {
    translateBtn.disabled = true;
    translateBtn.textContent = "Translating...";
  }

  const translated = await runQueuedTranslation(
    () => fetchTranslation(state, targetDialect),
    state.priority
  );
  applyTranslated(state, targetDialect);

  if (translateBtn) {
    translateBtn.disabled = false;
    translateBtn.textContent = "Translate";
  }
}

function createControlBar(postElement, postId, isNews, existingState = null) {
  injectDialxStyles();

  const bar = document.createElement("div");
  bar.classList.add("dialx-control-bar");
  bar.dataset.dialxPostId = postId;

  const originalText = stripShowMoreLabel(postElement.innerText.trim());
  let state = existingState || postStates.get(postId);

  if (!state) {
    state = {
      originalText,
      postElement,
      showingOriginal: false,
      autoTranslated: false,
      translationCache: new Map(),
      activeDialect: getAutoTranslateDialect({ isNews }),
      updateMainButton: null,
      abortController: null
    };
    postStates.set(postId, state);
  } else {
    mergeOriginalText(state, originalText);
    state.postElement = postElement;
  }

  const mainBtn = document.createElement("div");
  mainBtn.className = "dialx-btn dialx-btn-main";
  mainBtn.setAttribute("role", "button");
  mainBtn.setAttribute("tabindex", "0");

  state.updateMainButton = () => {
    if (state.showingOriginal) {
      mainBtn.textContent = "Original";
      return;
    }
    if (isNews) {
      mainBtn.textContent = dialectAbbrev(MSA_DIALECT);
      return;
    }
    const d = resolvePostDialect(state);
    mainBtn.textContent = dialectAbbrev(d);
  };
  state.updateMainButton();

  mainBtn.onclick = (e) => {
    e.stopPropagation();
    if (!canOperate()) return;

    // Arabic news/official posts are shown as-is (MSA) with no translation.
    // There is nothing to toggle and we must never issue a request for them.
    if (state.isNews && isArabicText(state.originalText)) return;

    state.showingOriginal = !state.showingOriginal;
    const target = state.postElement || postElement;

    if (state.showingOriginal) {
      if (state.useOverlay) {
        // Reveal X's real text node (native "Show more" intact); hide overlay.
        if (state.transEl) state.transEl.style.display = "none";
        if (state.postElement) showOriginalTextNode(state.postElement);
        if (state.nativeShowMore) state.nativeShowMore.style.removeProperty("display");
      } else {
        suppressDomScan = true;
        target.textContent = state.originalText;
        requestAnimationFrame(() => {
          suppressDomScan = false;
        });
      }
    } else {
      const dialect = resolvePostDialect(state);
      if (!applyTranslated(state, dialect)) {
        runQueuedTranslation(
          () => fetchTranslation(state, dialect),
          state.priority ?? PRIORITY_REPLY
        ).then(() => {
          if (!state.showingOriginal && state.postElement?.isConnected) {
            applyTranslated(state, dialect);
          }
        });
      }
    }
    state.updateMainButton();
  };

  const selectorBtn = document.createElement("button");
  selectorBtn.type = "button";
  selectorBtn.className = "dialx-btn dialx-btn-selector";
  selectorBtn.textContent = "Select dialect";
  selectorBtn.onclick = (e) => {
    e.stopPropagation();
    showDialectSelector(bar, postId);
  };

  // DialectsOnX wordmark rendered as a luminance mask over a neutral gray fill: the
  // black background drops out (transparent) and the mark blends on both X
  // light and dark themes. Height matches the selector button.
  const logo = document.createElement("span");
  logo.className = "dialx-logo";
  logo.setAttribute("aria-label", "DialectsOnX");
  logo.setAttribute("role", "img");

  bar.appendChild(mainBtn);
  bar.appendChild(selectorBtn);
  bar.appendChild(logo);
  return bar;
}

function showDialectSelector(controlBar, postId) {
  if (!canOperate() || !catalog || !globalThis.DialexSheet) return;
  injectDialxStyles();

  if (activePanelCleanup) {
    activePanelCleanup();
    activePanelCleanup = null;
  }
  document.getElementById("dialect-panel")?.remove();
  document.getElementById("dx-sheet-root")?.remove();

  const state = postStates.get(postId);
  let sheetLanguage =
    normalizeStoredLanguage(preferredLanguage) ||
    catalog.dialectById(preferredDialect)?.languageId ||
    DEFAULT_LANGUAGE;
  let sheetDialect = isValidDialect(preferredDialect)
    ? preferredDialect
    : catalog.defaultDialectFor(sheetLanguage)?.id || DEFAULT_DIALECT;

  DialexSheet.openDialectSheet({
    languageId: sheetLanguage,
    dialectId: sheetDialect,
    showAutoTranslate: true,
    autoTranslate: autoTranslateEnabled,
    onAutoTranslateChange: (checked) => {
      if (!canOperate()) return;
      autoTranslateEnabled = checked;
      chrome.storage.sync.set({ autoTranslate: autoTranslateEnabled });
    },
    translateLabel: "Translate post",
    padUrl: DIALEX_PAD_URL,
    onSelect: ({ languageId, dialectId }) => {
      sheetLanguage = languageId;
      sheetDialect = dialectId;
      setAsDefault(dialectId, languageId);
      if (state) state.activeDialect = dialectId;
      state?.updateMainButton?.();
    },
    onTranslate: () => {
      if (state) state.activeDialect = sheetDialect;
      translatePostToDialect(postId, sheetDialect, null);
    },
    onClose: () => {
      activePanelCleanup = null;
    }
  });
}


let autoTranslateBudget = 0;

function getArticleScanPriority(article) {
  if (isPrimaryDetailPagePost(article)) return PRIORITY_MAIN_BODY + 20;
  if (isReplyBelowFocused(article)) return PRIORITY_REPLY;
  let priority = PRIORITY_MAIN_BODY;
  if (isFocusedPostArticle(article)) priority += PRIORITY_FOCUSED_BONUS;
  if (isThreadAncestorArticle(article)) priority += PRIORITY_FOCUSED_BONUS;
  return priority;
}

function scheduleVisibilityTranslateFlush() {
  if (!canAutoTranslate()) return;
  if (visibilityFlushTimer) return;
  visibilityFlushTimer = setTimeout(() => {
    visibilityFlushTimer = null;
    flushVisibleTranslations();
  }, VISIBILITY_FLUSH_MS);
}

/** One debounced batch: main posts before quotes/comments, max N API calls. */
function flushVisibleTranslations() {
  if (!canAutoTranslate()) return;

  // While the user is actively scrolling, defer the whole batch. Posts that just
  // fly past the viewport never get a request, which is the main source of spam.
  if (performance.now() - lastScrollAt < SCROLL_SETTLE_MS) {
    scheduleVisibilityTranslateFlush();
    return;
  }

  autoTranslateBudget = MAX_AUTO_TRANSLATE_PER_VISIBLE_BATCH;
  const candidates = [];

  for (const [postId, state] of postStates) {
    if (!state || state.autoTranslated || state.autoTranslatePending) continue;
    if (state.autoTranslateFailed) continue;
    if (!state.originalText?.trim()) continue;
    if (!state.postElement?.isConnected || !isInPrimaryFeed(state.postElement)) {
      continue;
    }
    if (!isPostVisible(state)) continue;
    candidates.push({
      postId,
      priority: state.priority || 0,
      isQuoted: Boolean(state.isQuoted),
      isReply: isReplyBelowFocused(state.article)
    });
  }

  candidates.sort((a, b) => {
    if (a.isReply !== b.isReply) return a.isReply ? 1 : -1;
    if (a.isQuoted !== b.isQuoted) return a.isQuoted ? 1 : -1;
    return b.priority - a.priority;
  });

  let started = 0;
  for (const { postId } of candidates) {
    if (autoTranslateBudget <= 0) break;
    void maybeAutoTranslate(postId);
    started++;
  }

  // More visible posts than this batch could handle - continue after they settle.
  if (candidates.length > started) {
    scheduleVisibilityTranslateFlush();
  }
}

async function maybeAutoTranslate(postId) {
  if (!canAutoTranslate()) return;

  const state = postStates.get(postId);
  if (!state || state.autoTranslated) return;
  if (state.autoTranslatePending || state.autoTranslateFailed) return;
  if (autoTranslateBudget <= 0) return;
  if (!state.originalText?.trim()) return;
  if (!state.postElement?.isConnected || !isInPrimaryFeed(state.postElement)) return;
  if (!isPostVisible(state)) return;

  if (!ensurePostControlBar(state, state.article)) return;

  // News/official/gray-badge posts always target MSA. If such a post is
  // already in Arabic script, show it as-is and never request a translation.
  if (state.isNews && isArabicText(state.originalText)) {
    state.autoTranslated = true;
    state.activeDialect = MSA_DIALECT;
    state.appliedHtml = state.postElement.innerHTML;
    state.updateMainButton?.();
    maybeUnobserveArticle(state.article);
    return;
  }

  // News/official → MSA; everyone else → the preferred dialect.
  const dialect = getAutoTranslateDialect(state);

  if (applyTranslated(state, dialect)) {
    maybeUnobserveArticle(state.article);
    return;
  }

  autoTranslateBudget--;
  state.autoTranslatePending = true;
  state.abortController = new AbortController();

  try {
    await runQueuedTranslation(
      () => fetchTranslation(state, dialect, state.abortController.signal),
      state.priority
    );
    if (!state.postElement?.isConnected || state.showingOriginal) return;
    // fetchTranslation has cached the result; applyTranslated handles the DOM
    // write, the timeline-vs-status mutation flag, and idempotency.
    if (applyTranslated(state, dialect)) {
      maybeUnobserveArticle(state.article);
    }
  } catch (e) {
    if (e.name !== "AbortError") {
      state.autoTranslateFailed = true;
      console.error("Auto-translate error:", e);
    }
  } finally {
    state.autoTranslatePending = false;
    state.abortController = null;
    // Keep translating remaining visible posts once this one frees a slot.
    scheduleVisibilityTranslateFlush();
  }
}

function reconnectVisibleKnownPosts() {
  if (!canOperate()) return;

  let count = 0;
  for (const article of getTweetArticles()) {
    if (count >= 6) break;
    if (!shouldRegisterArticle(article)) continue;
    const rect = article.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
    registerArticleTargets(article, { uiOnly: true });
    count++;
  }
}

/**
 * Register (or re-attach) a single post target. Uses a STABLE postId so the
 * same logical post is never duplicated across React re-renders.
 */
function registerPostTarget(target, options = {}) {
  if (!canOperate()) return;

  const { el, article, postId, cacheStatusId, isQuoted, priority } = target;
  if (!el?.isConnected || !article) return;

  let state = postStates.get(postId);

  if (!state) {
    const isNews = isNewsOrOfficialPost(article, el.innerText.trim());
    const bar = createControlBar(el, postId, isNews); // creates and stores the state
    state = postStates.get(postId);
    state.postId = postId;
    state.isNews = isNews;
    state.showingOriginal = false;
    state.bar = bar;
  }

  // Stable identity + refreshed element refs after a re-render.
  state.statusId = cacheStatusId;
  state.cacheStatusId = cacheStatusId;
  state.isQuoted = isQuoted;
  state.priority = priority;
  state.article = article;
  state.postElement = el;
  state.focalCell = getStatusPageFocalCell();
  if (!state.activeDialect) state.activeDialect = getAutoTranslateDialect(state);
  el.dataset.postId = postId;
  registeredPosts.add(el);

  // Keep original text current only while untranslated (avoids corruption).
  if (!state.autoTranslated) {
    mergeOriginalText(state, stripShowMoreLabel(el.innerText.trim()));
  }

  ensureControlBar(state, el, article);

  // Restore the translated view after a re-render replaced the text node.
  if (!state.showingOriginal) {
    const dialect = state.activeDialect || getAutoTranslateDialect(state);
    if (getCachedTranslation(state, dialect)) {
      applyTranslated(state, dialect);
    }
  }

  observeArticleForTranslation(article);
}

function registerArticleTargets(article, options = {}) {
  if (!canOperate() || !shouldRegisterArticle(article)) return;

  watchArticleForContent(article);

  const targets = getArticleTextTargets(article)
    .map((t) => ({
      ...t,
      postId: buildPostId(t),
      cacheStatusId: getCacheStatusId(t),
      priority: getTargetPriority(t)
    }))
    .sort((a, b) => {
      if (a.isQuoted !== b.isQuoted) return a.isQuoted ? 1 : -1;
      return (b.priority || 0) - (a.priority || 0);
    });

  if (targets.length === 0) return;

  for (const target of targets) {
    registerPostTarget(target, options);
  }

  observeArticleForTranslation(article);

  if (
    options.allowTranslate &&
    !options.uiOnly &&
    canAutoTranslate() &&
    isElementInViewport(article, INTERSECTION_VISIBLE_RATIO)
  ) {
    scheduleVisibilityTranslateFlush();
  }
}

let replyRegisterTimer = null;

function collectArticlesForScan() {
  const articlePriority = new Map();

  // registerStatusPageFocalPost owns the single focal /status/ post (its text can
  // live outside the inner article shell). Skip ONLY that exact post here - every
  // ancestor and comment must still be registered so the main post keeps its UI
  // and translation when a comment is opened.
  const focalCell = getStatusPageFocalCell();
  const focalHandled = focalCell?.dataset.dialxFocalCell === "1";

  getTweetArticles().forEach((article) => {
    if (!shouldRegisterArticle(article)) return;
    // The focal /status/ post is owned by registerStatusPageFocalPost (stable
    // id + dedup). Skip it here so the article path can't mint a second bar with
    // a random id for it. Cell containment is robust even when the focal post's
    // status id can't be read; ancestors live in other cells and still register.
    if (focalHandled && focalCell.contains(article)) return;
    if (!focalHandled && isPrimaryDetailPagePost(article)) return;
    articlePriority.set(article, getArticleScanPriority(article));
  });

  const sortArticles = (list) =>
    list.sort(
      (a, b) => (articlePriority.get(b) || 0) - (articlePriority.get(a) || 0)
    );

  const immediateArticles = [];
  const delayedArticles = [];

  for (const article of articlePriority.keys()) {
    if (shouldDelayRegistration(article)) {
      delayedArticles.push(article);
    } else {
      immediateArticles.push(article);
    }
  }

  return {
    sortArticles,
    immediateArticles,
    delayedArticles
  };
}

function runPostScan({ reconnect = false } = {}) {
  if (!canOperate()) return;

  if (isOnStatusDetailPage()) {
    registerStatusPageFocalPost({ uiOnly: true });
  }

  const { sortArticles, immediateArticles, delayedArticles } = collectArticlesForScan();

  let registered = 0;
  for (const article of sortArticles([...immediateArticles])) {
    // Always register posts that are actually on screen; only the off-screen
    // prefetch is capped. Otherwise off-screen articles X keeps mounted above
    // the viewport eat the budget and starve visible posts lower in the feed
    // (e.g. video/quote posts), leaving them with no UI buttons or translation.
    const onScreen = isElementInViewport(article, 0);
    if (!onScreen && registered >= MAX_UI_REGISTER_PER_SCAN) continue;
    registerArticleTargets(article, { uiOnly: true });
    if (!onScreen) registered++;
  }

  if (reconnect) {
    reconnectVisibleKnownPosts();
  }

  scheduleVisibilityTranslateFlush();

  if (replyRegisterTimer) clearTimeout(replyRegisterTimer);
  if (delayedArticles.length > 0) {
    replyRegisterTimer = setTimeout(() => {
      replyRegisterTimer = null;
      if (!canOperate()) return;
      let delayedCount = 0;
      for (const article of sortArticles([...delayedArticles])) {
        const onScreen = isElementInViewport(article, 0);
        if (!onScreen && delayedCount >= MAX_UI_REGISTER_PER_SCAN) continue;
        registerArticleTargets(article, { uiOnly: true });
        if (!onScreen) delayedCount++;
      }
    }, REPLY_REGISTER_DELAY_MS);
  }
}

function schedulePostScan(options = {}) {
  if (!canOperate()) return;

  if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
  scanDebounceTimer = setTimeout(() => {
    scanDebounceTimer = null;
    if (!canOperate()) return;
    runPostScan(options);
  }, SCAN_DEBOUNCE_MS);
}

/**
 * Posts that scroll into view from X's already-mounted DOM window don't always
 * trigger a mutation (removals are ignored, and unregistered articles aren't
 * watched), so they'd never get registered. A short debounced scan after the
 * scroll settles guarantees every newly-visible post gets its UI + translation.
 */
function setupScrollScan() {
  if (scrollScanListenerReady) return;
  scrollScanListenerReady = true;

  const onScroll = () => {
    if (!canOperate()) return;
    lastScrollAt = performance.now();
    if (scrollScanTimer) clearTimeout(scrollScanTimer);
    scrollScanTimer = setTimeout(() => {
      scrollScanTimer = null;
      if (!canOperate()) return;
      runPostScan();
    }, SCROLL_SCAN_DEBOUNCE_MS);
  };

  window.addEventListener("scroll", onScroll, { passive: true, capture: true });
}

function watchSpaNavigation() {
  const schedule = () => {
    bindDomObserver();
    // Quick staged scans so the main post regains its UI + translation soon
    // after opening a comment, plus the debounced scan for late re-renders.
    for (const delay of [150, 450]) {
      setTimeout(() => {
        if (!canOperate()) return;
        runPostScan({ reconnect: true });
      }, delay);
    }
    schedulePostScan({ reconnect: true });
  };

  window.addEventListener("popstate", schedule);

  const patchHistory = (method) => {
    const original = history[method];
    history[method] = function patchedHistory(...args) {
      const result = original.apply(this, args);
      schedule();
      return result;
    };
  };

  patchHistory("pushState");
  patchHistory("replaceState");
}

function bindDomObserver() {
  const target = getPrimaryColumn() || document.body;
  if (domObserver && domObserverTarget === target) return;

  domObserver?.disconnect();
  domObserver = new MutationObserver((mutations) => {
    if (!canOperate()) return;
    if (!shouldProcessDomMutations(mutations)) return;
    schedulePostScan();
  });
  domObserver.observe(target, { childList: true, subtree: true });
  domObserverTarget = target;
}

function initObservers() {
  if (!visibilityObserver) {
    visibilityObserver = new IntersectionObserver(
      (entries) => {
        if (!canAutoTranslate()) return;

        // Do NOT abort in-flight translations when a post scrolls out of view.
        // The backend request is already sent and completes regardless; aborting
        // only discards the result so it never gets cached, forcing a duplicate
        // request when the post scrolls back. Letting it finish caches the result
        // and dramatically reduces total requests.
        let sawVisible = false;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= INTERSECTION_VISIBLE_RATIO) {
            sawVisible = true;
            break;
          }
        }
        if (sawVisible) scheduleVisibilityTranslateFlush();
      },
      { root: null, threshold: [INTERSECTION_VISIBLE_RATIO] }
    );
  }

  bindDomObserver();
}

async function bootstrapDialx() {
  if (!isExtensionContextValid()) {
    shutdownDialx();
    return;
  }

  await loadSettings();
  if (!canOperate()) return;

  injectDialxStyles();
  initObservers();
  setupQuoteExpansionListeners();
  setupScrollScan();
  watchExtensionContext();
  watchSpaNavigation();

  // The feed hydrates progressively after document_idle, so a single scan often
  // runs before the posts exist. Staged early scans make the UI buttons appear
  // as soon as the first posts render, without waiting for a mutation/debounce.
  runPostScan();
  for (const delay of [150, 400, 800, 1500]) {
    setTimeout(() => {
      if (!canOperate()) return;
      bindDomObserver();
      runPostScan();
    }, delay);
  }
}

bootstrapDialx();
