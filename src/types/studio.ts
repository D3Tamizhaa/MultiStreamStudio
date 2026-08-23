export type PlatformName =
  | 'YouTube'
  | 'Facebook'
  | 'Twitch'
  | 'Kick'
  | 'Custom'

export type PlatformStreamStatus =
  | 'offline'
  | 'connecting'
  | 'live'
  | 'error'

export type SourceType =
  | 'image'
  | 'browser'
  | 'media'
  | 'text'

export type AudioMonitoringMode =
  | 'off'
  | 'monitor-only'
  | 'monitor-and-output'

export type SettingsSection =
  | 'output'
  | 'audio'
  | 'video'
  | 'advanced'

export interface Platform {
  id: string
  name: PlatformName
  enabled: boolean
  server: string
  streamKey: string
  status: PlatformStreamStatus
  icon?: string
}

export interface Scene {
  id: string
  name: string
  color?: string
}

export interface SourceProperties {
  x?: number
  y?: number
  width?: number
  height?: number

  file?: string
  url?: string

  text?: string
  fontSize?: number
  fontFamily?: string
  color?: string

  loop?: boolean

  [key: string]: unknown
}

export interface Source {
  id: string
  sceneId: string
  name: string
  type: SourceType
  visible: boolean
  locked?: boolean
  properties: SourceProperties
}

export interface OutputSettings {
  encoder: string
  bitrate: string | number
  preset: string
  tune: string
  rateControl: string
  keyframeInterval: string | number
  profile: string
}

export interface AudioSettings {
  encoder: string
  sampleRate: string | number
  bitrate: string | number
  channels: string
}

export interface VideoSettings {
  outputResolution: string
  fps: string | number
}

export interface AdvancedSettings {
  automaticallyReconnect: boolean
  reconnectDelay?: number
}

export interface StudioSettings {
  output: OutputSettings
  audio: AudioSettings
  video: VideoSettings
  advanced: AdvancedSettings
}

export type StreamStatus =
  | 'offline'
  | 'starting'
  | 'streaming'
  | 'stopping'
  | 'error'

export interface StreamMetrics {
  status: StreamStatus
  pid: number | null
  uptimeSeconds: number
  bitrateKbps: number
  fps: number
  cpuPercent: number
  ramPercent: number
  ramMb: number
  frame: number
  speed: string
  error?: string
}

export interface StreamStartResponse {
  ok: boolean
  metrics: StreamMetrics
  error?: string
}
