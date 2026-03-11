import * as api from './api';
import type { FileMeta, PlaylistMeta } from './types';
import { navigateTo } from './main';

let pollTimer: number | null = null;
let cachedFiles: FileMeta[] = [];

const LANGUAGES = [
  'English', 'Korean', 'Japanese', 'Chinese', 'Spanish',
  'French', 'German', 'Portuguese', 'Italian', 'Russian',
  'Arabic', 'Hindi', 'Thai', 'Vietnamese', 'Indonesian',
  'Dutch', 'Turkish', 'Polish', 'Swedish',
];

export function renderLibrary(container: HTMLElement) {
  container.innerHTML = `
    <div class="library">
      <div class="lang-settings">
        <h3>Language</h3>
        <div class="lang-selects">
          <label>
            <span>Source</span>
            <select id="source-lang">
              ${LANGUAGES.map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </label>
          <span class="lang-arrow">&rarr;</span>
          <label>
            <span>Target</span>
            <select id="target-lang">
              ${LANGUAGES.map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </label>
          <button id="lang-save-btn" class="lang-save-btn">Save</button>
        </div>
      </div>
      <div id="resume-banner" class="resume-banner" style="display:none"></div>
      <div class="upload-area" id="upload-area">
        <p>Drag & drop .mp3 files here or click to upload</p>
        <input type="file" id="file-input" accept=".mp3" multiple style="display:none">
      </div>
      <table class="file-table">
        <thead>
          <tr>
            <th>File</th>
            <th>Duration</th>
            <th>Progress</th>
            <th>STT</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody id="file-list"></tbody>
      </table>
      <div class="playlists-section">
        <h3>Playlists</h3>
        <div id="playlist-list"></div>
        <div class="playlist-create">
          <input type="text" id="playlist-name" placeholder="New playlist name">
          <button id="playlist-create-btn">Create</button>
        </div>
      </div>
    </div>
  `;

  setupUpload(container);
  loadFiles();
  loadPlaylists();
  loadLangSettings();
}

export function destroyLibrary() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function setupUpload(container: HTMLElement) {
  const area = container.querySelector('#upload-area') as HTMLElement;
  const input = container.querySelector('#file-input') as HTMLInputElement;

  area.addEventListener('click', () => input.click());
  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.classList.add('dragover');
  });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    if (e.dataTransfer?.files.length) {
      doUpload(e.dataTransfer.files);
    }
  });
  input.addEventListener('change', () => {
    if (input.files?.length) {
      doUpload(input.files);
      input.value = '';
    }
  });

  // Playlist create
  const createBtn = container.querySelector('#playlist-create-btn') as HTMLElement;
  const nameInput = container.querySelector('#playlist-name') as HTMLInputElement;
  createBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) return;
    await api.createPlaylist(name, []);
    nameInput.value = '';
    loadPlaylists();
  });
}

async function doUpload(files: FileList | File[]) {
  const area = document.getElementById('upload-area')!;
  area.innerHTML = '<p>Uploading...</p>';
  try {
    await api.uploadFiles(files);
    area.innerHTML = '<p>Drag & drop .mp3 files here or click to upload</p>';
    loadFiles();
  } catch (err) {
    area.innerHTML = `<p>Upload failed: ${err}</p>`;
  }
}

async function loadFiles() {
  const { files, lastPlayedFileId } = await api.listFiles();
  cachedFiles = files;
  renderFileList(files, lastPlayedFileId);
  startPollingIfNeeded(files);
}

