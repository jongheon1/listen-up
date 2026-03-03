import * as api from './api';
import type { Segment, SttResult, FileMeta, PlaylistMeta } from './types';
import { navigateTo } from './main';

let audio: HTMLAudioElement | null = null;
let segments: Segment[] = [];
let currentIndex = -1;
let apEnabled = false;
let loopEnabled = false;
let translationVisible = true;
let progressTimer: number | null = null;
let fileId = '';
let fileMeta: FileMeta | null = null;
let playlistId: string | null = null;
let playlistMeta: PlaylistMeta | null = null;
let playlistFiles: FileMeta[] = [];

export function renderPlayer(container: HTMLElement, id: string, plId?: string) {
  fileId = id;
  playlistId = plId || null;
  container.innerHTML = `
    <div class="player-wrapper">
      <div class="playlist-sidebar" id="playlist-sidebar" style="display:none">
        <div class="sidebar-header">
          <span class="sidebar-title">Playlist</span>
          <button id="sidebar-close" class="icon-btn sidebar-close">&times;</button>
        </div>
        <div class="sidebar-files" id="sidebar-files"></div>
      </div>
      <div class="player">
        <div class="top-bar">
          <button id="back-btn" class="icon-btn">&larr;</button>
          ${plId ? '<button id="sidebar-toggle" class="icon-btn" title="Playlist">&#9776;</button>' : ''}
          <span id="file-title" class="file-title">Loading...</span>
          <div class="top-controls">
            <button id="ap-toggle" class="toggle-btn">AP: OFF</button>
            <span id="speed-display" class="speed-display">1.0x</span>
          </div>
        </div>
        <div class="audio-bar">
          <button id="play-btn" class="icon-btn play-btn">&#9654;</button>
          <span id="time-current" class="time">0:00</span>
          <input type="range" id="seekbar" class="seekbar" min="0" max="100" value="0" step="0.1">
          <span id="time-total" class="time">0:00</span>
          <input type="range" id="volume" class="volume" min="0" max="1" value="1" step="0.05">
        </div>
        <div id="segment-bar" class="segment-bar"></div>
        <div class="subtitle-panel" id="subtitle-panel">
          <div class="subtitle-header">
            <span class="subtitle-col-header">English</span>
            <span class="subtitle-col-header">Korean</span>
          </div>
          <div class="subtitle-rows" id="subtitle-rows"></div>
        </div>
        <div class="keyboard-help">
          <span>&#8592;/&#8594; Sentence</span>
          <span>Shift+&#8592;/&#8594; 5s</span>
          <span>Space Play/Pause</span>
          <span>R Repeat</span>
          <span>Shift+R Loop</span>
          <span>Enter Toggle Translation</span>
          <span>&#8593;/&#8595; Speed</span>
        </div>
      </div>
    </div>
  `;

  init(container, id);
}

async function init(container: HTMLElement, id: string) {
  // Load file info
  const { files } = await api.listFiles();
  fileMeta = files.find((f) => f.id === id) || null;
  if (!fileMeta) {
    container.innerHTML = '<p>File not found</p>';
    return;
  }

  document.getElementById('file-title')!.textContent = fileMeta.originalName;

  // Setup audio
  audio = new Audio(api.audioUrl(id));
  audio.preload = 'auto';

  // Load STT
  const stt = await api.getStt(id);
  if (stt && stt.segments) {
    segments = stt.segments;
    renderSegmentBar(stt.duration || fileMeta.duration || 0);
    renderSubtitles();
  }

  // Load progress
  try {
    const progress = await api.getProgress(id);
    if (progress.currentTime > 0) {
      audio.currentTime = progress.currentTime;
      currentIndex = progress.segmentIndex;
    }
  } catch {}

  setupControls(container);
  setupKeyboard();
  startProgressSaving();

  if (playlistId) {
    loadPlaylistSidebar();
  }
}

async function loadPlaylistSidebar() {
  if (!playlistId) return;
  const playlists = await api.listPlaylists();
  playlistMeta = playlists.find((p) => p.id === playlistId) || null;
  if (!playlistMeta) return;

  const { files } = await api.listFiles();
  playlistFiles = playlistMeta.fileIds
    .map((id) => files.find((f) => f.id === id))
    .filter((f): f is FileMeta => f !== undefined);

  renderSidebar();

  // Show sidebar by default
  document.getElementById('playlist-sidebar')!.style.display = 'flex';
}

function renderSidebar() {
  const container = document.getElementById('sidebar-files')!;
  container.innerHTML = playlistFiles
    .map(
      (f) => `
    <div class="sidebar-file ${f.id === fileId ? 'active' : ''}" data-id="${f.id}">
      ${esc(f.originalName)}
    </div>
  `,
    )
    .join('');

  container.querySelectorAll('.sidebar-file').forEach((el) => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.id!;
      if (id !== fileId) {
        api.saveProgress(fileId, audio!.currentTime, currentIndex).catch(() => {});
        navigateTo('player', id, playlistId!);
      }
    });
  });

  // Sidebar toggle/close
  const toggleBtn = document.getElementById('sidebar-toggle');
  const closeBtn = document.getElementById('sidebar-close');
  const sidebar = document.getElementById('playlist-sidebar')!;

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      sidebar.style.display = sidebar.style.display === 'none' ? 'flex' : 'none';
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      sidebar.style.display = 'none';
    });
  }
}

