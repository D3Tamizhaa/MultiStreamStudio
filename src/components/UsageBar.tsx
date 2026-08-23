import type {
  StreamMetrics,
} from '../types/studio'

interface UsageBarProps {
  metrics: StreamMetrics
}

function formatUptime(
  seconds: number,
) {
  const hours = Math.floor(
    seconds / 3600,
  )

  const minutes = Math.floor(
    (seconds % 3600) / 60,
  )

  const remainingSeconds =
    seconds % 60

  return [
    hours,
    minutes,
    remainingSeconds,
  ]
    .map((value) =>
      String(value).padStart(2, '0'),
    )
    .join(':')
}

export function UsageBar({
  metrics,
}: UsageBarProps) {
  const online =
    metrics.status === 'streaming' ||
    metrics.status === 'starting'

  return (
    <footer className="usage-bar">
      <div className="metric">
        <span>Uptime</span>

        <strong>
          {online
            ? formatUptime(
                metrics.uptimeSeconds,
              )
            : '--'}
        </strong>
      </div>

      <div className="metric">
        <span>Bitrate</span>

        <strong>
          {online
            ? Math.round(
                metrics.bitrateKbps,
              )
            : '--'}{' '}
          <small>kbit/s</small>
        </strong>
      </div>

      <div className="metric">
        <span>FPS</span>

        <strong>
          {online
            ? metrics.fps.toFixed(1)
            : '--'}
        </strong>
      </div>

      <div className="metric">
        <span>CPU</span>

        <strong>
          {online
            ? `${metrics.cpuPercent.toFixed(1)}%`
            : '--'}
        </strong>
      </div>

      <div className="metric">
        <span>RAM</span>

        <strong>
          {online
            ? `${metrics.ramMb.toFixed(0)} MB`
            : '--'}
        </strong>
      </div>

      <div className="status-metric">
        <span>Status</span>

        <strong
          className={
            online
              ? 'online'
              : metrics.status === 'error'
                ? 'error'
                : 'offline'
          }
        >
          <i />

          {metrics.status ===
          'streaming'
            ? 'Streaming'
            : metrics.status ===
                'starting'
              ? 'Starting'
              : metrics.status ===
                  'stopping'
                ? 'Stopping'
                : metrics.status ===
                    'error'
                  ? 'Error'
                  : 'Offline'}
        </strong>
      </div>
    </footer>
  )
}
