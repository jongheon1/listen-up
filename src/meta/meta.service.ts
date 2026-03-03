import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export interface FileMeta {
  id: string;
  originalName: string;
  filename: string;
  duration: number | null;
  sttStatus: 'pending' | 'processing' | 'done' | 'error';
  createdAt: string;
  progress?: { currentTime: number; segmentIndex: number };
}

export interface PlaylistMeta {
  id: string;
  name: string;
  fileIds: string[];
  createdAt: string;
}

export interface MetaData {
  files: Record<string, FileMeta>;
  playlists: Record<string, PlaylistMeta>;
  lastPlayedFileId: string | null;
}

const DATA_DIR = join(process.cwd(), 'data');
const META_PATH = join(DATA_DIR, 'meta.json');

@Injectable()
export class MetaService implements OnModuleInit {
  private readonly logger = new Logger(MetaService.name);
  private data: MetaData = { files: {}, playlists: {}, lastPlayedFileId: null };
  private writeQueue: Promise<void> = Promise.resolve();

  async onModuleInit() {
    await mkdir(DATA_DIR, { recursive: true });
    try {
      const raw = await readFile(META_PATH, 'utf-8');
      this.data = JSON.parse(raw);
    } catch {
      this.logger.log('No existing meta.json, starting fresh');
      await this.flush();
    }
  }

  getData(): MetaData {
    return this.data;
  }

  getFile(id: string): FileMeta | undefined {
    return this.data.files[id];
  }

  getAllFiles(): FileMeta[] {
    return Object.values(this.data.files);
  }

  async addFile(file: FileMeta): Promise<void> {
    this.data.files[file.id] = file;
    await this.flush();
  }

  async updateFile(id: string, update: Partial<FileMeta>): Promise<void> {
    if (!this.data.files[id]) return;
    Object.assign(this.data.files[id], update);
    await this.flush();
  }

  async deleteFile(id: string): Promise<void> {
    delete this.data.files[id];
    if (this.data.lastPlayedFileId === id) {
      this.data.lastPlayedFileId = null;
    }
    // Remove from playlists
    for (const pl of Object.values(this.data.playlists)) {
      pl.fileIds = pl.fileIds.filter((fid) => fid !== id);
    }
    await this.flush();
  }

  async setLastPlayedFileId(id: string | null): Promise<void> {
    this.data.lastPlayedFileId = id;
    await this.flush();
  }

  // Playlist CRUD
  getPlaylist(id: string): PlaylistMeta | undefined {
    return this.data.playlists[id];
  }

  getAllPlaylists(): PlaylistMeta[] {
    return Object.values(this.data.playlists);
  }

  async addPlaylist(playlist: PlaylistMeta): Promise<void> {
    this.data.playlists[playlist.id] = playlist;
    await this.flush();
  }

  async updatePlaylist(
    id: string,
    update: Partial<PlaylistMeta>,
  ): Promise<void> {
    if (!this.data.playlists[id]) return;
    Object.assign(this.data.playlists[id], update);
    await this.flush();
  }

  async deletePlaylist(id: string): Promise<void> {
    delete this.data.playlists[id];
    await this.flush();
  }

  private flush(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      await writeFile(META_PATH, JSON.stringify(this.data, null, 2));
    });
    return this.writeQueue;
  }
}
