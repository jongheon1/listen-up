export interface FileMeta {
  id: string;
  originalName: string;
  filename: string;
  duration: number | null;
  sttStatus: 'pending' | 'processing' | 'done' | 'error';
  createdAt: string;
  progress?: { currentTime: number; segmentIndex: number };
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
  duration: number;
}

export interface PlaylistMeta {
  id: string;
  name: string;
  fileIds: string[];
  createdAt: string;
}