function renderFileList(files: FileMeta[], lastPlayedFileId: string | null) {
  const tbody = document.getElementById('file-list')!;
  const banner = document.getElementById('resume-banner')!;

  // Resume banner
  if (lastPlayedFileId) {
    const lastFile = files.find((f) => f.id === lastPlayedFileId);
    if (lastFile && lastFile.sttStatus === 'done') {
      banner.style.display = 'block';
      banner.innerHTML = `<button class="resume-btn">&#9654; Resume: ${esc(lastFile.originalName)}</button>`;
      banner.querySelector('.resume-btn')!.addEventListener('click', () => {
        navigateTo('player', lastFile.id);
      });
    } else {
      banner.style.display = 'none';
    }
  } else {
    banner.style.display = 'none';
  }

  // File rows
  tbody.innerHTML = files
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(
      (f) => `
    <tr class="file-row ${f.sttStatus === 'done' ? 'clickable' : ''}" data-id="${f.id}">
      <td class="file-name">${esc(f.originalName)}</td>
      <td>${f.duration ? formatTime(f.duration) : '-'}</td>
      <td>${f.progress && f.duration ? Math.round((f.progress.currentTime / f.duration) * 100) + '%' : '-'}</td>
      <td><span class="stt-badge stt-${f.sttStatus}">${f.sttStatus}</span></td>
      <td><button class="delete-btn" data-id="${f.id}">&#x2715;</button></td>
      <td><button class="add-to-playlist-btn" data-id="${f.id}" title="Add to playlist">+</button></td>
    </tr>
  `,
    )
    .join('');

  // Click handlers
  tbody.querySelectorAll('.file-row.clickable').forEach((row) => {
    const name = row.querySelector('.file-name') as HTMLElement;
    name.addEventListener('click', () => {
      navigateTo('player', row.getAttribute('data-id')!);
    });
  });

  tbody.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).dataset.id!;
      if (confirm('Delete this file?')) {
        await api.deleteFile(id);
        loadFiles();
      }
    });
  });

  tbody.querySelectorAll('.add-to-playlist-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fId = (btn as HTMLElement).dataset.id!;
      // Remove any existing dropdown
      document.querySelectorAll('.playlist-dropdown').forEach((d) => d.remove());
      const playlists = await api.listPlaylists();
      if (playlists.length === 0) return;
      const dropdown = document.createElement('div');
      dropdown.className = 'playlist-dropdown';
      dropdown.innerHTML = playlists
        .map((p) => `<div class="playlist-dropdown-item" data-pid="${p.id}">${esc(p.name)}</div>`)
        .join('');
      (btn as HTMLElement).parentElement!.appendChild(dropdown);
      dropdown.querySelectorAll('.playlist-dropdown-item').forEach((item) => {
        item.addEventListener('click', async () => {
          const pid = (item as HTMLElement).dataset.pid!;
          const pl = playlists.find((p) => p.id === pid)!;
          if (!pl.fileIds.includes(fId)) {
            await api.updatePlaylist(pid, { fileIds: [...pl.fileIds, fId] });
          }
          dropdown.remove();
          loadPlaylists();
        });
      });
      // Close on outside click
      const close = (ev: MouseEvent) => {
        if (!dropdown.contains(ev.target as Node)) {
          dropdown.remove();
          document.removeEventListener('click', close);
        }
      };
      setTimeout(() => document.addEventListener('click', close), 0);
    });
  });
}

function startPollingIfNeeded(files: FileMeta[]) {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  const hasPending = files.some(
    (f) => f.sttStatus === 'pending' || f.sttStatus === 'processing',
  );
  if (hasPending) {
    pollTimer = window.setInterval(() => loadFiles(), 5000);
  }
}