function setupControls(container: HTMLElement) {
  if (!audio) return;

  const playBtn = document.getElementById('play-btn')!;
  const seekbar = document.getElementById('seekbar') as HTMLInputElement;
  const timeCurrent = document.getElementById('time-current')!;
  const timeTotal = document.getElementById('time-total')!;
  const volume = document.getElementById('volume') as HTMLInputElement;
  const backBtn = document.getElementById('back-btn')!;
  const apToggle = document.getElementById('ap-toggle')!;
  const speedDisplay = document.getElementById('speed-display')!;

  backBtn.addEventListener('click', () => navigateTo('library'));

  playBtn.addEventListener('click', () => togglePlay());

  audio.addEventListener('loadedmetadata', () => {
    seekbar.max = String(audio!.duration);
    timeTotal.textContent = formatTime(audio!.duration);
  });

  audio.addEventListener('timeupdate', () => {
    const t = audio!.currentTime;
    seekbar.value = String(t);
    timeCurrent.textContent = formatTime(t);
    updateCurrentSegment(t);
  });

  audio.addEventListener('ended', () => {
    playBtn.innerHTML = '&#9654;';
    if (playlistId && playlistMeta) {
      const idx = playlistMeta.fileIds.indexOf(fileId);
      if (idx >= 0 && idx < playlistMeta.fileIds.length - 1) {
        api.saveProgress(fileId, audio!.currentTime, currentIndex).catch(() => {});
        navigateTo('player', playlistMeta.fileIds[idx + 1], playlistId!);
      }
    }
  });

  audio.addEventListener('play', () => {
    playBtn.innerHTML = '&#9646;&#9646;';
  });

  audio.addEventListener('pause', () => {
    playBtn.innerHTML = '&#9654;';
  });

  seekbar.addEventListener('input', () => {
    audio!.currentTime = parseFloat(seekbar.value);
  });

  volume.addEventListener('input', () => {
    audio!.volume = parseFloat(volume.value);
  });

  apToggle.addEventListener('click', () => {
    apEnabled = !apEnabled;
    apToggle.textContent = `AP: ${apEnabled ? 'ON' : 'OFF'}`;
    apToggle.classList.toggle('active', apEnabled);
  });

  speedDisplay.addEventListener('click', () => {
    // Cycle through speeds on click
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const cur = audio!.playbackRate;
    const idx = speeds.findIndex((s) => s >= cur + 0.05);
    audio!.playbackRate = idx >= 0 && idx < speeds.length - 1 ? speeds[idx + 1 >= speeds.length ? 0 : idx] : speeds[0];
    speedDisplay.textContent = `${audio!.playbackRate.toFixed(1)}x`;
  });
}

function setupKeyboard() {
  const handler = (e: KeyboardEvent) => {
    // Don't intercept when typing in inputs
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        if (e.shiftKey) {
          if (audio) audio.currentTime = Math.max(0, audio.currentTime - 5);
        } else {
          prevSegment();
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (e.shiftKey) {
          if (audio)
            audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
        } else {
          nextSegment();
        }
        break;
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
      case 'r':
      case 'R':
        e.preventDefault();
        if (e.shiftKey) {
          loopEnabled = !loopEnabled;
          showToast(loopEnabled ? 'Loop ON' : 'Loop OFF');
        } else {
          replaySegment();
        }
        break;
      case 'Enter':
        e.preventDefault();
        toggleTranslation();
        break;
      case 'ArrowUp':
        e.preventDefault();
        changeSpeed(0.1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        changeSpeed(-0.1);
        break;
    }
  };

  document.addEventListener('keydown', handler);
  // Store for cleanup
  (window as any).__playerKeyHandler = handler;
}

function togglePlay() {
  if (!audio) return;
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
}

function prevSegment() {
  if (!audio || segments.length === 0) return;
  const cur = segments[currentIndex];
  if (cur && audio.currentTime - cur.start > 1 && currentIndex >= 0) {
    // Replay current if more than 1 second in
    audio.currentTime = cur.start;
  } else if (currentIndex > 0) {
    currentIndex--;
    audio.currentTime = segments[currentIndex].start;
  }
  if (audio.paused) audio.play();
}

function nextSegment() {
  if (!audio || segments.length === 0) return;
  if (currentIndex < segments.length - 1) {
    currentIndex++;
    audio.currentTime = segments[currentIndex].start;
    if (audio.paused) audio.play();
  }
}

function replaySegment() {
  if (!audio || currentIndex < 0 || currentIndex >= segments.length) return;
  audio.currentTime = segments[currentIndex].start;
  if (audio.paused) audio.play();
}

function changeSpeed(delta: number) {
  if (!audio) return;
  const newRate = Math.round((audio.playbackRate + delta) * 10) / 10;
  audio.playbackRate = Math.max(0.3, Math.min(3.0, newRate));
  document.getElementById('speed-display')!.textContent =
    `${audio.playbackRate.toFixed(1)}x`;
}

function toggleTranslation() {
  translationVisible = !translationVisible;
  const rows = document.getElementById('subtitle-rows');
  if (rows) {
    rows.classList.toggle('hide-translation', !translationVisible);
  }
}

let prevIndex = -1;

function updateCurrentSegment(time: number) {
  if (segments.length === 0) return;

  // Find current segment (reverse linear scan for efficiency)
  let newIndex = -1;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (time >= segments[i].start) {
      newIndex = i;
      break;
    }
  }

  // Auto-pause: if we crossed a segment boundary
  if (
    apEnabled &&
    prevIndex >= 0 &&
    newIndex > prevIndex &&
    audio &&
    !audio.paused
  ) {
    audio.pause();
    // Stay at start of new segment
    audio.currentTime = segments[newIndex].start;
  }

  // Loop mode
  if (
    loopEnabled &&
    currentIndex >= 0 &&
    currentIndex < segments.length &&
    audio
  ) {
    const seg = segments[currentIndex];
    if (time >= seg.end) {
      audio.currentTime = seg.start;
      return;
    }
  }

  prevIndex = newIndex;
  if (newIndex !== currentIndex) {
    currentIndex = newIndex;
    highlightSegment();
  }

  // Also update segment bar highlight
  updateSegmentBarHighlight();
}

