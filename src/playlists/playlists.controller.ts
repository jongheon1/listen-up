import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PlaylistsService } from './playlists.service.js';

@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @Get()
  list() {
    return this.playlistsService.listPlaylists();
  }

  @Post()
  create(@Body() body: { name: string; fileIds?: string[] }) {
    return this.playlistsService.createPlaylist(body.name, body.fileIds || []);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; fileIds?: string[] },
  ) {
    const result = await this.playlistsService.updatePlaylist(id, body);
    if (!result) {
      throw new HttpException('Playlist not found', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    const ok = await this.playlistsService.deletePlaylist(id);
    if (!ok) {
      throw new HttpException('Playlist not found', HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }
}
