import type {
  Platform,
  Scene,
  Source,
  StreamMetrics,
  StudioSettings,
} from '../types/studio'

export interface StartStreamPayload {
  scenes: Scene[]
  activeScene: string
  sources: Source[]
  platforms: Platform[]
  settings: StudioSettings
  audioVolume: number
  audioMuted: boolean
  audioMonitoringMode:
    | 'off'
    | 'monitor-only'
    | 'monitor-and-output'
}

export async function startStream(
  payload: StartStreamPayload,
): Promise<StreamMetrics> {
  const response = await fetch('/api/stream/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json()

  if (!response.ok || !data.ok) {
    throw new Error(
      data.error || 'Failed to start streaming.',
    )
  }

  return data.metrics
}

export async function stopStream(): Promise<StreamMetrics> {
  const response = await fetch('/api/stream/stop', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const data = await response.json()

  if (!response.ok || !data.ok) {
    throw new Error(
      data.error || 'Failed to stop streaming.',
    )
  }

  return data.metrics
}

export async function getStreamStatus(): Promise<StreamMetrics> {
  const response = await fetch('/api/stream/status', {
    method: 'GET',
    cache: 'no-store',
  })

  const data = await response.json()

  if (!response.ok || !data.ok) {
    throw new Error(
      data.error || 'Failed to get stream status.',
    )
  }

  return data.metrics
}
