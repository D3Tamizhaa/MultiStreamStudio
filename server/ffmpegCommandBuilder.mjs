import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(
  fileURLToPath(import.meta.url),
)

const MEDIA_DIR = path.join(
  __dirname,
  '..',
  'uploads',
)

function parseResolution(value, fallback = '1920x1080') {
  const match = String(value || '').match(
    /^(\d+)x(\d+)$/,
  )

  if (!match) {
    return fallback
  }

  return `${match[1]}x${match[2]}`
}

function parseNumber(value, fallback) {
  const number = Number.parseFloat(
    String(value ?? '').replace(/[^\d.]/g, ''),
  )

  return Number.isFinite(number) ? number : fallback
}

function escapeFilterText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
}

function escapeFilterPath(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
}

function resolveFfmpegInput(
  source,
) {
  const serverFile =
    source.properties?.serverFile ||
    source.properties?.file

  if (!serverFile) {
    return ''
  }

  /*
   * Browser blob URLs only exist inside the browser.
   * FFmpeg cannot access them.
   */
  if (
    serverFile.startsWith('blob:')
  ) {
    throw new Error(
      `Source "${source.name}" still contains a browser blob URL. Re-select the media file so it can be uploaded to the server.`,
    )
  }

  /*
   * Uploaded files are stored in:
   *
   *   <project>/uploads/<uuid>.<ext>
   *
   * The browser uses /media/<filename>, but FFmpeg
   * should use the local filesystem path directly.
   */
  if (
    serverFile.startsWith('/media/')
  ) {
    const fileName =
      path.basename(serverFile)

    if (
      !fileName ||
      fileName !==
        serverFile.slice('/media/'.length)
    ) {
      throw new Error(
        `Invalid media path: ${serverFile}`,
      )
    }

    return path.join(
      MEDIA_DIR,
      fileName,
    )
  }

  return serverFile
}

function getPosition(source) {
  return {
    x: Number.isFinite(source.properties?.x)
      ? source.properties.x
      : 0,
    y: Number.isFinite(source.properties?.y)
      ? source.properties.y
      : 0,
  }
}

function getSize(source, outputWidth, outputHeight) {
  return {
    width:
      Number.isFinite(source.properties?.width) &&
      source.properties.width > 0
        ? source.properties.width
        : outputWidth,
    height:
      Number.isFinite(source.properties?.height) &&
      source.properties.height > 0
        ? source.properties.height
        : outputHeight,
  }
}

function encoderName(value) {
  const encoder = String(value || '').toLowerCase()

  if (
    encoder.includes('nvenc') ||
    encoder.includes('nvidia')
  ) {
    return 'h264_nvenc'
  }

  if (
    encoder.includes('quick sync') ||
    encoder.includes('qsv')
  ) {
    return 'h264_qsv'
  }

  if (
    encoder.includes('amd') ||
    encoder.includes('amf')
  ) {
    return 'h264_amf'
  }

  return 'libx264'
}

function audioEncoderName(value) {
  const encoder = String(value || '').toLowerCase()

  if (encoder.includes('opus')) {
    return 'libopus'
  }

  return 'aac'
}

function audioChannels(value) {
  const text = String(value || '').toLowerCase()

  if (text.includes('mono')) {
    return '1'
  }

  return '2'
}

function sampleRate(value) {
  const match = String(value || '').match(/\d+/)

  return match ? match[0] : '48000'
}

function buildOutputUrl(platform) {
  const server = String(platform.server || '').trim()
  const key = String(platform.streamKey || '').trim()

  if (!server || !key) {
    throw new Error(
      `Platform "${platform.name}" is missing server or stream key.`,
    )
  }

  return `${server.replace(/\/+$/, '')}/${key}`
}

