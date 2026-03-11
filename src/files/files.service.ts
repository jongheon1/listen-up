import { Injectable, Logger } from '@nestjs/common';
import { MetaService, FileMeta } from '../meta/meta.service.js';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { unlink, stat, access, readFile, writeFile } from 'fs/promises';
import { createReadStream } from 'fs';

const AUDIO_DIR = join(process.cwd(), 'data', 'audio');
const STT_DIR = join(process.cwd(), 'data', 'stt');

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(private readonly metaService: MetaService) {}

  async listFiles() {
    const data = this.metaService.getData();
    return {
      files: this.metaService.getAllFiles(),
      lastPlayedFileId: data.lastPlayedFileId,
    };
  }

  async handleUpload(files: Express.Multer.File[]): Promise<FileMeta[]> {
    const results: FileMeta[] = [];
    for (const file of files) {
      const id = uuidv4();
      const meta: FileMeta = {
        id,
        originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        filename: file.filename,
        duration: null,
        sttStatus: 'pending',
        createdAt: new Date().toISOString(),
      };
      await this.metaService.addFile(meta);
      results.push(meta);
    }
    return results;
  }

  async deleteFile(id: string): Promise<boolean> {
    const file = this.metaService.getFile(id);
    if (!file) return false;

    // Delete audio file
    try {
      await unlink(join(AUDIO_DIR, file.filename));
    } catch {
      this.logger.warn(`Audio file not found: ${file.filename}`);
    }

    // Delete STT file
    try {
      const sttPath = join(STT_DIR, `${file.filename}.json`);
      await unlink(sttPath);
    } catch {
      // STT file may not exist
    }

    await this.metaService.deleteFile(id);
    return true;
  }

  async getAudioPath(id: string): Promise<string | null> {
    const file = this.metaService.getFile(id);
    if (!file) return null;
    const filePath = join(AUDIO_DIR, file.filename);
    try {
      await access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  async getAudioStat(filePath: string) {
    return stat(filePath);
  }

  createAudioStream(filePath: string, start: number, end: number) {
    return createReadStream(filePath, { start, end });
  }

  async getSttResult(id: string) {
    const file = this.metaService.getFile(id);
    if (!file) return null;
    const sttPath = join(STT_DIR, `${file.filename}.json`);
    try {
      const raw = await readFile(sttPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async saveProgress(
    id: string,
    progress: { currentTime: number; segmentIndex: number },
  ): Promise<boolean> {
    const file = this.metaService.getFile(id);
    if (!file) return false;
    await this.metaService.updateFile(id, { progress });
    await this.metaService.setLastPlayedFileId(id);
    return true;
  }

  getProgress(id: string) {
    const file = this.metaService.getFile(id);
    if (!file) return null;
    return file.progress || { currentTime: 0, segmentIndex: 0 };
  }

  async updateSegmentTimes(
    id: string,
    updates: { id: number; start: number; end: number }[],
  ): Promise<boolean> {
    const file = this.metaService.getFile(id);
    if (!file) return false;

    const sttPath = join(STT_DIR, `${file.filename}.json`);
    let stt: any;
    try {
      const raw = await readFile(sttPath, 'utf-8');
      stt = JSON.parse(raw);
    } catch {
      return false;
    }

    const updateMap = new Map(updates.map((u) => [u.id, u]));
    for (const seg of stt.segments) {
      const u = updateMap.get(seg.id);
      if (u) {
        seg.start = u.start;
        seg.end = u.end;
      }
    }

    await writeFile(sttPath, JSON.stringify(stt, null, 2), 'utf-8');
    return true;
  }
}
