/**
 * Reusable player contract.
 *
 * The current shell (see `./Player.tsx`) is a placeholder — swap in Shaka
 * Player, hls.js, or a native `<video>` orchestrator to satisfy this
 * interface. Nothing else in the app needs to change.
 */

export type StreamProtocol = "hls" | "dash";

export interface DRMConfig {
  type: "widevine" | "fairplay" | "playready";
  licenseUrl: string;
  headers?: Record<string, string>;
}

export interface AudioTrack {
  id: string;
  language: string;
  label: string;
  channels?: number;
}

export interface SubtitleTrack {
  id: string;
  language: string;
  label: string;
  src?: string;
  format?: "vtt" | "ttml";
}

export interface QualityLevel {
  id: string;
  height: number;
  bitrate: number;
}

export interface PlayerSource {
  manifestUrl: string;
  protocol: StreamProtocol;
  drm?: DRMConfig;
  audioTracks?: AudioTrack[];
  subtitleTracks?: SubtitleTrack[];
  qualityLevels?: QualityLevel[];
  /** Resume position in seconds. */
  resumeAt?: number;
  /** Intro range, drives the "Skip Intro" affordance. */
  introRange?: { start: number; end: number };
  /** Credits range, drives the Next Episode countdown. */
  creditsRange?: { start: number; end: number };
}

export interface PlaybackEvents {
  onProgress?(seconds: number): void;
  onCompleted?(): void;
  onError?(err: Error): void;
  onQualityChange?(level: QualityLevel): void;
  onAudioChange?(track: AudioTrack): void;
  onSubtitleChange?(track: SubtitleTrack | null): void;
}

export interface PlayerCapabilities {
  pictureInPicture: boolean;
  fullscreen: boolean;
  adaptiveBitrate: boolean;
  playbackRates: number[];
}
