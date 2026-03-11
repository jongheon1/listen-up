import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MetaModule } from './meta/meta.module.js';
import { FilesModule } from './files/files.module.js';
import { SttModule } from './stt/stt.module.js';
import { PlaylistsModule } from './playlists/playlists.module.js';
import { SettingsController } from './settings/settings.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    MetaModule,
    FilesModule,
    SttModule,
    PlaylistsModule,
  ],
  controllers: [SettingsController],
})
export class AppModule {}
