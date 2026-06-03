export interface Env {
  MEDIA: R2Bucket;
  META: KVNamespace;
  OPENAI_API_KEY: string;
  SOURCE_LANG: string;
  TARGET_LANG: string;
}

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

export interface LangSettings {
  sourceLang: string;
  targetLang: string;
}

export interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
  translation: string;
}

export interface SttResult {
  segments: Segment[];
  duration: number | null;
}