function renderSegmentBar(totalDuration: number) {
  const bar = document.getElementById('segment-bar')!;
  if (totalDuration <= 0 || segments.length === 0) {
    bar.innerHTML = '';
    return;
  }

  bar.innerHTML = segments
    .map((seg, i) => {
      const width = ((seg.end - seg.start) / totalDuration) * 100;
      return `<div class="seg-block" data-index="${i}" style="width:${width}%" title="${seg.text.slice(0, 40)}"></div>`;
    })
    .join('');

  bar.querySelectorAll('.seg-block').forEach((block) => {
    block.addEventListener('click', () => {
      const idx = parseInt((block as HTMLElement).dataset.index!, 10);
      if (audio && segments[idx]) {
        audio.currentTime = segments[idx].start;
        currentIndex = idx;
        highlightSegment();
        if (audio.paused) audio.play();
      }
    });
  });
}

function updateSegmentBarHighlight() {
  const blocks = document.querySelectorAll('.seg-block');
  blocks.forEach((b, i) => {
    b.classList.toggle('active', i === currentIndex);
  });
}

function renderSubtitles() {
  const rows = document.getElementById('subtitle-rows')!;
  rows.innerHTML = segments
    .map(
      (seg, i) => `
    <div class="subtitle-row" data-index="${i}">
      <div class="sub-en">${esc(seg.text)}</div>
      <div class="sub-ko">${esc(seg.translation)}</div>
    </div>
  `,
    )
    .join('');

  rows.querySelectorAll('.subtitle-row').forEach((row) => {
    row.addEventListener('click', () => {
      const idx = parseInt((row as HTMLElement).dataset.index!, 10);
      if (audio && segments[idx]) {
        audio.currentTime = segments[idx].start;
        currentIndex = idx;
        highlightSegment();
        if (audio.paused) audio.play();
      }
    });
  });
}

function highlightSegment() {
  const rows = document.querySelectorAll('.subtitle-row');
  rows.forEach((row, i) => {
    const el = row as HTMLElement;
    const dist = Math.abs(i - currentIndex);
    if (i === currentIndex) {
      el.classList.add('active');
      el.style.opacity = '1';
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      el.classList.remove('active');
      el.style.opacity = String(Math.max(0.3, 1 - dist * 0.15));
    }
  });
}

function startProgressSaving() {
  // Save every 10 seconds
  progressTimer = window.setInterval(() => {
    if (audio && fileId) {
      api.saveProgress(fileId, audio.currentTime, currentIndex).catch(() => {});
    }
  }, 10000);

  // Save on page unload
  window.addEventListener('beforeunload', saveProgressBeacon);
}

function saveProgressBeacon() {
  if (audio && fileId) {
    const data = JSON.stringify({
      currentTime: audio.currentTime,
      segmentIndex: currentIndex,
    });
    navigator.sendBeacon(
      `/api/files/${fileId}/progress`,
      new Blob([data], { type: 'application/json' }),
    );
  }
}

function showToast(msg: string) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast!.classList.remove('show'), 1500);
}

export function destroyPlayer() {
  if (audio) {
    audio.pause();
    audio.src = '';
    audio = null;
  }
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  window.removeEventListener('beforeunload', saveProgressBeacon);
  const handler = (window as any).__playerKeyHandler;
  if (handler) {
    document.removeEventListener('keydown', handler);
    delete (window as any).__playerKeyHandler;
  }
  segments = [];
  currentIndex = -1;
  prevIndex = -1;
  apEnabled = false;
  loopEnabled = false;
  translationVisible = true;
  fileId = '';
  fileMeta = null;
  playlistId = null;
  playlistMeta = null;
  playlistFiles = [];
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function esc(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
