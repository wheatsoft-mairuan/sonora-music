// 上游接口不带 CORS 头，直连会被浏览器拦掉；统一走同源路径 /gdapi（开发期由 Vite 代理，
// 生产期由网关反向代理）。需要直连时用 VITE_API_BASE 覆盖，例如 https://music-api.gdstudio.xyz/api.php
const API_BASE = import.meta.env?.VITE_API_BASE || '/gdapi/api.php';
const SOURCE = 'netease';
const requestCache = new Map();

function cacheKey(params) {
  return JSON.stringify(params);
}

function upgradeUrl(url) {
  if (!url) return '';
  return url.replace(/^http:\/\//i, 'https://');
}

export function coverWithSize(url, size = 600) {
  if (!url) return '';
  const safe = upgradeUrl(url);
  if (/[?&](param|thumbnail)=/.test(safe)) return safe;
  return `${safe}${safe.includes('?') ? '&' : '?'}param=${size}y${size}`;
}

function isTransientError(error) {
  const message = String(error?.message || '');
  return /NetworkError|Failed to fetch|Load failed|fetch|音乐服务返回 5\d\d/i.test(message);
}

async function fetchJson(params, { timeout = 14000, cache = true } = {}) {
  const key = cacheKey(params);
  if (cache && requestCache.has(key)) return requestCache.get(key);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    // Android 壳（CapacitorHttp 改写的 fetch）不认 AbortSignal，光 abort 停不下来，
    // 这里再补一层 race，保证超时一定会抛出，浏览器里行为不变。
    const timedOut = new Promise((_, reject) => {
      controller.signal.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });
    // race 先结算后，超时那个 Promise 的 reject 不该再冒成 unhandledrejection
    timedOut.catch(() => {});

    try {
      const query = new URLSearchParams(params);
      const response = await Promise.race([
        fetch(`${API_BASE}?${query}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        }),
        timedOut,
      ]);
      if (!response.ok) throw new Error(`音乐服务返回 ${response.status}`);
      const data = await response.json();
      if (cache) requestCache.set(key, data);
      return data;
    } catch (error) {
      if (attempt === 0 && isTransientError(error)) {
        await new Promise((resolve) => setTimeout(resolve, 650));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

function normalizePlaylistTrack(track, index = 0) {
  const artists = (track.ar || [])
    .map((artist) => artist?.name)
    .filter(Boolean)
    .join(' / ');

  return {
    id: String(track.id),
    source: SOURCE,
    name: track.name || '未命名歌曲',
    artists: artists || '未知歌手',
    album: track.al?.name || '未知专辑',
    cover: coverWithSize(track.al?.picUrl, 600),
    duration: Number(track.dt) || 0,
    rank: index + 1,
  };
}

function normalizeSearchTrack(item, index = 0) {
  const artists = Array.isArray(item.artist)
    ? item.artist.filter(Boolean).join(' / ')
    : item.artist || '未知歌手';

  return {
    id: String(item.id),
    source: item.source || SOURCE,
    name: item.name || '未命名歌曲',
    artists,
    album: item.album || '未知专辑',
    cover: '',
    picId: item.pic_id ? String(item.pic_id) : '',
    duration: 0,
    rank: index + 1,
  };
}

export async function fetchPlaylist(id) {
  const data = await fetchJson({
    types: 'playlist',
    source: SOURCE,
    id: String(id),
  });
  const tracks = data?.playlist?.tracks;
  if (!Array.isArray(tracks)) throw new Error('歌单数据格式异常');
  return tracks.map(normalizePlaylistTrack);
}

export async function searchMusic(keyword, count = 18) {
  const data = await fetchJson({
    types: 'search',
    source: SOURCE,
    name: keyword,
    count: String(count),
    pages: '1',
  });
  if (!Array.isArray(data)) throw new Error('搜索服务返回异常');
  return data.map(normalizeSearchTrack);
}

export async function resolveCover(picId, size = 500) {
  if (!picId) return '';
  try {
    const data = await fetchJson({
      types: 'pic',
      source: SOURCE,
      id: String(picId),
      size: String(size),
    });
    return coverWithSize(data?.url, size);
  } catch {
    return '';
  }
}

export async function resolveCovers(tracks) {
  return Promise.all(
    tracks.map(async (track) => {
      if (track.cover || !track.picId) return track;
      const cover = await resolveCover(track.picId);
      return { ...track, cover };
    }),
  );
}

export async function fetchStreamUrl(trackId, quality = '320') {
  const data = await fetchJson({
    types: 'url',
    source: SOURCE,
    id: String(trackId),
    br: quality,
  });
  if (!data?.url) throw new Error('该歌曲暂时没有可播放的音源');
  return upgradeUrl(data.url);
}

export async function fetchLyrics(trackId) {
  const data = await fetchJson({
    types: 'lyric',
    source: SOURCE,
    id: String(trackId),
  });
  return data?.lyric || '';
}

export function parseLrc(lrc) {
  if (!lrc) return [];
  const lines = [];
  const timeTag = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

  lrc.split(/\r?\n/).forEach((rawLine) => {
    const tags = [...rawLine.matchAll(timeTag)];
    if (!tags.length) return;
    const text = rawLine.replace(timeTag, '').trim();
    if (!text) return;
    if (/^(作词|作曲|编曲|制作人|混音|母带|出品|监制|吉他|贝斯|和声|录音|OP|SP)\s*[:：]/.test(text)) return;

    tags.forEach((tag) => {
      const minutes = Number(tag[1]);
      const seconds = Number(tag[2]);
      const fraction = tag[3] ? Number(tag[3].padEnd(3, '0')) : 0;
      const time = minutes * 60 + seconds + fraction / 1000;
      lines.push({ time, text });
    });
  });

  const seen = new Set();
  return lines
    .sort((a, b) => a.time - b.time)
    .filter((line) => {
      const key = `${line.time.toFixed(2)}:${line.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export { API_BASE, SOURCE };