async function loadPlaylists() {
  const playlists = await api.listPlaylists();
  const container = document.getElementById('playlist-list')!;
  if (playlists.length === 0) {
    container.innerHTML = '<p class="empty-text">No playlists yet</p>';
    return;
  }
  container.innerHTML = playlists
    .map(
      (p) => `
    <div class="playlist-entry" data-id="${p.id}">
      <div class="playlist-item">
        <span class="playlist-toggle" data-id="${p.id}">${esc(p.name)} (${p.fileIds.length} files)</span>
        <div class="playlist-item-actions">
          ${p.fileIds.length > 0 ? `<button class="playlist-play-btn icon-btn" data-id="${p.id}" title="Play">&#9654;</button>` : ''}
          <button class="delete-btn playlist-delete" data-id="${p.id}">&#x2715;</button>
        </div>
      </div>
      <div class="playlist-files" id="pl-files-${p.id}" style="display:none"></div>
    </div>
  `,
    )
    .join('');

  container.querySelectorAll('.playlist-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.id!;
      await api.deletePlaylist(id);
      loadPlaylists();
    });
  });

  container.querySelectorAll('.playlist-play-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      const pl = playlists.find((p) => p.id === id)!;
      if (pl.fileIds.length > 0) {
        navigateTo('player', pl.fileIds[0], pl.id);
      }
    });
  });

  container.querySelectorAll('.playlist-toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const id = (toggle as HTMLElement).dataset.id!;
      const filesDiv = document.getElementById(`pl-files-${id}`)!;
      const isOpen = filesDiv.style.display !== 'none';
      filesDiv.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        renderPlaylistFiles(id, playlists.find((p) => p.id === id)!);
      }
    });
  });
}

function renderPlaylistFiles(playlistId: string, playlist: PlaylistMeta) {
  const filesDiv = document.getElementById(`pl-files-${playlistId}`)!;
  if (playlist.fileIds.length === 0) {
    filesDiv.innerHTML = '<p class="empty-text" style="padding:8px 12px">No files</p>';
    return;
  }
  filesDiv.innerHTML = playlist.fileIds
    .map((fId, i) => {
      const file = cachedFiles.find((f) => f.id === fId);
      const name = file ? esc(file.originalName) : fId;
      return `<div class="playlist-file-item" data-fid="${fId}" data-index="${i}" draggable="true">
        <span class="playlist-file-name">${name}</span>
        <button class="delete-btn playlist-file-remove" data-pid="${playlistId}" data-fid="${fId}">&#x2715;</button>
      </div>`;
    })
    .join('');

  filesDiv.querySelectorAll('.playlist-file-remove').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const pid = (btn as HTMLElement).dataset.pid!;
      const fId = (btn as HTMLElement).dataset.fid!;
      const newIds = playlist.fileIds.filter((id) => id !== fId);
      await api.updatePlaylist(pid, { fileIds: newIds });
      playlist.fileIds = newIds;
      renderPlaylistFiles(pid, playlist);
      // Update file count in header
      loadPlaylists();
    });
  });

  setupDragReorder(filesDiv, playlistId, playlist);
}

function setupDragReorder(container: HTMLElement, playlistId: string, playlist: PlaylistMeta) {
  let dragIndex: number | null = null;

  container.querySelectorAll('.playlist-file-item').forEach((item) => {
    const el = item as HTMLElement;

    el.addEventListener('dragstart', (e) => {
      dragIndex = parseInt(el.dataset.index!, 10);
      (e as DragEvent).dataTransfer!.effectAllowed = 'move';
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      (e as DragEvent).dataTransfer!.dropEffect = 'move';
      el.classList.add('drag-over');
    });

    el.addEventListener('dragleave', () => {
      el.classList.remove('drag-over');
    });

    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const dropIndex = parseInt(el.dataset.index!, 10);
      if (dragIndex === null || dragIndex === dropIndex) return;
      const newIds = [...playlist.fileIds];
      const [moved] = newIds.splice(dragIndex, 1);
      newIds.splice(dropIndex, 0, moved);
      await api.updatePlaylist(playlistId, { fileIds: newIds });
      playlist.fileIds = newIds;
      renderPlaylistFiles(playlistId, playlist);
    });

    el.addEventListener('dragend', () => {
      dragIndex = null;
      container.querySelectorAll('.drag-over').forEach((d) => d.classList.remove('drag-over'));
    });
  });
}

async function loadLangSettings() {
  try {
    const settings = await api.getSettings();
    const srcSelect = document.getElementById('source-lang') as HTMLSelectElement;
    const tgtSelect = document.getElementById('target-lang') as HTMLSelectElement;
    srcSelect.value = settings.sourceLang;
    tgtSelect.value = settings.targetLang;
  } catch {}

  document.getElementById('lang-save-btn')!.addEventListener('click', async () => {
    const srcSelect = document.getElementById('source-lang') as HTMLSelectElement;
    const tgtSelect = document.getElementById('target-lang') as HTMLSelectElement;
    try {
      await api.updateSettings(srcSelect.value, tgtSelect.value);
      const btn = document.getElementById('lang-save-btn')!;
      btn.textContent = 'Saved!';
      setTimeout(() => { btn.textContent = 'Save'; }, 1500);
    } catch {}
  });
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
