export interface TranscriptionResult {
  words: { word: string; start: number; end: number }[];
  text: string;
  duration: number | null;
}

export interface SttProvider {
  transcribe(audioPath: string): Promise<TranscriptionResult>;
}
