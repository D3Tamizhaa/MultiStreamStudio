import {
  CircleStop,
  Play,
  Radio,
} from 'lucide-react'

import type {
  StreamMetrics,
} from '../types/studio'

interface ControlsPanelProps {
  metrics: StreamMetrics
  onStart: () => void
  onStop: () => void
}

export function ControlsPanel({
  metrics,
  onStart,
  onStop,
}: ControlsPanelProps) {
  const streaming =
    metrics.status === 'streaming' ||
    metrics.status === 'starting'

  const stopping =
    metrics.status === 'stopping'

  const canStart =
    !streaming && !stopping

  const canStop =
    streaming && !stopping

  return (
    <section className="bottom-panel controls-panel">
      <div className="panel-header">
        <div>
          <h3>Controls</h3>
        </div>
      </div>

      <div className="control-buttons">
        <button
          type="button"
          className="start-stream-button"
          disabled={!canStart}
          onClick={onStart}
        >
          <Play
            size={16}
            fill="currentColor"
          />
          {metrics.status === 'starting'
            ? 'Starting...'
            : 'Start Streaming'}
        </button>

        <button
          type="button"
          className="end-stream-button"
          disabled={!canStop}
          onClick={onStop}
        >
          <CircleStop size={16} />

          {stopping
            ? 'Stopping...'
            : 'End Streaming'}
        </button>
      </div>

      <div className="control-note">
        <Radio size={12} />

        {metrics.status === 'streaming'
          ? 'FFmpeg streaming active'
          : metrics.status === 'starting'
            ? 'Starting FFmpeg...'
            : metrics.status === 'stopping'
              ? 'Stopping FFmpeg...'
              : metrics.status === 'error'
                ? metrics.error ||
                  'FFmpeg error'
                : 'Streaming offline'}
      </div>
    </section>
  )
}
