import { spawn } from 'node:child_process'
import { buildFfmpegCommand } from '../ffmpegCommandBuilder.mjs'

class StreamManager {
  constructor() {
    this.process = null
    this.startedAt = null
    this.metrics = {
      status: 'offline',
      pid: null,
      uptimeSeconds: 0,
      bitrateKbps: 0,
      fps: 0,
      cpuPercent: 0,
      ramPercent: 0,
      ramMb: 0,
      frame: 0,
      speed: '0x',
    }
    this.lastError = null
    this.platforms = []
  }

  isRunning() {
    return Boolean(this.process)
  }

  getMetrics() {
    const uptimeSeconds = this.startedAt
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - this.startedAt) / 1000,
          ),
        )
      : 0

    return {
      ...this.metrics,
      uptimeSeconds,
      pid: this.process?.pid ?? null,
      error: this.lastError || undefined,
    }
  }

  start(configuration) {
    if (this.process) {
      throw new Error(
        'FFmpeg is already running.',
      )
    }

    const command = buildFfmpegCommand(
      configuration,
    )

    console.log(
      'Starting FFmpeg:',
      'ffmpeg',
      command.args.join(' '),
    )

    this.lastError = null
    this.metrics = {
      status: 'starting',
      pid: null,
      uptimeSeconds: 0,
      bitrateKbps: 0,
      fps: 0,
      cpuPercent: 0,
      ramPercent: 0,
      ramMb: 0,
      frame: 0,
      speed: '0x',
    }

    this.platforms = command.enabledPlatforms

    const child = spawn(
      'ffmpeg',
      command.args,
      {
        stdio: [
          'ignore',
          'pipe',
          'pipe',
        ],
        windowsHide: true,
      },
    )

    this.process = child
    this.startedAt = Date.now()
    this.metrics.pid = child.pid ?? null

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    child.stdout.on('data', (chunk) => {
      this.parseProgress(chunk)
    })

    child.stderr.on('data', (chunk) => {
      const text = String(chunk).trim()

      if (text) {
        console.error(
          `[FFmpeg] ${text}`,
        )
      }
    })

    child.on('spawn', () => {
      this.metrics.status = 'streaming'
    })

    child.on('error', (error) => {
      this.lastError = error.message
      this.metrics.status = 'error'
      this.process = null
    })

    child.on('close', (code, signal) => {
      console.log(
        `FFmpeg exited. code=${code} signal=${signal}`,
      )

      if (
        this.metrics.status !== 'stopping'
      ) {
        if (code === 0) {
          this.metrics.status = 'offline'
        } else {
          this.metrics.status = 'error'
          this.lastError =
            this.lastError ||
            `FFmpeg exited with code ${code}.`
        }
      }

      this.process = null
    })

    return this.getMetrics()
  }

  stop() {
    if (!this.process) {
      this.metrics.status = 'offline'
      return this.getMetrics()
    }

    this.metrics.status = 'stopping'

    const child = this.process

    if (process.platform === 'win32') {
      child.kill('SIGINT')
    } else {
      child.kill('SIGINT')
    }

    setTimeout(() => {
      if (this.process === child) {
        try {
          child.kill('SIGKILL')
        } catch {
          // Process may already have exited.
        }
      }
    }, 5000)

    return this.getMetrics()
  }

  parseProgress(chunk) {
    const lines = String(chunk)
      .split(/\r?\n/)
      .filter(Boolean)

    for (const line of lines) {
      const separator = line.indexOf('=')

      if (separator === -1) {
        continue
      }

      const key = line.slice(0, separator)
      const value = line.slice(separator + 1)

      if (key === 'frame') {
        const frame = Number(value)

        if (Number.isFinite(frame)) {
          this.metrics.frame = frame
        }
      }

      if (key === 'fps') {
        const fps = Number(value)

        if (Number.isFinite(fps)) {
          this.metrics.fps = fps
        }
      }

      if (key === 'bitrate') {
        const bitrate = Number.parseFloat(value)

        if (Number.isFinite(bitrate)) {
          this.metrics.bitrateKbps =
            bitrate
        }
      }

      if (key === 'speed') {
        this.metrics.speed = value
      }
    }
  }
}

export const streamManager =
  new StreamManager()
