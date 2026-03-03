import { Injectable } from '@nestjs/common';
import { MetaService, PlaylistMeta } from '../meta/meta.service.js';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PlaylistsService {
  constructor(private readonly metaService: MetaService) {}

  listPlaylists(): PlaylistMeta[] {
    return this.metaService.getAllPlaylists();
  }

  async createPlaylist(
    name: string,
    fileIds: string[],
  ): Promise<PlaylistMeta> {
    const playlist: PlaylistMeta = {
      id: uuidv4(),
      name,
      fileIds,
      createdAt: new Date().toISOString(),
    };
    await this.metaService.addPlaylist(playlist);
    return playlist;
  }

  async updatePlaylist(
    id: string,
    update: Partial<PlaylistMeta>,
  ): Promise<PlaylistMeta | null> {
    const existing = this.metaService.getPlaylist(id);
    if (!existing) return null;
    await this.metaService.updatePlaylist(id, update);
    return this.metaService.getPlaylist(id)!;
  }

  async deletePlaylist(id: string): Promise<boolean> {
    const existing = this.metaService.getPlaylist(id);
    if (!existing) return false;
    await this.metaService.deletePlaylist(id);
    return true;
  }
}
