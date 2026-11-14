import 'mdui/mdui.css';
import 'mdui';
import './styles.css';
import { setColorScheme } from 'mdui/functions/setColorScheme.js';

import { icon, mountIconSprite } from './icons.js';
import {
  fetchLyrics,
  fetchPlaylist,
  fetchStreamUrl,
  parseLrc,
  resolveCover,
  searchMusic,
} from './api.js';
import {
  APP_NAME,
  APP_NAME_EN,
  CHART_IDS,
  FALLBACK_TRACKS,
  GENRES,
  MOODS,
  QUALITY_OPTIONS,
  SIDEBAR_PLAYLISTS,
} from './data.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const store = {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage can be unavailable in private browsing */
    }
  },
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatTime(seconds = 0) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function formatDuration(ms = 0) {
  if (!Number.isFinite(ms) || ms <= 0) return '--:--';
  return formatTime(ms / 1000);
}

function formatMinutes(ms = 0) {
  return `${Math.max(1, Math.round(ms / 60000))} 分钟`;
}

function debounce(fn, delay = 500) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function hashString(value = '') {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function gradientFor(value = '', variant = 0) {
  const hue = hashString(value) % 360;
  const second = (hue + 38 + variant * 11) % 360;
  return `linear-gradient(140deg, hsl(${hue} 26% 24%), hsl(${second} 34% 40%))`;
}

function coverStyle(track, variant = 0) {
  return track?.cover ? '' : `background:${gradientFor(track?.name || 'sonora', variant)}`;
}

function coverMark(track) {
  const chars = Array.from((track?.name || '声').trim());
  return escapeHtml(chars[0] || '声');
}

function contextKeyFor(base) {
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

const SEEDS = [
  { value: '#2F6F66', name: '海松' },
  { value: '#A65C3B', name: '陶土' },
  { value: '#4B5D7A', name: '夜蓝' },
  { value: '#8A6A3D', name: '麦金' },
];

/* ------------------------------------------------------------------ */
/*  App state                                                          */
/* ------------------------------------------------------------------ */

const savedSettings = store.read('sonora:settings', {});
const settings = {
  theme: 'dark',
  quality: '320',
  seed: '#2F6F66',
  motion: true,
  ...savedSettings,
};

const state = {
  view: 'home',
  settings,
  favorites: store.read('sonora:favorites', []).filter((track) => track?.id),
  recent: store.read('sonora:recent', []).filter((track) => track?.id),
  search: {
    query: '',
    loading: false,
    results: [],
    error: '',
    recentQueries: store.read('sonora:searches', []).slice(0, 6),
  },
  charts: {
    hot: FALLBACK_TRACKS,
    fresh: [],
    rising: [],
  },
  activeChart: 'hot',
  home: {
    loading: true,
    error: '',
  },
  curated: null,
  queue: [],
  queueTitle: '',
  currentIndex: -1,
  current: store.read('sonora:last-track', null),
  isPlaying: false,
  loadingStream: false,
  playError: '',
  duration: 0,
  currentTime: 0,
  scrubbing: false,
  volume: store.read('sonora:volume', 0.78),
  muted: false,
  repeat: 'off',
  shuffle: false,
  lyrics: [],
  lyricsLoading: false,
  lyricsTrackId: '',
  activeLyric: -1,
  queueOpen: false,
  sheetOpen: false,
  sidebarOpen: false,
};

if (state.current && !state.queue.length) {
  state.queue = [state.current];
  state.currentIndex = 0;
}

const imgFallbackColors = new Map();
const trackRegistry = new Map();
const contexts = new Map();
const streamCache = new Map();
const lyricCache = new Map();
const coverCache = new Map();
let playToken = 0;
let searchToken = 0;
let audio;

/* ------------------------------------------------------------------ */
/*  Icons / art                                                        */
/* ------------------------------------------------------------------ */

function logoMark() {
  return `
    <span class="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="22" fill="currentColor" opacity=".12"/>
        <circle cx="24" cy="24" r="15.5" stroke="currentColor" stroke-width="1.2" opacity=".55"/>
        <path d="M9.5 27.2c3.4-3.4 6.2-3.4 9.6 0s6.2 3.4 9.6 0 6.2-3.4 9.6 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M12 21.4c2.6-2.6 4.8-2.6 7.4 0s4.8 2.6 7.4 0 4.8-2.6 7.4 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".55"/>
        <circle cx="24" cy="24" r="2.2" fill="currentColor"/>
      </svg>
    </span>`;
}

function coverArt(track, className = '', variant = 0) {
  if (!track) {
    return `<div class="cover-art ${className}" style="background:${gradientFor('sonora', variant)}"><span class="cover-letter">声</span></div>`;
  }
  return `
    <div class="cover-art ${className}" style="${coverStyle(track, variant)}" data-art="${escapeHtml(track.id)}">
      ${track.cover ? `<img src="${escapeHtml(track.cover)}" alt="" loading="lazy" decoding="async" />` : `<span class="cover-letter">${coverMark(track)}</span>`}
    </div>`;
}

function rememberTrack(track) {
  if (!track?.id) return track;
  const existing = trackRegistry.get(String(track.id)) || {};
  const merged = {
    ...existing,
    ...track,
    cover: track.cover || existing.cover || '',
    duration: track.duration || existing.duration || 0,
    album: track.album || existing.album || '',
  };
  trackRegistry.set(String(track.id), merged);
  return merged;
}

function rememberTracks(tracks = []) {
  tracks.forEach(rememberTrack);
  return tracks;
}

function registerContext(key, tracks, title) {
  rememberTracks(tracks);
  contexts.set(key, { tracks, title });
  return key;
}

function trackById(id) {
  return trackRegistry.get(String(id)) || state.queue.find((track) => String(track.id) === String(id)) || null;
}

function isFavorite(id) {
  return state.favorites.some((track) => String(track.id) === String(id));
}

function isCurrent(id) {
  return String(state.current?.id) === String(id);
}

/* ------------------------------------------------------------------ */
/*  Shell                                                              */
/* ------------------------------------------------------------------ */

function renderShell() {
  $('#app').innerHTML = `
    <div class="ambient" aria-hidden="true">
      <span class="ambient-orb ambient-orb--one"></span>
      <span class="ambient-orb ambient-orb--two"></span>
      <span class="ambient-grain"></span>
    </div>

    <div class="app-grid">
      <aside class="sidebar" id="sidebar">
        <a class="brand" href="#" data-view="home" aria-label="回到声屿首页">
          ${logoMark()}
          <span class="brand-copy">
            <strong>${APP_NAME}</strong>
            <em>${APP_NAME_EN}</em>
          </span>
        </a>

        <p class="side-caption">你的私人电台</p>
        <nav class="side-nav" aria-label="主要导航">
          <button class="nav-item" data-view="home">
            ${icon('explore')}<span>发现</span><i>01</i>
          </button>
          <button class="nav-item" data-view="search">
            ${icon('search')}<span>搜索</span><i>02</i>
          </button>
          <button class="nav-item" data-view="library">
            ${icon('favorite')}<span>我的收藏</span><i data-favorite-count>0</i>
          </button>
          <button class="nav-item" data-view="recent">
            ${icon('history')}<span>最近播放</span><i>04</i>
          </button>
        </nav>

        <div class="side-divider"></div>

        <div class="side-section-head">
          <span>为你策展</span>
          <button class="mini-action" data-view="search" aria-label="搜索更多歌单">${icon('add')}</button>
        </div>
        <div class="side-playlists">
          ${SIDEBAR_PLAYLISTS.map(
            (playlist) => `
            <button class="side-playlist" data-curated="${playlist.id}">
              <span class="side-playlist-art" style="background:${escapeHtml(playlist.gradient)}">
                ${icon('graphic_eq')}
              </span>
              <span class="side-playlist-copy">
                <strong>${escapeHtml(playlist.title)}</strong>
                <small>${escapeHtml(playlist.subtitle)}</small>
              </span>
              <span class="side-playlist-arrow">${icon('north_east')}</span>
            </button>`,
          ).join('')}
        </div>

        <div class="sidebar-spacer"></div>

        <div class="listening-card">
          <div class="listening-top">
            <span class="tiny-live"><i></i> LIVE</span>
            <span id="live-clock">01:24 AM</span>
          </div>
          <p>“把夜晚调成喜欢的频率。”</p>
          <div class="listening-wave" aria-hidden="true">
            ${Array.from({ length: 26 }, (_, i) => `<i style="--h:${20 + ((i * 17) % 62)}%"></i>`).join('')}
          </div>
        </div>

        <button class="profile-card" data-action="open-settings">
          <span class="avatar">夜</span>
          <span class="profile-copy">
            <strong>深夜听众</strong>
            <small>免费音质 · 已同步</small>
          </span>
          ${icon('settings')}
        </button>
      </aside>

      <button class="sidebar-scrim" data-action="close-sidebar" aria-label="关闭菜单"></button>

      <main class="main-area">
        <header class="topbar">
          <div class="topbar-left">
            <button class="icon-button mobile-only" data-action="open-sidebar" aria-label="打开菜单">
              ${icon('menu')}
            </button>
            <div class="breadcrumb">
              <span class="brand-mini">${APP_NAME}</span>
              <span class="slash">/</span>
              <b id="context-label">发现</b>
            </div>
          </div>
          <div class="topbar-right">
            <mdui-text-field
              id="global-search"
              class="global-search"
              data-search-input
              variant="outlined"
              placeholder="搜索歌曲、歌手…"
              clearable
              aria-label="搜索歌曲或歌手"
            >
              ${icon('search', 'field-icon', 'slot="icon"')}
            </mdui-text-field>
            <button class="icon-button topbar-search-trigger mobile-only" data-view="search" aria-label="搜索">
              ${icon('search')}
            </button>
            <button class="icon-button" data-action="open-settings" aria-label="打开设置">
              ${icon('tune')}
            </button>
            <button class="topbar-avatar" data-action="open-settings" aria-label="个人设置">夜</button>
          </div>
        </header>

        <div class="main-scroll" id="main-scroll"></div>
      </main>

      <aside class="player-panel" id="player-panel" aria-label="正在播放"></aside>
    </div>

    <div class="mini-player" id="mini-player" aria-label="迷你播放器"></div>

    <nav class="mobile-nav" aria-label="移动端导航">
      <button data-view="home">${icon('explore')}<span>发现</span></button>
      <button data-view="search">${icon('search')}<span>搜索</span></button>
      <button data-view="library">${icon('favorite')}<span>收藏</span></button>
      <button data-view="recent">${icon('history')}<span>最近</span></button>
    </nav>

    <div class="player-sheet" id="player-sheet" aria-hidden="true">
      <div class="sheet-grab" aria-hidden="true"></div>
      <div id="player-sheet-body"></div>
    </div>

    <button class="queue-scrim" id="queue-scrim" data-action="close-queue" aria-label="关闭播放队列"></button>
    <aside class="queue-drawer" id="queue-drawer" aria-label="播放队列"></aside>

    <div id="dialog-root"></div>
  `;
}

/* ------------------------------------------------------------------ */
/*  Sidebar / topbar sync                                              */
/* ------------------------------------------------------------------ */

function updateSidebarCounts() {
  $$('[data-favorite-count]').forEach((el) => {
    el.textContent = String(state.favorites.length).padStart(2, '0');
  });
}

function updateActiveNav() {
  $$('[data-view]').forEach((el) => {
    if (!el.classList.contains('nav-item') && !el.classList.contains('mobile-nav') && el.tagName !== 'BUTTON') return;
    el.classList.toggle('is-active', el.dataset.view === state.view);
  });
  $$('.mobile-nav [data-view]').forEach((el) => el.classList.toggle('is-active', el.dataset.view === state.view));
  $$('.side-nav [data-view]').forEach((el) => el.classList.toggle('is-active', el.dataset.view === state.view));
}

function updateTopbar() {
  const labels = {
    home: '发现',
    search: '搜索',
    library: '我的收藏',
    recent: '最近播放',
    curated: state.curated?.playlist?.title || '精选',
  };
  const label = labels[state.view] || '发现';
  const context = $('#context-label');
  if (context) context.textContent = label;

  if (state.current) {
    document.title = `${state.current.name} — ${state.current.artists} · ${APP_NAME}`;
  } else {
    document.title = `${APP_NAME} ${APP_NAME_EN} · 把夜晚调成喜欢的频率`;
  }
}

/* ------------------------------------------------------------------ */
/*  Home                                                               */
/* ------------------------------------------------------------------ */

function heroArt(track) {
  return `
    <figure class="hero-art" aria-hidden="true">
      <span class="hero-orbit hero-orbit--one"></span>
      <span class="hero-orbit hero-orbit--two"></span>
      <span class="hero-star hero-star--one">✦</span>
      <span class="hero-star hero-star--two">✧</span>
      <div class="vinyl-wrap">
        <div class="vinyl">
          <span class="vinyl-groove g1"></span>
          <span class="vinyl-groove g2"></span>
          <span class="vinyl-groove g3"></span>
          <span class="vinyl-label" data-art="${escapeHtml(track?.id || '')}">
            ${track?.cover ? `<img src="${escapeHtml(track.cover)}" alt="" />` : `<span>${coverMark(track)}</span>`}
          </span>
          <span class="vinyl-hole"></span>
        </div>
        <span class="tonearm"><i></i></span>
        <span class="vinyl-shadow"></span>
      </div>
      <div class="hero-note-card">
        <span class="note-eq">
          ${Array.from({ length: 5 }, (_, i) => `<i style="--d:${i * 0.13}s"></i>`).join('')}
        </span>
        <span class="note-copy">
          <small>${state.home.loading ? '正在同步' : '今日主打'}</small>
          <b>${escapeHtml(track?.name || '声屿夜间电台')}</b>
        </span>
      </div>
      <span class="hero-art-caption">SONORA · NIGHT FREQUENCY 07</span>
    </figure>`;
}

function playlistCard(playlist, index, covers) {
  const slices = covers.slice(0, 3);
  return `
    <button class="curated-card" data-curated="${playlist.id}" style="--delay:${index * 70}ms">
      <span class="curated-collage">
        ${slices
          .map(
            (track, sliceIndex) => `
            <span class="curated-slice slice-${sliceIndex + 1}" style="background:${escapeHtml(playlist.gradient)}">
              ${track?.cover ? `<img src="${escapeHtml(track.cover)}" alt="" loading="lazy" />` : ''}
            </span>`,
          )
          .join('')}
        <span class="curated-overlay"></span>
        <span class="curated-play">${icon('play_arrow')}</span>
        <span class="curated-tag">${icon('graphic_eq')} SONORA EDIT</span>
      </span>
      <span class="curated-copy">
        <strong>${escapeHtml(playlist.title)}</strong>
        <small>${escapeHtml(playlist.subtitle)}</small>
      </span>
      <span class="curated-foot">
        <span>为你策展</span>
        <span>${icon('arrow_outward')}</span>
      </span>
    </button>`;
}

function trackCard(track, contextKey, index) {
  return `
    <article class="track-card" style="--delay:${index * 45}ms">
      <button class="track-card-main" data-track="${escapeHtml(track.id)}" data-context="${contextKey}" aria-label="播放 ${escapeHtml(track.name)}">
        <span class="card-art-wrap">
          ${coverArt(track, 'card-art', index)}
          <span class="card-veil"></span>
          <span class="card-play">${icon('play_arrow')}</span>
          <span class="card-duration">${formatDuration(track.duration)}</span>
        </span>
        <span class="card-title-row">
          <strong>${escapeHtml(track.name)}</strong>
          ${isCurrent(track.id) && state.isPlaying ? `<span class="playing-bars"><i></i><i></i><i></i></span>` : ''}
        </span>
        <span class="card-artist">${escapeHtml(track.artists)}</span>
      </button>
      <button class="card-like ${isFavorite(track.id) ? 'is-liked' : ''}" data-like-id="${escapeHtml(track.id)}" aria-label="${isFavorite(track.id) ? '取消收藏' : '收藏'}">
        ${icon(isFavorite(track.id) ? 'favorite-fill' : 'favorite')}
      </button>
    </article>`;
}

function trackRow(track, contextKey, index, { showIndex = true, showAlbum = false, number } = {}) {
  return `
    <div class="track-row ${isCurrent(track.id) ? 'is-current' : ''}" data-row-id="${escapeHtml(track.id)}">
      <button class="row-play-area" data-track="${escapeHtml(track.id)}" data-context="${contextKey}" aria-label="播放 ${escapeHtml(track.name)}">
        <span class="row-index">
          <span class="row-number">${String(number ?? index + 1).padStart(2, '0')}</span>
          <span class="row-play-icon">${icon(isCurrent(track.id) && state.isPlaying ? 'graphic_eq' : 'play_arrow')}</span>
        </span>
        ${coverArt(track, 'row-art', index)}
        <span class="row-copy">
          <strong>${escapeHtml(track.name)}</strong>
          <small>${escapeHtml(track.artists)}</small>
        </span>
      </button>
      <span class="row-album">${showAlbum ? escapeHtml(track.album || '—') : ''}</span>
      <span class="row-duration">${track.duration ? formatDuration(track.duration) : ''}</span>
      <button class="row-like ${isFavorite(track.id) ? 'is-liked' : ''}" data-like-id="${escapeHtml(track.id)}" aria-label="${isFavorite(track.id) ? '取消收藏' : '收藏'}">
        ${icon(isFavorite(track.id) ? 'favorite-fill' : 'favorite')}
      </button>
    </div>`;
}

function sectionHead(index, title, subtitle = '', action = '') {
  return `
    <div class="section-head">
      <div class="section-title-wrap">
        <span class="section-index">${index}</span>
        <div>
          <h2>${title}</h2>
          ${subtitle ? `<p>${subtitle}</p>` : ''}
        </div>
      </div>
      ${action}
    </div>`;
}

function renderHome() {
  const hot = rememberTracks(state.charts.hot.length ? state.charts.hot : FALLBACK_TRACKS);
  const fresh = rememberTracks(state.charts.fresh);
  const rising = rememberTracks(state.charts.rising);
  const heroTrack = hot[0] || FALLBACK_TRACKS[0];
  const hotContext = registerContext('home-hot', hot, '今日推荐');
  const freshContext = fresh.length ? registerContext('home-fresh', fresh, '新歌速递') : hotContext;
  const risingContext = rising.length ? registerContext('home-rising', rising, '飙升榜') : hotContext;
  const activeTracks =
    state.activeChart === 'fresh' ? fresh : state.activeChart === 'rising' ? rising : hot;
  const activeContext =
    state.activeChart === 'fresh' ? freshContext : state.activeChart === 'rising' ? risingContext : hotContext;

  const chartData = {
    hot: { label: '热歌榜', tracks: hot, context: hotContext, note: '此刻最多人循环' },
    fresh: { label: '新歌榜', tracks: fresh, context: freshContext, note: '刚刚抵达岛屿' },
    rising: { label: '飙升榜', tracks: rising, context: risingContext, note: '正在上升的频率' },
  };

  const favoritesPreview = state.favorites.slice(0, 3);

  return `
    <section class="hero">
      <div class="hero-copy">
        <div class="hero-eyebrow">
          <span class="on-air-dot"></span>
          <span>SONORA RADIO</span>
          <span class="eyebrow-line"></span>
          <span>${state.home.loading ? '正在调频' : '夜间频道 07'}</span>
        </div>
        <h1>把夜晚<br />调成<span class="serif">喜欢</span>的频率<span class="hero-period">。</span></h1>
        <p class="hero-lead">在潮汐退去之后，留一盏灯，给那些还没听完的歌。声屿为你收集安静的、热烈的、刚好路过的声音。</p>
        <div class="hero-actions">
          <button class="primary-pill" data-action="play-radio">
            ${icon('play_arrow')}
            <span>开始聆听</span>
          </button>
          <button class="ghost-pill" data-action="scroll-curated">
            <span>浏览精选</span>
            ${icon('arrow_outward')}
          </button>
        </div>
        <div class="hero-stats">
          <div><strong>${String(hot.length).padStart(2, '0')}</strong><span>今日曲目</span></div>
          <span class="stat-line"></span>
          <div><strong>07</strong><span>夜间频道</span></div>
          <span class="stat-line"></span>
          <div><strong>∞</strong><span>循环可能</span></div>
        </div>
      </div>
      ${heroArt(heroTrack)}
      <span class="hero-bg-word">SONORA</span>
    </section>

    ${
      state.home.error
        ? `<div class="sync-banner">
            ${icon('wifi')}
            <p>在线曲库暂时没有回应，正在为你展示离线精选。</p>
            <button data-action="retry-home">重试</button>
          </div>`
        : ''
    }

    <section class="home-section curated-section" id="curated-section">
      ${sectionHead('01', '为你策展', '三个房间，三种夜色。', `<span class="section-meta">${SIDEBAR_PLAYLISTS.length} 张歌单</span>`)}
      <div class="curated-grid">
        ${SIDEBAR_PLAYLISTS.map((playlist, index) =>
          playlistCard(playlist, index, hot.slice(index, index + 3).length ? hot.slice(index, index + 3) : hot.slice(0, 3)),
        ).join('')}
      </div>
    </section>

    <section class="home-section">
      ${sectionHead('02', '今日推荐', '根据此刻的热度与一点私心挑选。', `<button class="section-link" data-action="play-hot-all">全部播放 ${icon('arrow_forward')}</button>`)}
      <div class="track-grid">
        ${hot.slice(0, 6).map((track, index) => trackCard(track, hotContext, index)).join('')}
      </div>
    </section>

    <section class="home-section chart-section">
      ${sectionHead('03', '正在发生', '排行榜不是答案，是一扇门。', `<span class="section-meta">${state.home.loading ? '同步中…' : '实时更新'}</span>`)}
      <div class="chart-shell">
        <div class="chart-tabs" role="tablist" aria-label="排行榜">
          ${Object.entries(chartData)
            .map(
              ([key, value]) => `
              <button class="chart-tab ${state.activeChart === key ? 'is-active' : ''}" data-chart="${key}" role="tab" aria-selected="${state.activeChart === key}">
                <span>${value.label}</span>
                <small>${value.note}</small>
              </button>`,
            )
            .join('')}
        </div>
        <div class="chart-body">
          <div class="chart-list">
            ${
              activeTracks.length
                ? activeTracks.slice(0, 8).map((track, index) => trackRow(track, activeContext, index, { showAlbum: false })).join('')
                : `<div class="inline-empty">${icon('graphic_eq')} 这一栏还在路上，先听听今日推荐。</div>`
            }
          </div>
          <div class="chart-side">
            <div class="chart-side-art" style="background:${escapeHtml(SIDEBAR_PLAYLISTS[0].gradient)}">
              ${icon('graphic_eq')}
              <span>EDITOR'S<br />PICK</span>
            </div>
            <h3>${escapeHtml(activeTrackTitle(activeTracks))}</h3>
            <p>${escapeHtml(activeTracks[0]?.artists || '正在等待第一首歌')}</p>
            <button class="round-play" data-action="play-chart" aria-label="播放当前榜单">
              ${icon('play_arrow')}
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="home-section">
      ${sectionHead('04', '按心情漫游', '不必想听什么，跟着颜色走。', `<span class="section-meta">6 个入口</span>`)}
      <div class="genre-grid">
        ${GENRES.map(
          (genre, index) => `
          <button class="genre-card" data-genre="${escapeHtml(genre.query)}" style="--genre-bg:${escapeHtml(genre.gradient)};--delay:${index * 45}ms">
            <span class="genre-glow"></span>
            <span class="genre-char">${escapeHtml(genre.emoji)}</span>
            <span class="genre-copy">
              <strong>${escapeHtml(genre.title)}</strong>
              <small>${escapeHtml(genre.subtitle)}</small>
            </span>
            <span class="genre-arrow">${icon('north_east')}</span>
          </button>`,
        ).join('')}
      </div>
    </section>

    ${
      favoritesPreview.length
        ? `<section class="home-section">
            ${sectionHead('05', '你的珍藏', '被你按下过红心的声音。', `<button class="section-link" data-view="library">查看全部 ${icon('arrow_forward')}</button>`)}
            <div class="track-grid track-grid--compact">
              ${favoritesPreview.map((track, index) => trackCard(track, registerContext('home-favorites', favoritesPreview, '我的收藏'), index)).join('')}
            </div>
          </section>`
        : ''
    }

    <footer class="page-footer">
      <span class="footer-mark">${logoMark()}</span>
      <p>声屿 ${APP_NAME_EN} · 把夜晚调成喜欢的频率</p>
      <span class="footer-note">音源来自公开在线音乐接口 · 仅供聆听与学习</span>
    </footer>
  `;
}

function activeTrackTitle(tracks = []) {
  return tracks[0]?.name || '等待下一段旋律';
}

/* ------------------------------------------------------------------ */
/*  Search                                                             */
/* ------------------------------------------------------------------ */

function searchResultsHTML() {
  const { loading, results, error, query, recentQueries } = state.search;

  if (loading) {
    return `
      <div class="search-loading">
        <div class="loading-ring">${icon('graphic_eq')}</div>
        <p>正在穿过曲库，寻找和「${escapeHtml(query)}」有关的频率…</p>
        <div class="skeleton-list">
          ${Array.from({ length: 5 }, () => `<span class="skeleton-row"><i></i><b></b><em></em></span>`).join('')}
        </div>
      </div>`;
  }

  if (error) {
    return `
      <div class="inline-state">
        ${icon('wifi')}
        <h3>这次没有听见回声</h3>
        <p>${escapeHtml(error)}</p>
        <button class="tonal-pill" data-action="retry-search">再试一次</button>
      </div>`;
  }

  if (!query) {
    return `
      <div class="search-suggest">
        ${
          recentQueries.length
            ? `<div class="suggest-block">
                <span class="suggest-label">最近寻找</span>
                <div class="suggest-chips">
                  ${recentQueries.map((item) => `<button class="suggest-chip" data-search-query="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join('')}
                </div>
              </div>`
            : ''
        }
        <div class="suggest-block">
          <span class="suggest-label">从一种心情开始</span>
          <div class="suggest-chips">
            ${MOODS.filter((mood) => mood.query)
              .map((mood) => `<button class="suggest-chip" data-search-query="${escapeHtml(mood.query)}">${escapeHtml(mood.label)}</button>`)
              .join('')}
          </div>
        </div>
        <div class="search-quote">
          <span class="quote-mark">“</span>
          <p>搜索一首歌，像在旧抽屉里找一张没有署名的明信片。</p>
          <small>输入歌名、歌手，或者只记得的一句歌词。</small>
        </div>
        <div class="suggest-block">
          <span class="suggest-label">此刻可以听</span>
          <div class="suggest-track-list">
            ${(state.charts.hot.length ? state.charts.hot : FALLBACK_TRACKS)
              .slice(0, 4)
              .map(
                (track, index) => `
                <button class="suggest-track" data-track="${escapeHtml(track.id)}" data-context="${registerContext('search-suggest', state.charts.hot.length ? state.charts.hot : FALLBACK_TRACKS, '此刻可以听')}">
                  ${coverArt(track, 'suggest-art', index)}
                  <span><strong>${escapeHtml(track.name)}</strong><small>${escapeHtml(track.artists)}</small></span>
                  ${icon('play_arrow')}
                </button>`,
              )
              .join('')}
          </div>
        </div>
      </div>`;
  }

  if (!results.length) {
    return `
      <div class="inline-state">
        ${icon('search')}
        <h3>没有找到「${escapeHtml(query)}」</h3>
        <p>换一个关键词，或者试试只输入歌手名。</p>
        <button class="tonal-pill" data-search-query="华语 流行">去听华语流行</button>
      </div>`;
  }

  const context = registerContext('search-results', results, `搜索：${query}`);

  return `
    <div class="search-result-head">
      <div>
        <span class="eyebrow-small">SEARCH RESULT</span>
        <h2>关于「${escapeHtml(query)}」</h2>
      </div>
      <button class="section-link" data-action="play-search-all">播放全部 ${icon('play_arrow')}</button>
    </div>
    <div class="result-list">
      ${results.map((track, index) => trackRow(track, context, index, { showAlbum: true })).join('')}
    </div>
    <p class="result-foot">找到 ${results.length} 首相关歌曲 · 点击任意一首开始播放</p>`;
}

function renderSearchResults() {
  const holder = $('#search-results');
  if (holder) holder.innerHTML = searchResultsHTML();
}

function renderSearchPage() {
  return `
    <section class="search-page">
      <div class="search-hero">
        <span class="eyebrow-small">FIND YOUR FREQUENCY</span>
        <h1>寻找一首<span class="serif">歌</span>，<br />也寻找那一刻的自己。</h1>
        <p>输入歌名或歌手。如果一时想不起来，就让心情带路。</p>
        <mdui-text-field
          id="page-search"
          class="page-search"
          data-search-input
          variant="outlined"
          placeholder="例如：晴天 / 陈奕迅 / 爵士"
          clearable
          value="${escapeHtml(state.search.query)}"
          aria-label="搜索歌曲或歌手"
        >
          ${icon('search', 'field-icon', 'slot="icon"')}
        </mdui-text-field>
      </div>
      <div class="mood-row" aria-label="按心情筛选">
        <span>心情</span>
        ${MOODS.map(
          (mood, index) => `
          <button class="mood-chip ${index === 0 ? 'is-active' : ''}" data-search-query="${escapeHtml(mood.query)}">
            ${escapeHtml(mood.label)}
          </button>`,
        ).join('')}
      </div>
      <div id="search-results" class="search-results">${searchResultsHTML()}</div>
    </section>`;
}

/* ------------------------------------------------------------------ */
/*  Library / recent / curated                                         */
/* ------------------------------------------------------------------ */

function emptyState({ iconName = 'music_note', title, copy, action, actionLabel }) {
  return `
    <div class="inline-state large">
      <span class="empty-icon">${icon(iconName)}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(copy)}</p>
      ${action ? `<button class="primary-pill small" data-action="${action}">${actionLabel}</button>` : ''}
    </div>`;
}

function collectionHero({ kicker, title, copy, tracks, context, gradient }) {
  const covers = tracks.slice(0, 4);
  const totalMs = tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
  return `
    <section class="collection-hero">
      <div class="collection-art" style="background:${escapeHtml(gradient || SIDEBAR_PLAYLISTS[0].gradient)}">
        <span class="collection-art-letter">${escapeHtml(Array.from(title)[0] || '声')}</span>
        <span class="collection-disc">${icon('graphic_eq')}</span>
        <span class="collection-art-caption">SONORA ARCHIVE</span>
      </div>
      <div class="collection-copy">
        <span class="eyebrow-small">${escapeHtml(kicker)}</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(copy)}</p>
        <div class="collection-meta">
          <span>${tracks.length} 首</span>
          <span class="dot"></span>
          <span>${formatMinutes(totalMs)}</span>
          <span class="dot"></span>
          <span>${state.settings.quality} kbps</span>
        </div>
        <div class="collection-actions">
          <button class="primary-pill" data-action="play-collection" data-context="${context}">
            ${icon('play_arrow')} 播放全部
          </button>
          <button class="ghost-pill" data-action="shuffle-collection" data-context="${context}">
            ${icon('shuffle')} 随机
          </button>
        </div>
      </div>
      <div class="collection-covers">
        ${covers
          .map(
            (track, index) => `
            <span class="collection-cover cover-${index + 1}">
              ${track.cover ? `<img src="${escapeHtml(track.cover)}" alt="" loading="lazy" />` : `<span style="background:${gradientFor(track.name, index)}"></span>`}
            </span>`,
          )
          .join('')}
      </div>
    </section>`;
}

function renderLibrary() {
  const tracks = rememberTracks(state.favorites);
  if (!tracks.length) {
    return `
      <section class="simple-head">
        <span class="eyebrow-small">YOUR ARCHIVE</span>
        <h1>我的<span class="serif">收藏</span></h1>
        <p>被按下红心的歌，会在这里慢慢长成一座小岛。</p>
      </section>
      ${emptyState({
        iconName: 'favorite',
        title: '这里还很安静',
        copy: '在任意歌曲旁点一下红心，把它留在这里。',
        action: 'go-home',
        actionLabel: '去发现音乐',
      })}`;
  }

  const context = registerContext('library', tracks, '我的收藏');
  return `
    ${collectionHero({
      kicker: 'YOUR ARCHIVE',
      title: '我的收藏',
      copy: '被按下红心的歌，会在这里慢慢长成一座小岛。',
      tracks,
      context,
      gradient: 'linear-gradient(140deg, #3b5548 0%, #6f8875 55%, #c7a77d 100%)',
    })}
    <section class="list-section">
      ${sectionHead('01', '珍藏曲目', `${tracks.length} 首被你留下的声音。`, `<span class="section-meta">按收藏顺序</span>`)}
      <div class="result-list">
        ${tracks.map((track, index) => trackRow(track, context, index, { showAlbum: true })).join('')}
      </div>
    </section>`;
}

function renderRecent() {
  const tracks = rememberTracks(state.recent);
  if (!tracks.length) {
    return `
      <section class="simple-head">
        <span class="eyebrow-small">LISTENING HISTORY</span>
        <h1>最近<span class="serif">播放</span></h1>
        <p>听过的歌会留下浅浅的潮痕。</p>
      </section>
      ${emptyState({
        iconName: 'history',
        title: '潮水还没有留下痕迹',
        copy: '播放任意一首歌，这里就会开始生长。',
        action: 'go-home',
        actionLabel: '去发现音乐',
      })}`;
  }

  const context = registerContext('recent', tracks, '最近播放');
  return `
    ${collectionHero({
      kicker: 'LISTENING HISTORY',
      title: '最近播放',
      copy: '听过的歌会留下浅浅的潮痕。',
      tracks,
      context,
      gradient: 'linear-gradient(140deg, #4c3f50 0%, #80666f 55%, #d2ad8d 100%)',
    })}
    <section class="list-section">
      ${sectionHead(
        '01',
        '潮痕',
        `${tracks.length} 首最近听过的歌。`,
        `<button class="section-link danger-quiet" data-action="clear-recent">${icon('delete')} 清空记录</button>`,
      )}
      <div class="result-list">
        ${tracks.map((track, index) => trackRow(track, context, index, { showAlbum: true })).join('')}
      </div>
    </section>`;
}

function renderCurated() {
  const curated = state.curated;
  if (!curated) return '';
  const { playlist, tracks, loading, error } = curated;

  if (loading) {
    return `
      ${collectionHero({
        kicker: 'SONORA EDIT',
        title: playlist.title,
        copy: playlist.subtitle,
        tracks: [],
        context: '',
        gradient: playlist.gradient,
      })}
      <div class="search-loading">
        <div class="loading-ring">${icon('graphic_eq')}</div>
        <p>正在为这个房间挑选声音…</p>
        <div class="skeleton-list">
          ${Array.from({ length: 6 }, () => `<span class="skeleton-row"><i></i><b></b><em></em></span>`).join('')}
        </div>
      </div>`;
  }

  if (error || !tracks.length) {
    return `
      <section class="simple-head">
        <span class="eyebrow-small">SONORA EDIT</span>
        <h1>${escapeHtml(playlist.title)}</h1>
        <p>${escapeHtml(playlist.subtitle)}</p>
      </section>
      ${emptyState({
        iconName: 'graphic_eq',
        title: '这个房间暂时没有声音',
        copy: error || '换一个歌单，或者稍后再来看看。',
        action: 'retry-curated',
        actionLabel: '重新挑选',
      })}`;
  }

  const context = registerContext(`curated-${playlist.id}`, tracks, playlist.title);
  return `
    ${collectionHero({
      kicker: 'SONORA EDIT',
      title: playlist.title,
      copy: playlist.subtitle,
      tracks,
      context,
      gradient: playlist.gradient,
    })}
    <section class="list-section">
      ${sectionHead('01', '房间里的声音', '按顺序播放，或者随意跳进某一首。', `<span class="section-meta">${tracks.length} 首</span>`)}
      <div class="result-list">
        ${tracks.map((track, index) => trackRow(track, context, index, { showAlbum: true })).join('')}
      </div>
    </section>`;
}

/* ------------------------------------------------------------------ */
/*  View rendering                                                     */
/* ------------------------------------------------------------------ */

function renderView({ preserveScroll = false } = {}) {
  const scroll = $('#main-scroll');
  if (!scroll) return;
  const top = preserveScroll ? scroll.scrollTop : 0;

  let markup = '';
  switch (state.view) {
    case 'search':
      markup = renderSearchPage();
      break;
    case 'library':
      markup = renderLibrary();
      break;
    case 'recent':
      markup = renderRecent();
      break;
    case 'curated':
      markup = renderCurated();
      break;
    case 'home':
    default:
      markup = renderHome();
      break;
  }

  scroll.innerHTML = `<div class="view view--${state.view}">${markup}</div>`;
  scroll.scrollTop = top;
  updateSidebarCounts();
  updateActiveNav();
  updateTopbar();

  // Resolve covers for user libraries lazily.
  if (state.view === 'library') hydrateCovers(state.favorites, 12, () => {
    if (state.view === 'library') renderView({ preserveScroll: true });
  });
  if (state.view === 'recent') hydrateCovers(state.recent, 12, () => {
    if (state.view === 'recent') renderView({ preserveScroll: true });
  });
}

function setView(view, options = {}) {
  if (!['home', 'search', 'library', 'recent', 'curated'].includes(view)) return;
  state.view = view;
  closeSidebar();
  if (view === 'curated' && !state.curated) return;
  renderView();
  const scroll = $('#main-scroll');
  if (scroll && options.top !== false) scroll.scrollTop = 0;
  if (view === 'search' && options.focus) {
    const pageSearch = $('#page-search');
    if (pageSearch) setTimeout(() => pageSearch.focus(), 60);
  }
}

function goHome() {
  setView('home');
}

/* ------------------------------------------------------------------ */
/*  Player UI                                                          */
/* ------------------------------------------------------------------ */

function emptyPlayerTemplate(compact = false) {
  return `
    <div class="player-empty ${compact ? 'player-empty--sheet' : ''}">
      <div class="empty-vinyl" aria-hidden="true">
        <span class="empty-vinyl-ring r1"></span>
        <span class="empty-vinyl-ring r2"></span>
        <span class="empty-vinyl-label">${logoMark()}</span>
      </div>
      <span class="eyebrow-small">NOW PLAYING</span>
      <h2>让音乐<br /><span class="serif">先落下来</span></h2>
      <p>从今日推荐里挑一首，或去搜索一个刚好想起的旋律。</p>
      <button class="primary-pill small" data-action="play-radio">${icon('play_arrow')} 播放今日推荐</button>
    </div>`;
}

function playerTemplate(mode = 'panel') {
  const compact = mode === 'sheet';
  const track = state.current;
  if (!track) return emptyPlayerTemplate(compact);

  const duration = state.duration || (track.duration || 0) / 1000;
  const liked = isFavorite(track.id);
  const repeatIcon = state.repeat === 'one' ? 'repeat_one' : 'repeat';
  const volumeIcon = state.muted || state.volume === 0 ? 'volume_off' : state.volume < 0.5 ? 'volume_down' : 'volume_up';

  return `
    <div class="player-inner ${compact ? 'player-inner--sheet' : ''}">
      <div class="player-top">
        <span class="player-kicker">${icon('graphic_eq')} NOW PLAYING</span>
        <button class="player-queue-button" data-action="open-queue" aria-label="查看播放队列">
          ${icon('queue_music')}<span>${state.queue.length}</span>
        </button>
        ${compact ? `<button class="sheet-close" data-action="close-sheet" aria-label="收起播放器">${icon('keyboard_arrow_down')}</button>` : ''}
      </div>

      <div class="player-cover-zone ${state.loadingStream ? 'is-buffering' : ''}">
        <span class="cover-aura" aria-hidden="true"></span>
        <div class="player-disc ${state.isPlaying ? 'is-spinning' : ''}" aria-hidden="true"></div>
        <div class="player-cover" data-art="${escapeHtml(track.id)}" style="${coverStyle(track)}">
          ${track.cover ? `<img src="${escapeHtml(track.cover)}" alt="${escapeHtml(track.name)} 封面" />` : `<span class="cover-letter">${coverMark(track)}</span>`}
        </div>
        <button class="player-like ${liked ? 'is-liked' : ''}" data-like-id="${escapeHtml(track.id)}" aria-label="${liked ? '取消收藏' : '收藏'}">
          ${icon(liked ? 'favorite-fill' : 'favorite')}
        </button>
        <span class="quality-badge">${escapeHtml(state.settings.quality)}K · ${state.loadingStream ? '加载中' : 'HI-RES'}</span>
        <span class="cover-shine" aria-hidden="true"></span>
        ${state.loadingStream ? `<span class="cover-loader"><mdui-circular-progress></mdui-circular-progress></span>` : ''}
      </div>

      <div class="player-meta">
        <div class="meta-copy">
          <h2 title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</h2>
          <p>${escapeHtml(track.artists)}</p>
          <small>${escapeHtml(track.album || '未知专辑')}</small>
        </div>
        <button class="meta-more" data-action="open-queue" aria-label="播放队列">${icon('more_horiz')}</button>
      </div>

      <div class="player-progress">
        <mdui-slider
          data-slider="progress"
          min="0"
          max="${Math.max(duration, 0.1)}"
          step="0.1"
          value="${Math.min(state.currentTime, duration || 0)}"
          aria-label="播放进度"
          nolabel
        ></mdui-slider>
        <div class="time-row">
          <span data-time-current>${formatTime(state.currentTime)}</span>
          <span data-time-total>${duration ? formatTime(duration) : '--:--'}</span>
        </div>
      </div>

      <div class="player-controls">
        <button class="control-button small ${state.shuffle ? 'is-active' : ''}" data-action="toggle-shuffle" aria-label="随机播放" aria-pressed="${state.shuffle}">
          ${icon('shuffle')}
        </button>
        <button class="control-button" data-action="previous" aria-label="上一首">${icon('skip_previous')}</button>
        <button class="play-button ${state.isPlaying ? 'is-playing' : ''}" data-action="play-toggle" aria-label="${state.isPlaying ? '暂停' : '播放'}">
          ${icon(state.isPlaying ? 'pause' : 'play_arrow')}
        </button>
        <button class="control-button" data-action="next" aria-label="下一首">${icon('skip_next')}</button>
        <button class="control-button small ${state.repeat !== 'off' ? 'is-active' : ''}" data-action="toggle-repeat" aria-label="循环模式" aria-pressed="${state.repeat !== 'off'}">
          ${icon(repeatIcon)}
        </button>
      </div>

      <div class="player-volume">
        <button class="volume-button" data-action="toggle-mute" aria-label="${state.muted ? '取消静音' : '静音'}">${icon(volumeIcon)}</button>
        <mdui-slider
          data-slider="volume"
          min="0"
          max="100"
          step="1"
          value="${Math.round((state.muted ? 0 : state.volume) * 100)}"
          aria-label="音量"
          nolabel
        ></mdui-slider>
        <span class="volume-value">${Math.round((state.muted ? 0 : state.volume) * 100)}</span>
      </div>

      <div class="lyrics-block ${compact ? 'lyrics-block--sheet' : ''}">
        <div class="lyrics-head">
          <span>${icon('lyrics')} 歌词</span>
          <span class="lyrics-state">${state.lyricsLoading ? '同步中' : state.lyrics.length ? '逐行滚动' : '纯音乐'}</span>
        </div>
        <div class="lyrics-scroll" data-lyrics-scroll>
          ${lyricsContentHTML()}
        </div>
      </div>

      <div class="player-source">
        <span>${icon('headphones')} ${escapeHtml(state.queueTitle || '声屿电台')}</span>
        <span>NETEASE · ${escapeHtml(state.settings.quality)}K</span>
      </div>
    </div>`;
}

function lyricsContentHTML() {
  if (state.lyricsLoading) {
    return `<div class="lyrics-loading"><span></span><span></span><span></span><p>正在寻找歌词…</p></div>`;
  }
  if (!state.lyrics.length) {
    return `<div class="lyrics-empty"><span>${icon('lyrics')}</span><p>这首歌没有留下歌词<br />把耳朵交给旋律吧</p></div>`;
  }
  return state.lyrics
    .map(
      (line, index) => `
      <button class="lyric-line ${index === state.activeLyric ? 'is-active' : ''}" data-seek="${line.time}" data-lyric-index="${index}">
        ${escapeHtml(line.text)}
      </button>`,
    )
    .join('');
}

function renderPlayer() {
  const panel = $('#player-panel');
  const sheetBody = $('#player-sheet-body');
  if (panel) panel.innerHTML = playerTemplate('panel');
  if (sheetBody) sheetBody.innerHTML = playerTemplate('sheet');
  updateLyricHighlight(true);
}

function renderMini() {
  const root = $('#mini-player');
  if (!root) return;
  const track = state.current;
  if (!track) {
    root.classList.remove('has-current');
    root.innerHTML = `
      <button class="mini-placeholder" data-view="home">
        <span class="mini-logo">${logoMark()}</span>
        <span><strong>还没有播放</strong><small>从今日推荐开始今晚</small></span>
        ${icon('chevron_right')}
      </button>`;
    return;
  }

  const liked = isFavorite(track.id);
  root.classList.add('has-current');
  root.innerHTML = `
    <span class="mini-progress"><i data-mini-progress></i></span>
    <button class="mini-cover" data-action="open-sheet" aria-label="打开播放器">
      ${coverArt(track, 'mini-art')}
    </button>
    <button class="mini-meta" data-action="open-sheet">
      <strong>${escapeHtml(track.name)}</strong>
      <small>${escapeHtml(track.artists)}</small>
    </button>
    <div class="mini-actions">
      <button class="mini-like ${liked ? 'is-liked' : ''}" data-like-id="${escapeHtml(track.id)}" aria-label="${liked ? '取消收藏' : '收藏'}">
        ${icon(liked ? 'favorite-fill' : 'favorite')}
      </button>
      <button class="mini-play" data-action="play-toggle" aria-label="${state.isPlaying ? '暂停' : '播放'}">
        ${icon(state.isPlaying ? 'pause' : 'play_arrow')}
      </button>
      <button class="mini-next" data-action="next" aria-label="下一首">${icon('skip_next')}</button>
    </div>`;
  updateProgressUI();
}

function updatePlayerButtons() {
  $$('[data-action="play-toggle"]').forEach((button) => {
    button.innerHTML = icon(state.isPlaying ? 'pause' : 'play_arrow');
    button.setAttribute('aria-label', state.isPlaying ? '暂停' : '播放');
    button.classList.toggle('is-playing', state.isPlaying);
  });
  $$('.player-disc, .vinyl').forEach((el) => el.classList.toggle('is-spinning', state.isPlaying));
  $$('.player-cover-zone').forEach((el) => {
    el.classList.toggle('is-buffering', state.loadingStream);
    const loader = el.querySelector('.cover-loader');
    if (state.loadingStream && !loader) {
      el.insertAdjacentHTML('beforeend', '<span class="cover-loader"><mdui-circular-progress></mdui-circular-progress></span>');
    } else if (!state.loadingStream && loader) {
      loader.remove();
    }
  });
  $$('.quality-badge').forEach((el) => (el.textContent = `${state.settings.quality}K · ${state.loadingStream ? '加载中' : 'HI-RES'}`));
  $$('.live-badge, .on-air-dot').forEach((el) => el.classList.toggle('is-live', state.isPlaying));
}

function updateProgressUI() {
  const track = state.current;
  const duration = state.duration || (track?.duration || 0) / 1000;
  const current = state.currentTime || 0;

  $$('[data-slider="progress"]').forEach((slider) => {
    slider.max = String(Math.max(duration, 0.1));
    if (!state.scrubbing) slider.value = String(Math.min(current, duration || 0));
  });
  $$('[data-time-current]').forEach((el) => (el.textContent = formatTime(current)));
  $$('[data-time-total]').forEach((el) => (el.textContent = duration ? formatTime(duration) : '--:--'));
  const mini = $('[data-mini-progress]');
  if (mini) mini.style.width = `${Math.min(100, duration ? (current / duration) * 100 : 0)}%`;
  updateLyricHighlight();
}

function updateVolumeUI() {
  const value = Math.round((state.muted ? 0 : state.volume) * 100);
  $$('[data-slider="volume"]').forEach((slider) => {
    slider.value = String(value);
  });
  $$('.volume-value').forEach((el) => (el.textContent = value));
  $$('[data-action="toggle-mute"]').forEach((button) => {
    button.innerHTML = icon(state.muted || state.volume === 0 ? 'volume_off' : state.volume < 0.5 ? 'volume_down' : 'volume_up');
  });
}

function updateLyricHighlight(forceScroll = false) {
  if (!state.lyrics.length) return;
  if (state.activeLyric < 0) return;
  $$('.lyrics-scroll').forEach((scroll) => {
    const lines = $$('.lyric-line', scroll);
    const active = lines[state.activeLyric];
    lines.forEach((line, index) => {
      line.classList.toggle('is-active', index === state.activeLyric);
      line.classList.toggle('is-past', index < state.activeLyric);
    });
    if (active && (forceScroll || scroll.dataset.lastActive !== String(state.activeLyric))) {
      scroll.dataset.lastActive = String(state.activeLyric);
      const top = active.offsetTop - scroll.clientHeight / 2 + active.clientHeight / 2;
      scroll.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  });
}

function renderLyricsOnly() {
  $$('.lyrics-scroll').forEach((scroll) => {
    scroll.innerHTML = lyricsContentHTML();
    scroll.dataset.lastActive = '';
  });
  updateLyricHighlight(true);
}

/* ------------------------------------------------------------------ */
/*  Queue                                                              */
/* ------------------------------------------------------------------ */

function renderQueue() {
  const drawer = $('#queue-drawer');
  if (!drawer) return;
  const current = state.current;
  const totalMs = state.queue.reduce((sum, track) => sum + (track.duration || 0), 0);

  drawer.innerHTML = `
    <div class="queue-head">
      <div>
        <span class="eyebrow-small">UP NEXT</span>
        <h2>播放队列</h2>
      </div>
      <button class="icon-button" data-action="close-queue" aria-label="关闭队列">${icon('close')}</button>
    </div>
    <div class="queue-meta">
      <span>${state.queue.length} 首</span>
      <span class="dot"></span>
      <span>${formatMinutes(totalMs)}</span>
      ${
        state.queue.length > 1
          ? `<button class="queue-clear" data-action="clear-queue">${icon('delete_sweep')} 清空待播</button>`
          : ''
      }
    </div>
    ${
      current
        ? `<div class="queue-now">
            ${coverArt(current, 'queue-now-art')}
            <div><span>正在播放</span><strong>${escapeHtml(current.name)}</strong><small>${escapeHtml(current.artists)}</small></div>
            <span class="queue-eq"><i></i><i></i><i></i></span>
          </div>`
        : ''
    }
    <div class="queue-list">
      ${
        state.queue.length
          ? state.queue
              .map(
                (track, index) => `
                <div class="queue-item ${isCurrent(track.id) ? 'is-current' : ''}">
                  <button class="queue-play" data-action="play-queue-index" data-index="${index}">
                    <span class="queue-index">${isCurrent(track.id) ? icon('graphic_eq') : String(index + 1).padStart(2, '0')}</span>
                    ${coverArt(track, 'queue-art', index)}
                    <span class="queue-copy"><strong>${escapeHtml(track.name)}</strong><small>${escapeHtml(track.artists)}</small></span>
                  </button>
                  <span class="queue-time">${formatDuration(track.duration)}</span>
                  <button class="queue-remove" data-action="queue-remove" data-index="${index}" aria-label="从队列移除">${icon('close')}</button>
                </div>`,
              )
              .join('')
          : `<div class="queue-empty">${icon('queue_music')} <p>队列是空的<br />去挑一首歌吧</p><button class="tonal-pill" data-action="go-home">去发现</button></div>`
      }
    </div>
    <button class="queue-footer" data-action="close-queue">
      <span>${icon('headphones')} 继续聆听</span>
      ${icon('arrow_forward')}
    </button>`;
}

function openQueue() {
  renderQueue();
  document.body.classList.add('queue-open');
  state.queueOpen = true;
  $('#queue-drawer')?.setAttribute('aria-hidden', 'false');
}

function closeQueue() {
  document.body.classList.remove('queue-open');
  state.queueOpen = false;
  $('#queue-drawer')?.setAttribute('aria-hidden', 'true');
}

function openSheet() {
  if (!state.current) {
    startQueue([...state.charts.hot], 0, '今日推荐');
    return;
  }
  renderPlayer();
  document.body.classList.add('sheet-open');
  state.sheetOpen = true;
  $('#player-sheet')?.setAttribute('aria-hidden', 'false');
}

function closeSheet() {
  document.body.classList.remove('sheet-open');
  state.sheetOpen = false;
  $('#player-sheet')?.setAttribute('aria-hidden', 'true');
}

/* ------------------------------------------------------------------ */
/*  Audio engine                                                       */
/* ------------------------------------------------------------------ */

function setupAudio() {
  audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = state.volume;
  audio.muted = state.muted;

  audio.addEventListener('timeupdate', () => {
    if (!audio) return;
    state.currentTime = audio.currentTime || 0;
    updateProgressUI();
    updateMediaSessionPosition();
  });
  audio.addEventListener('durationchange', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      state.duration = audio.duration;
      updateProgressUI();
    }
  });
  audio.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      state.duration = audio.duration;
      updateProgressUI();
    }
  });
  audio.addEventListener('play', () => {
    state.isPlaying = true;
    state.playError = '';
    updatePlayerButtons();
    updateMediaSessionState('playing');
    updateTopbar();
  });
  audio.addEventListener('pause', () => {
    state.isPlaying = false;
    updatePlayerButtons();
    updateMediaSessionState('paused');
  });
  audio.addEventListener('waiting', () => {
    state.loadingStream = true;
    updatePlayerButtons();
  });
  audio.addEventListener('playing', () => {
    state.loadingStream = false;
    state.isPlaying = true;
    updatePlayerButtons();
  });
  audio.addEventListener('ended', handleTrackEnded);
  audio.addEventListener('error', () => {
    if (!audio.src) return;
    state.loadingStream = false;
    state.isPlaying = false;
    state.playError = '音源加载失败，请稍后重试';
    updatePlayerButtons();
    toast('这首歌暂时无法播放，换一首试试', { iconName: 'wifi' });
  });
}

function handleTrackEnded() {
  if (state.repeat === 'one') {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }
  const isLast = state.currentIndex >= state.queue.length - 1;
  if (isLast && state.repeat !== 'all') {
    state.isPlaying = false;
    state.currentTime = 0;
    audio.currentTime = 0;
    updatePlayerButtons();
    updateProgressUI();
    return;
  }
  nextTrack(false);
}

async function getStream(track) {
  const key = `${track.id}:${state.settings.quality}`;
  if (streamCache.has(key)) return streamCache.get(key);
  const url = await fetchStreamUrl(track.id, state.settings.quality);
  streamCache.set(key, url);
  return url;
}

async function loadCurrent({ autoplay = true, resumeAt = 0 } = {}) {
  const track = state.current;
  if (!track) return;

  const token = ++playToken;
  state.loadingStream = true;
  state.isPlaying = false;
  state.playError = '';
  state.currentTime = resumeAt || 0;
  state.duration = (track.duration || 0) / 1000;
  state.activeLyric = -1;
  rememberTrack(track);
  renderPlayer();
  renderMini();
  updatePlayerButtons();
  addRecent(track);
  store.write('sonora:last-track', track);
  loadLyrics(track, token);
  updateMediaSessionMetadata();

  try {
    const url = await getStream(track);
    if (token !== playToken) return;
    audio.src = url;
    audio.currentTime = resumeAt || 0;
    if (autoplay) {
      await audio.play();
    }
  } catch (error) {
    if (token !== playToken) return;
    state.loadingStream = false;
    state.isPlaying = false;
    state.playError = networkErrorMessage(error, '这首歌暂时无法获取播放地址，请稍后再试');
    updatePlayerButtons();
    toast(state.playError, { duration: 3200 });
  } finally {
    if (token === playToken) {
      state.loadingStream = false;
      updatePlayerButtons();
    }
  }
}

async function loadLyrics(track, token) {
  state.lyrics = [];
  state.lyricsTrackId = String(track.id);
  state.activeLyric = -1;
  const cached = lyricCache.get(String(track.id));
  if (cached) {
    if (token !== playToken) return;
    state.lyrics = cached;
    state.lyricsLoading = false;
    renderLyricsOnly();
    return;
  }

  state.lyricsLoading = true;
  renderLyricsOnly();
  try {
    const raw = await fetchLyrics(track.id);
    const parsed = parseLrc(raw);
    lyricCache.set(String(track.id), parsed);
    if (token !== playToken || String(state.current?.id) !== String(track.id)) return;
    state.lyrics = parsed;
  } catch {
    if (token !== playToken) return;
    state.lyrics = [];
  } finally {
    if (token === playToken) {
      state.lyricsLoading = false;
      renderLyricsOnly();
      $$('.lyrics-state').forEach((el) => {
        el.textContent = state.lyrics.length ? '逐行滚动' : '纯音乐';
      });
    }
  }
}

function updateActiveLyric() {
  const time = audio?.currentTime || 0;
  const lyrics = state.lyrics;
  if (!lyrics.length) return;
  let low = 0;
  let high = lyrics.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lyrics[mid].time <= time + 0.15) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (found !== state.activeLyric) {
    state.activeLyric = found;
    updateLyricHighlight();
  }
}

const lyricTicker = setInterval(updateActiveLyric, 260);

function startQueue(tracks, index = 0, title = '声屿电台', { autoplay = true } = {}) {
  if (!tracks.length) return;
  state.queue = tracks.map(rememberTrack);
  state.queueTitle = title;
  state.currentIndex = Math.max(0, Math.min(index, tracks.length - 1));
  state.current = state.queue[state.currentIndex];
  renderQueue();
  loadCurrent({ autoplay });
}

function playFromContext(trackId, contextName) {
  const context = contexts.get(contextName);
  if (!context) {
    const track = trackById(trackId);
    if (track) startQueue([track], 0, '单曲播放');
    return;
  }
  const index = context.tracks.findIndex((track) => String(track.id) === String(trackId));
  if (index < 0) return;

  if (state.current && String(state.current.id) === String(trackId) && audio?.src) {
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
    return;
  }
  startQueue(context.tracks, index, context.title);
}

function togglePlay() {
  if (!state.current) {
    startQueue([...state.charts.hot], 0, '今日推荐');
    return;
  }
  if (!audio?.src) {
    loadCurrent({ autoplay: true });
    return;
  }
  if (audio.paused) {
    audio.play().catch((error) => toast(error?.message || '播放被浏览器拦截，再点一次试试'));
  } else {
    audio.pause();
  }
}

function nextTrack(manual = true) {
  if (!state.queue.length) return;
  let next = state.currentIndex + 1;
  if (state.shuffle) {
    next = Math.floor(Math.random() * state.queue.length);
    if (state.queue.length > 1 && next === state.currentIndex) next = (next + 1) % state.queue.length;
  }
  if (next >= state.queue.length) {
    if (manual || state.repeat === 'all') next = 0;
    else return;
  }
  state.currentIndex = next;
  state.current = state.queue[next];
  loadCurrent({ autoplay: true });
}

function previousTrack() {
  if (!state.queue.length) return;
  if (audio && audio.currentTime > 3.2) {
    audio.currentTime = 0;
    state.currentTime = 0;
    updateProgressUI();
    return;
  }
  let prev = state.currentIndex - 1;
  if (prev < 0) prev = state.queue.length - 1;
  state.currentIndex = prev;
  state.current = state.queue[prev];
  loadCurrent({ autoplay: true });
}

function toggleShuffle() {
  state.shuffle = !state.shuffle;
  $$('[data-action="toggle-shuffle"]').forEach((button) => {
    button.classList.toggle('is-active', state.shuffle);
    button.setAttribute('aria-pressed', String(state.shuffle));
  });
  toast(state.shuffle ? '随机播放已开启' : '随机播放已关闭', { iconName: 'shuffle' });
}

function toggleRepeat() {
  state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
  const iconName = state.repeat === 'one' ? 'repeat_one' : 'repeat';
  $$('[data-action="toggle-repeat"]').forEach((button) => {
    button.innerHTML = icon(iconName);
    button.classList.toggle('is-active', state.repeat !== 'off');
    button.setAttribute('aria-pressed', String(state.repeat !== 'off'));
  });
  const labels = { off: '循环播放已关闭', all: '列表循环', one: '单曲循环' };
  toast(labels[state.repeat], { iconName });
}

function toggleMute() {
  state.muted = !state.muted;
  if (audio) audio.muted = state.muted;
  updateVolumeUI();
  store.write('sonora:volume', state.volume);
}

function seekTo(seconds) {
  if (!audio) return;
  audio.currentTime = Math.max(0, Number(seconds) || 0);
  state.currentTime = audio.currentTime;
  updateProgressUI();
}

async function playSearchResult(index) {
  const tracks = state.search.results;
  if (!tracks[index]) return;
  startQueue(tracks, index, `搜索：${state.search.query}`);
}

/* ------------------------------------------------------------------ */
/*  Search actions                                                     */
/* ------------------------------------------------------------------ */

function networkErrorMessage(error, fallback = '在线曲库暂时没有回应，请稍后再试') {
  const message = String(error?.message || '');
  if (error?.name === 'AbortError' || /timeout|abort/i.test(message)) return '连接超时，请稍后再试';
  if (/NetworkError|Failed to fetch|Load failed|fetch|5\d\d/i.test(message)) return fallback;
  return message || fallback;
}

async function runSearch(rawQuery, { immediate = false } = {}) {
  const query = String(rawQuery || '').trim();
  state.search.query = query;
  state.search.error = '';

  if (!query) {
    state.search.results = [];
    state.search.loading = false;
    renderSearchResults();
    return;
  }

  const token = ++searchToken;
  state.search.loading = true;
  state.search.error = '';
  if (state.view !== 'search') setView('search');
  else renderSearchResults();
  syncSearchInputs(query);

  try {
    const results = await searchMusic(query, 24);
    if (token !== searchToken) return;
    state.search.results = rememberTracks(results);
    state.search.loading = false;
    state.search.recentQueries = [query, ...state.search.recentQueries.filter((item) => item !== query)].slice(0, 6);
    store.write('sonora:searches', state.search.recentQueries);
    renderSearchResults();
    hydrateCovers(results, 12, () => {
      if (state.search.query !== query) return;
      renderSearchResults();
    });
  } catch (error) {
    if (token !== searchToken) return;
    state.search.loading = false;
    state.search.error = networkErrorMessage(error);
    renderSearchResults();
  }
}

const debouncedRunSearch = debounce((query) => runSearch(query), 520);

function syncSearchInputs(value) {
  $$('[data-search-input]').forEach((input) => {
    if (input !== document.activeElement && input.value !== value) input.value = value;
  });
}

async function hydrateCovers(tracks, limit = 10, onUpdate) {
  const targets = tracks.filter((track) => !track.cover && track.picId).slice(0, limit);
  if (!targets.length) return;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(4, targets.length) }, async () => {
    while (cursor < targets.length) {
      const track = targets[cursor++];
      const cacheKey = String(track.picId);
      let cover = coverCache.get(cacheKey);
      if (!cover) {
        cover = await resolveCover(track.picId, 500).catch(() => '');
        if (cover) coverCache.set(cacheKey, cover);
      }
      if (!cover) continue;
      track.cover = cover;
      rememberTrack(track);
      updateTrackArtwork(track.id, cover);
      if (state.current && String(state.current.id) === String(track.id)) {
        state.current.cover = cover;
        renderPlayer();
        renderMini();
      }
      onUpdate?.();
    }
  });
  await Promise.all(workers);
}

function updateTrackArtwork(id, cover) {
  $$(`[data-art="${CSS.escape(String(id))}"]`).forEach((holder) => {
    if (!cover) return;
    let img = holder.querySelector('img');
    if (!img) {
      holder.innerHTML = `<img src="${escapeHtml(cover)}" alt="" loading="lazy" />`;
    } else {
      img.src = cover;
      img.hidden = false;
    }
    holder.classList.add('has-art');
  });
}

/* ------------------------------------------------------------------ */
/*  Favorites / history                                                */
/* ------------------------------------------------------------------ */

function addRecent(track) {
  if (!track) return;
  state.recent = [track, ...state.recent.filter((item) => String(item.id) !== String(track.id))].slice(0, 30);
  store.write('sonora:recent', state.recent);
}

function toggleFavorite(id) {
  const track = trackById(id) || (isCurrent(id) ? state.current : null);
  if (!track) return;
  const existing = isFavorite(id);
  if (existing) {
    state.favorites = state.favorites.filter((item) => String(item.id) !== String(id));
    toast(`已从收藏中移除「${track.name}」`, { iconName: 'favorite' });
  } else {
    state.favorites = [rememberTrack(track), ...state.favorites].slice(0, 100);
    toast(`已收藏「${track.name}」`, { iconName: 'favorite-fill' });
  }
  store.write('sonora:favorites', state.favorites);
  updateFavoriteUI(id, !existing);
  updateSidebarCounts();
  if (state.view === 'library') renderView({ preserveScroll: true });
}

function updateFavoriteUI(id, liked) {
  $$(`[data-like-id="${CSS.escape(String(id))}"]`).forEach((button) => {
    button.classList.toggle('is-liked', liked);
    button.innerHTML = icon(liked ? 'favorite-fill' : 'favorite');
    button.setAttribute('aria-label', liked ? '取消收藏' : '收藏');
  });
}

function clearRecent() {
  state.recent = [];
  store.write('sonora:recent', []);
  renderView();
  toast('最近播放已清空', { iconName: 'history' });
}

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

function applyTheme(mode = state.settings.theme) {
  const media = window.matchMedia('(prefers-color-scheme: light)');
  const dark = mode === 'dark' || (mode === 'auto' && !media.matches);
  const html = document.documentElement;
  html.classList.toggle('mdui-theme-dark', dark);
  html.classList.toggle('mdui-theme-light', !dark);
  html.dataset.theme = dark ? 'dark' : 'light';
  html.dataset.themeMode = mode;
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0d1613' : '#f2f0e8');
}

function applySeed(seed) {
  state.settings.seed = seed;
  document.documentElement.style.setProperty('--seed', seed);
  try {
    setColorScheme(seed);
  } catch {
    /* mdui falls back to its default scheme */
  }
}

function persistSettings() {
  store.write('sonora:settings', state.settings);
}

function openSettings() {
  const existing = $('#settings-dialog');
  if (existing) {
    existing.open = true;
    return;
  }

  const dialog = document.createElement('mdui-dialog');
  dialog.id = 'settings-dialog';
  dialog.className = 'settings-dialog';
  dialog.setAttribute('close-on-overlay-click', '');
  dialog.innerHTML = `
    <div class="settings-head">
      <div>
        <span class="eyebrow-small">SETTINGS</span>
        <h2>把声屿调成你的样子</h2>
      </div>
      <button class="icon-button" data-action="close-settings" aria-label="关闭设置">${icon('close')}</button>
    </div>
    <div class="settings-body">
      <section class="settings-group">
        <div class="settings-label"><span>${icon('light_mode')} 外观</span><small>选择岛屿的光线</small></div>
        <div class="theme-picker">
          <button class="theme-choice ${state.settings.theme === 'dark' ? 'is-active' : ''}" data-action="set-theme" data-value="dark">
            <span class="theme-preview preview-dark"><i></i><i></i></span>
            <span>深色</span>
            ${icon('dark_mode')}
          </button>
          <button class="theme-choice ${state.settings.theme === 'light' ? 'is-active' : ''}" data-action="set-theme" data-value="light">
            <span class="theme-preview preview-light"><i></i><i></i></span>
            <span>浅色</span>
            ${icon('light_mode')}
          </button>
          <button class="theme-choice ${state.settings.theme === 'auto' ? 'is-active' : ''}" data-action="set-theme" data-value="auto">
            <span class="theme-preview preview-auto"><i></i><i></i></span>
            <span>跟随</span>
            ${icon('brightness_auto')}
          </button>
        </div>
      </section>

      <section class="settings-group">
        <div class="settings-label"><span>${icon('palette')} 岛屿颜色</span><small>改变强调色与组件配色</small></div>
        <div class="seed-picker">
          ${SEEDS.map(
            (seed) => `
            <button class="seed-choice ${state.settings.seed === seed.value ? 'is-active' : ''}" data-action="set-seed" data-value="${seed.value}" aria-label="${seed.name}">
              <span style="background:${seed.value}"></span>
              <small>${seed.name}</small>
              ${icon('check_circle')}
            </button>`,
          ).join('')}
        </div>
      </section>

      <section class="settings-group">
        <div class="settings-label"><span>${icon('headphones')} 音质</span><small>重新加载当前歌曲后生效</small></div>
        <div class="quality-picker">
          ${QUALITY_OPTIONS.map(
            (quality) => `
            <button class="quality-choice ${state.settings.quality === quality.value ? 'is-active' : ''}" data-action="set-quality" data-value="${quality.value}">
              <strong>${quality.label}</strong>
              <small>${quality.detail}</small>
              ${icon('check_circle')}
            </button>`,
          ).join('')}
        </div>
      </section>

      <section class="settings-group settings-switches">
        <label class="switch-row">
          <span><strong>柔和动效</strong><small>关闭大范围的漂浮与旋转动画</small></span>
          <mdui-switch id="motion-switch" ${state.settings.motion ? 'checked' : ''}></mdui-switch>
        </label>
        <div class="switch-row static">
          <span><strong>在线音源</strong><small>网易云公开接口 · 免费曲目</small></span>
          <span class="status-chip"><i></i> 已连接</span>
        </div>
      </section>

      <div class="settings-about">
        ${logoMark()}
        <p>声屿 ${APP_NAME_EN} · v1.0<br /><small>把夜晚调成喜欢的频率。音乐仅供试听与学习。</small></p>
      </div>
    </div>`;

  $('#dialog-root').append(dialog);
  dialog.open = true;

  const motion = $('#motion-switch', dialog);
  motion?.addEventListener('change', (event) => {
    state.settings.motion = event.target.checked;
    document.documentElement.classList.toggle('reduce-motion', !state.settings.motion);
    persistSettings();
  });
}

function closeSettings() {
  const dialog = $('#settings-dialog');
  if (!dialog) return;
  dialog.open = false;
  setTimeout(() => dialog.remove(), 220);
}

function changeQuality(value) {
  if (state.settings.quality === value) return;
  const resumeAt = audio?.currentTime || 0;
  const wasPlaying = Boolean(state.isPlaying);
  state.settings.quality = value;
  persistSettings();
  $$('[data-action="set-quality"]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.value === value);
  });
  if (state.current) {
    loadCurrent({ autoplay: wasPlaying, resumeAt });
  }
  toast(`已切换到 ${value} kbps · ${QUALITY_OPTIONS.find((item) => item.value === value)?.label || ''}`, {
    iconName: 'graphic_eq',
  });
}

/* ------------------------------------------------------------------ */
/*  Media Session                                                      */
/* ------------------------------------------------------------------ */

function updateMediaSessionMetadata() {
  if (!('mediaSession' in navigator) || !state.current) return;
  const track = state.current;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist: track.artists,
      album: track.album || '',
      artwork: track.cover ? [{ src: track.cover, sizes: '600x600', type: 'image/jpeg' }] : [],
    });
  } catch {
    /* older browsers */
  }
}

function updateMediaSessionState(playbackState) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.playbackState = playbackState;
  } catch {
    /* noop */
  }
}

function updateMediaSessionPosition() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  if (!Number.isFinite(audio?.duration) || audio.duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate || 1,
      position: Math.min(audio.currentTime || 0, audio.duration),
    });
  } catch {
    /* noop */
  }
}

function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.setActionHandler('play', () => togglePlay());
  navigator.mediaSession.setActionHandler('pause', () => togglePlay());
  navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack(true));
  navigator.mediaSession.setActionHandler('previoustrack', () => previousTrack());
  navigator.mediaSession.setActionHandler('seekbackward', () => seekTo((audio?.currentTime || 0) - 10));
  navigator.mediaSession.setActionHandler('seekforward', () => seekTo((audio?.currentTime || 0) + 10));
}

/* ------------------------------------------------------------------ */
/*  Toasts                                                             */
/* ------------------------------------------------------------------ */

let toastTimer;
function toast(message, { iconName = 'music_note', duration = 2600 } = {}) {
  const region = $('#toast-region');
  if (!region) return;
  clearTimeout(toastTimer);
  region.innerHTML = `<div class="toast">${icon(iconName)}<span>${escapeHtml(message)}</span></div>`;
  const el = $('.toast', region);
  requestAnimationFrame(() => el?.classList.add('is-visible'));
  toastTimer = setTimeout(() => {
    el?.classList.remove('is-visible');
    setTimeout(() => (region.innerHTML = ''), 260);
  }, duration);
}

/* ------------------------------------------------------------------ */
/*  Data loading                                                       */
/* ------------------------------------------------------------------ */

async function loadHome() {
  state.home.loading = true;
  if (state.view === 'home') renderView({ preserveScroll: true });

  const results = await Promise.allSettled([
    fetchPlaylist(CHART_IDS.hot),
    fetchPlaylist(CHART_IDS.fresh),
    fetchPlaylist(CHART_IDS.rising),
  ]);

  const [hot, fresh, rising] = results;
  let success = 0;
  if (hot.status === 'fulfilled' && hot.value.length) {
    state.charts.hot = rememberTracks(hot.value);
    success += 1;
  }
  if (fresh.status === 'fulfilled' && fresh.value.length) {
    state.charts.fresh = rememberTracks(fresh.value);
    success += 1;
  }
  if (rising.status === 'fulfilled' && rising.value.length) {
    state.charts.rising = rememberTracks(rising.value);
    success += 1;
  }

  state.home.loading = false;
  state.home.error = success === 0 ? '在线曲库暂时没有回应' : '';
  if (state.view === 'home') renderView({ preserveScroll: true });
  // Keep search suggestion context fresh.
  if (state.view === 'search') renderSearchResults();
}

async function openCurated(playlistId) {
  const playlist = SIDEBAR_PLAYLISTS.find((item) => item.id === playlistId);
  if (!playlist) return;
  state.curated = { playlist, loading: true, tracks: [], error: '' };
  setView('curated');
  try {
    let tracks = await searchMusic(playlist.query, 24);
    if (!tracks.length) {
      const fallbackQuery = playlist.query.split(' ').slice(0, 2).join(' ');
      if (fallbackQuery && fallbackQuery !== playlist.query) tracks = await searchMusic(fallbackQuery, 24);
    }
    if (!state.curated || state.curated.playlist.id !== playlist.id) return;
    state.curated.tracks = rememberTracks(tracks);
    state.curated.loading = false;
    if (state.view === 'curated') renderView({ preserveScroll: true });
    hydrateCovers(state.curated.tracks, 12, () => {
      if (state.view === 'curated' && state.curated?.playlist.id === playlist.id) {
        renderView({ preserveScroll: true });
      }
    });
  } catch (error) {
    if (!state.curated) return;
    state.curated.loading = false;
    state.curated.error = networkErrorMessage(error, '歌单暂时没有回应，请稍后再试');
    if (state.view === 'curated') renderView({ preserveScroll: true });
  }
}

function retryCurated() {
  if (state.curated?.playlist) openCurated(state.curated.playlist.id);
}

/* ------------------------------------------------------------------ */
/*  Event handling                                                     */
/* ------------------------------------------------------------------ */

function closeSidebar() {
  state.sidebarOpen = false;
  document.body.classList.remove('sidebar-open');
  $('#sidebar')?.classList.remove('is-open');
  $('.sidebar-scrim')?.classList.remove('is-visible');
}

function openSidebar() {
  state.sidebarOpen = true;
  document.body.classList.add('sidebar-open');
  $('#sidebar')?.classList.add('is-open');
  $('.sidebar-scrim')?.classList.add('is-visible');
}

function handleAction(actionEl) {
  const action = actionEl.dataset.action;
  if (!action) return false;

  switch (action) {
    case 'play-radio': {
      const tracks = state.charts.hot.length ? state.charts.hot : FALLBACK_TRACKS;
      const index = Math.floor(Math.random() * Math.min(6, tracks.length));
      startQueue([...tracks], index, '今日推荐');
      return true;
    }
    case 'play-hot-all':
      startQueue([...state.charts.hot], 0, '今日推荐');
      return true;
    case 'play-chart': {
      const tracks = state.charts[state.activeChart]?.length ? state.charts[state.activeChart] : state.charts.hot;
      const title = state.activeChart === 'fresh' ? '新歌榜' : state.activeChart === 'rising' ? '飙升榜' : '热歌榜';
      startQueue([...tracks], 0, title);
      return true;
    }
    case 'play-search-all':
      startQueue([...state.search.results], 0, `搜索：${state.search.query}`);
      return true;
    case 'retry-search':
      runSearch(state.search.query, { immediate: true });
      return true;
    case 'retry-home':
      loadHome();
      return true;
    case 'retry-curated':
      retryCurated();
      return true;
    case 'scroll-curated':
      $('#curated-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    case 'play-toggle':
      togglePlay();
      return true;
    case 'next':
      nextTrack(true);
      return true;
    case 'previous':
      previousTrack();
      return true;
    case 'toggle-shuffle':
      toggleShuffle();
      return true;
    case 'toggle-repeat':
      toggleRepeat();
      return true;
    case 'toggle-mute':
      toggleMute();
      return true;
    case 'open-queue':
      openQueue();
      return true;
    case 'close-queue':
      closeQueue();
      return true;
    case 'open-sheet':
      openSheet();
      return true;
    case 'close-sheet':
      closeSheet();
      return true;
    case 'open-settings':
      openSettings();
      return true;
    case 'close-settings':
      closeSettings();
      return true;
    case 'open-sidebar':
      openSidebar();
      return true;
    case 'close-sidebar':
      closeSidebar();
      return true;
    case 'go-home':
      goHome();
      return true;
    case 'clear-recent':
      clearRecent();
      return true;
    case 'play-collection':
    case 'shuffle-collection': {
      const context = contexts.get(actionEl.dataset.context);
      if (!context?.tracks.length) return true;
      const tracks = action === 'shuffle-collection' ? [...context.tracks].sort(() => Math.random() - 0.5) : [...context.tracks];
      startQueue(tracks, 0, context.title);
      return true;
    }
    case 'play-queue-index': {
      const index = Number(actionEl.dataset.index);
      const track = state.queue[index];
      if (!track) return true;
      state.currentIndex = index;
      state.current = track;
      loadCurrent({ autoplay: true });
      closeQueue();
      return true;
    }
    case 'queue-remove': {
      const index = Number(actionEl.dataset.index);
      if (!Number.isInteger(index) || index < 0) return true;
      const removingCurrent = index === state.currentIndex;
      state.queue.splice(index, 1);
      if (removingCurrent) {
        if (state.queue.length) {
          state.currentIndex = Math.min(index, state.queue.length - 1);
          state.current = state.queue[state.currentIndex];
          loadCurrent({ autoplay: true });
        } else {
          audio?.pause();
          state.current = null;
          state.currentIndex = -1;
          state.isPlaying = false;
          state.queueTitle = '';
          renderPlayer();
          renderMini();
        }
      } else if (index < state.currentIndex) {
        state.currentIndex -= 1;
      }
      renderQueue();
      return true;
    }
    case 'clear-queue': {
      const current = state.current;
      state.queue = current ? [current] : [];
      state.currentIndex = current ? 0 : -1;
      renderQueue();
      toast('已清空待播歌曲', { iconName: 'queue_music' });
      return true;
    }
    case 'set-theme': {
      const value = actionEl.dataset.value;
      state.settings.theme = value;
      applyTheme(value);
      persistSettings();
      $$('[data-action="set-theme"]').forEach((button) => button.classList.toggle('is-active', button.dataset.value === value));
      return true;
    }
    case 'set-seed': {
      const value = actionEl.dataset.value;
      applySeed(value);
      persistSettings();
      $$('[data-action="set-seed"]').forEach((button) => button.classList.toggle('is-active', button.dataset.value === value));
      return true;
    }
    case 'set-quality': {
      changeQuality(actionEl.dataset.value);
      return true;
    }
    case 'seek':
      seekTo(actionEl.dataset.time);
      return true;
    default:
      return false;
  }
}

function initEvents() {
  document.addEventListener('click', (event) => {
    const like = event.target.closest('[data-like-id]');
    if (like) {
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite(like.dataset.likeId);
      return;
    }

    const actionEl = event.target.closest('[data-action]');
    if (actionEl && handleAction(actionEl)) {
      event.preventDefault();
      return;
    }

    const nav = event.target.closest('[data-view]');
    if (nav) {
      event.preventDefault();
      setView(nav.dataset.view, { focus: nav.dataset.view === 'search' });
      return;
    }

    const curated = event.target.closest('[data-curated]');
    if (curated) {
      event.preventDefault();
      openCurated(curated.dataset.curated);
      return;
    }

    const chart = event.target.closest('[data-chart]');
    if (chart) {
      event.preventDefault();
      state.activeChart = chart.dataset.chart;
      renderView({ preserveScroll: true });
      return;
    }

    const genre = event.target.closest('[data-genre]');
    if (genre) {
      event.preventDefault();
      state.search.query = genre.dataset.genre;
      syncSearchInputs(state.search.query);
      runSearch(genre.dataset.genre, { immediate: true });
      return;
    }

    const searchQuery = event.target.closest('[data-search-query]');
    if (searchQuery) {
      event.preventDefault();
      const query = searchQuery.dataset.searchQuery;
      state.search.query = query;
      syncSearchInputs(query);
      runSearch(query, { immediate: true });
      return;
    }

    const track = event.target.closest('[data-track]');
    if (track) {
      event.preventDefault();
      playFromContext(track.dataset.track, track.dataset.context);
    }
  });

  document.addEventListener('keydown', (event) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    const isTyping = tag === 'input' || tag === 'textarea' || document.activeElement?.closest('mdui-text-field');

    if (event.key === 'Escape') {
      if (document.body.classList.contains('queue-open')) {
        closeQueue();
        return;
      }
      if (document.body.classList.contains('sheet-open')) {
        closeSheet();
        return;
      }
      if ($('#settings-dialog')) {
        closeSettings();
        return;
      }
      if (document.body.classList.contains('sidebar-open')) {
        closeSidebar();
      }
      return;
    }

    if (event.key === '/' && !isTyping) {
      event.preventDefault();
      const field = document.activeElement?.id === 'page-search' ? $('#page-search') : $('#global-search');
      field?.focus();
      return;
    }

    if (event.code === 'Space' && !isTyping && !$('#settings-dialog')) {
      event.preventDefault();
      togglePlay();
      return;
    }

    if (event.key === 'Enter') {
      const track = event.target.closest?.('[data-track]');
      if (track) {
        event.preventDefault();
        playFromContext(track.dataset.track, track.dataset.context);
      }
    }
  });

  document.addEventListener(
    'input',
    (event) => {
      const input = event.target.closest('[data-search-input]');
      if (input) {
        state.search.query = input.value;
        if (!input.value.trim()) {
          state.search.results = [];
          state.search.loading = false;
          renderSearchResults();
          if (state.view !== 'search') setView('search', { focus: false });
          return;
        }
        if (state.view !== 'search') setView('search', { focus: false });
        debouncedRunSearch(input.value);
        return;
      }

      const slider = event.target.closest('mdui-slider');
      if (!slider) return;
      if (slider.dataset.slider === 'progress') {
        state.scrubbing = true;
        state.currentTime = Number(slider.value) || 0;
        $$('[data-time-current]').forEach((el) => (el.textContent = formatTime(state.currentTime)));
      } else if (slider.dataset.slider === 'volume') {
        state.volume = (Number(slider.value) || 0) / 100;
        state.muted = state.volume === 0;
        if (audio) {
          audio.volume = state.volume;
          audio.muted = state.muted;
        }
        store.write('sonora:volume', state.volume);
        updateVolumeUI();
      }
    },
    true,
  );

  document.addEventListener(
    'change',
    (event) => {
      const slider = event.target.closest('mdui-slider');
      if (!slider) return;
      if (slider.dataset.slider === 'progress') {
        state.scrubbing = false;
        const time = Number(slider.value) || 0;
        if (audio?.src) seekTo(time);
        else {
          state.currentTime = time;
          updateProgressUI();
        }
      } else if (slider.dataset.slider === 'volume') {
        state.volume = (Number(slider.value) || 0) / 100;
        state.muted = state.volume === 0;
        if (audio) {
          audio.volume = state.volume;
          audio.muted = state.muted;
        }
        store.write('sonora:volume', state.volume);
      }
    },
    true,
  );

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const input = event.target.closest?.('[data-search-input]');
    if (input) {
      event.preventDefault();
      runSearch(input.value, { immediate: true });
    }
  });

  document.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement)) return;
      img.classList.add('is-broken');
      const holder = img.closest('[data-art]');
      if (holder) {
        holder.classList.add('cover-fallback');
        const track = trackById(holder.dataset.art);
        if (track && !holder.querySelector('.cover-letter')) {
          holder.insertAdjacentHTML('beforeend', `<span class="cover-letter">${coverMark(track)}</span>`);
        }
      }
    },
    true,
  );

  const searchField = $('#global-search');
  searchField?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') searchField.blur();
  });

  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (state.settings.theme === 'auto') applyTheme('auto');
  });

  // Keep the topbar quiet until the page starts moving.
  $('#main-scroll')?.addEventListener('scroll', (event) => {
    $('.topbar')?.classList.toggle('is-scrolled', event.target.scrollTop > 16);
  });

  window.addEventListener('beforeunload', () => {
    if (state.current) store.write('sonora:last-track', state.current);
    store.write('sonora:volume', state.volume);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 840) closeSidebar();
  });
}

/* ------------------------------------------------------------------ */
/*  Init                                                               */
/* ------------------------------------------------------------------ */

function updateLiveClock() {
  const el = $('#live-clock');
  if (!el) return;
  el.textContent = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date());
}

function init() {
  mountIconSprite();
  applyTheme(state.settings.theme);
  applySeed(state.settings.seed || '#2F6F66');
  document.documentElement.classList.toggle('reduce-motion', !state.settings.motion);
  renderShell();
  setupAudio();
  setupMediaSession();
  initEvents();
  updateLiveClock();
  setInterval(updateLiveClock, 30000);
  renderPlayer();
  renderMini();
  renderView();
  updateSidebarCounts();
  updateVolumeUI();
  renderQueue();
  if (state.current) updateTopbar();

  requestAnimationFrame(() => {
    document.body.classList.add('is-ready');
    const boot = $('#boot-screen');
    if (boot) {
      boot.classList.add('is-done');
      setTimeout(() => boot.remove(), 700);
    }
  });

  loadHome();
}

init();

// Kept for debugging in the browser console.
window.sonora = { state, audio, setView, runSearch };

// Prevent an unused variable warning while keeping the timer alive.
void lyricTicker;
