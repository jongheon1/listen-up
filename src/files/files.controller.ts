import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Req,
  Res,
  Body,
  UseInterceptors,
  UploadedFiles,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { diskStorage } from 'multer';
import { join, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { FilesService } from './files.service.js';
import { SttService } from '../stt/stt.service.js';

const AUDIO_DIR = join(process.cwd(), 'data', 'audio');

// Ensure audio dir exists
if (!existsSync(AUDIO_DIR)) {
  mkdirSync(AUDIO_DIR, { recursive: true });
}

const storage = diskStorage({
  destination: AUDIO_DIR,
  filename: (_req, file, cb) => {
    // Multer decodes filename as Latin-1; re-decode as UTF-8 for Korean support
    const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = extname(decoded);
    const base = decoded.slice(0, -ext.length);
    let filename = decoded;
    if (existsSync(join(AUDIO_DIR, filename))) {
      filename = `${base}_${Date.now()}${ext}`;
    }
    cb(null, filename);
  },
});

@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly sttService: SttService,
  ) {}

  @Get()
  async list() {
    return this.filesService.listFiles();
  }

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage,
      fileFilter: (_req, file, cb) => {
        const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
        if (extname(decoded).toLowerCase() !== '.mp3') {
          cb(new Error('Only .mp3 files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new HttpException('No files uploaded', HttpStatus.BAD_REQUEST);
    }
    const results = await this.filesService.handleUpload(files);
    // Fire-and-forget STT processing
    for (const file of results) {
      this.sttService.processFile(file.id).catch((err) => {
        console.error(`STT failed for ${file.id}:`, err);
      });
    }
    return results;
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    const ok = await this.filesService.deleteFile(id);
    if (!ok) {
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }

  @Get(':id/audio')
  async streamAudio(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const filePath = await this.filesService.getAudioPath(id);
    if (!filePath) {
      res.status(404).json({ message: 'File not found' });
      return;
    }

    const fileStat = await this.filesService.getAudioStat(filePath);
    const fileSize = fileStat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const stream = this.filesService.createAudioStream(
        filePath,
        start,
        end,
      );
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'audio/mpeg',
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes',
      });
      this.filesService.createAudioStream(filePath, 0, fileSize - 1).pipe(res);
    }
  }

  @Get(':id/stt')
  async getStt(@Param('id') id: string) {
    const result = await this.filesService.getSttResult(id);
    if (!result) {
      const file = this.filesService.getProgress(id);
      // Return the file meta's stt status
      return { status: 'not_ready', segments: [] };
    }
    return result;
  }

  @Post(':id/stt')
  async reprocessStt(@Param('id') id: string) {
    this.sttService.processFile(id).catch((err) => {
      console.error(`STT reprocess failed for ${id}:`, err);
    });
    return { status: 'processing' };
  }

  @Put(':id/progress')
  async saveProgress(
    @Param('id') id: string,
    @Body() body: { currentTime: number; segmentIndex: number },
  ) {
    const ok = await this.filesService.saveProgress(id, body);
    if (!ok) {
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }

  @Post(':id/progress')
  async saveProgressPost(
    @Param('id') id: string,
    @Body() body: { currentTime: number; segmentIndex: number },
  ) {
    return this.saveProgress(id, body);
  }

  @Put(':id/stt/segments')
  async updateSegmentTimes(
    @Param('id') id: string,
    @Body() body: { segments: { id: number; start: number; end: number }[] },
  ) {
    const ok = await this.filesService.updateSegmentTimes(id, body.segments);
    if (!ok) {
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }

  @Get(':id/progress')
  async getProgress(@Param('id') id: string) {
    const progress = this.filesService.getProgress(id);
    if (!progress) {
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }
    return progress;
  }
}