export function buildFfmpegCommand({
  scenes,
  activeScene,
  sources,
  platforms,
  settings,
  audioVolume,
  audioMuted,
  audioMonitoringMode,
}) {
  const activeSources = sources.filter(
    (source) =>
      source.sceneId === activeScene &&
      source.visible,
  )

  const enabledPlatforms = platforms.filter(
    (platform) => platform.enabled,
  )

  if (enabledPlatforms.length === 0) {
    throw new Error(
      'Enable at least one streaming platform before starting.',
    )
  }

  const outputResolution = parseResolution(
    settings.video.outputResolution,
  )

  const [outputWidth, outputHeight] =
    outputResolution.split('x').map(Number)

  const fps = parseNumber(settings.video.fps, 30)

  const bitrate = parseNumber(
    settings.output.bitrate,
    6000,
  )

  const keyframeInterval = parseNumber(
    settings.output.keyframeInterval,
    2,
  )

  const audioBitrate = parseNumber(
    settings.audio.bitrate,
    160,
  )

  const videoEncoder = encoderName(
    settings.output.encoder,
  )

  const audioEncoder = audioEncoderName(
    settings.audio.encoder,
  )

  const args = [
    '-hide_banner',
    '-loglevel',
    'warning',
    '-nostats',
    '-progress',
    'pipe:1',
  ]

  /*
   * Base canvas.
   *
   * This means FFmpeg always has a video stream even when
   * the active scene currently has no visual source.
   */
  args.push(
    '-f',
    'lavfi',
    '-i',
    `color=c=black:s=${outputResolution}:r=${fps}`,
  )

  const filterParts = []

  filterParts.push(
    `[0:v]format=yuv420p[base]`,
  )

  let currentVideo = 'base'
  let inputIndex = 1

  for (const source of activeSources) {
    if (source.type === 'image') {
      const file = resolveFfmpegInput(source)

      if (!file) {
        continue
      }

      args.push(
        '-loop',
        '1',
        '-i',
        file,
      )

      const input = `${inputIndex}:v`
      const label = `src${inputIndex}`
      const position = getPosition(source)
      const size = getSize(
        source,
        outputWidth,
        outputHeight,
      )

      filterParts.push(
        `[${input}]scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease[${label}]`,
      )

      filterParts.push(
        `[${currentVideo}][${label}]overlay=${position.x}:${position.y}:shortest=0[v${inputIndex}]`,
      )

      currentVideo = `v${inputIndex}`
      inputIndex += 1
    }

    if (source.type === 'media') {
      const file =
  const file = source.properties?.file

      if (!file) {
        continue
      }

      if (source.properties?.loop) {
        args.push(
          '-stream_loop',
          '-1',
        )
      }

      args.push(
        '-i',
        file,
      )

      const input = `${inputIndex}:v`
      const label = `src${inputIndex}`
      const position = getPosition(source)
      const size = getSize(
        source,
        outputWidth,
        outputHeight,
      )

      filterParts.push(
        `[${input}]scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease[${label}]`,
      )

      filterParts.push(
        `[${currentVideo}][${label}]overlay=${position.x}:${position.y}:shortest=0[v${inputIndex}]`,
      )

      currentVideo = `v${inputIndex}`
      inputIndex += 1
    }

    if (source.type === 'text') {
      const text = source.properties?.text || ''

      if (!text) {
        continue
      }

      const position = getPosition(source)

      const fontSize =
        Number.isFinite(source.properties?.fontSize) &&
        source.properties.fontSize > 0
          ? source.properties.fontSize
          : 32

      const color =
        source.properties?.color || 'white'

      const fontFamily =
        source.properties?.fontFamily ||
        'Arial'

      filterParts.push(
        `[${currentVideo}]drawtext=` +
          `font='${escapeFilterText(fontFamily)}':` +
          `text='${escapeFilterText(text)}':` +
          `fontsize=${fontSize}:` +
          `fontcolor=${color}:` +
          `x=${position.x}:` +
          `y=${position.y}` +
          `[text${inputIndex}]`,
      )

      currentVideo = `text${inputIndex}`
    }
  }

  filterParts.push(
    `[${currentVideo}]scale=${outputWidth}:${outputHeight},fps=${fps},format=yuv420p[outv]`,
  )

  args.push(
    '-filter_complex',
    filterParts.join(';'),
  )

  args.push(
    '-map',
    '[outv]',
  )

  /*
   * Audio.
   *
   * We currently create silence when there is no audio input.
   * Source-specific audio routing will be added in the next
   * FFmpeg phase.
   */
const audioInputIndex = inputIndex

args.push(
  '-f',
  'lavfi',
  '-i',
  'anullsrc=channel_layout=stereo:sample_rate=48000',
)

filterParts.push(
  `[${currentVideo}]scale=${outputWidth}:${outputHeight},fps=${fps},format=yuv420p[outv]`,
)

args.push(
  '-filter_complex',
  filterParts.join(';'),
)

args.push(
  '-map',
  '[outv]',
  '-map',
  `${audioInputIndex}:a`,
)

  if (
    audioMuted ||
    audioMonitoringMode === 'monitor-only'
  ) {
    args.push(
      '-af',
      'volume=0',
    )
  } else {
    const volume = Math.max(
      0,
      Math.min(100, Number(audioVolume) || 0),
    )

    args.push(
      '-af',
      `volume=${volume / 100}`,
    )
  }

  args.push(
    '-c:v',
    videoEncoder,
    '-b:v',
    `${bitrate}k`,
    '-maxrate',
    `${bitrate}k`,
    '-bufsize',
    `${bitrate * 2}k`,
    '-g',
    String(Math.max(1, Math.round(fps * keyframeInterval))),
    '-preset',
    settings.output.preset || 'veryfast',
    '-profile:v',
    settings.output.profile || 'high',
    '-tune',
    settings.output.tune || 'zerolatency',
    '-r',
    String(fps),
    '-c:a',
    audioEncoder,
    '-b:a',
    `${audioBitrate}k`,
    '-ar',
    sampleRate(settings.audio.sampleRate),
    '-ac',
    audioChannels(settings.audio.channels),
  )

  /*
   * Every enabled platform becomes an FFmpeg output.
   *
   * Disabled platforms are intentionally never added.
   */
const teeOutputs = enabledPlatforms.map(
  (platform) =>
    `[f=flv]${buildOutputUrl(platform)}`,
)

args.push(
  '-f',
  'tee',
  teeOutputs.join('|'),
)

  return {
    args,
    activeScene:
      scenes.find(
        (scene) => scene.id === activeScene,
      )?.name || activeScene,
    enabledPlatforms,
  }
}
