import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'

import { streamManager } from './server/ffmpeg/streamManager.mjs'

const __dirname = path.dirname(
  fileURLToPath(import.meta.url),
)

const PORT =
  Number(process.env.PORT) || 3001

const DIST = path.join(
  __dirname,
  'dist',
)

const MEDIA_DIR = path.join(
  __dirname,
  'uploads',
)

fs.mkdirSync(MEDIA_DIR, {
  recursive: true,
})

function sendJson(
  res,
  status,
  data,
) {
  res.writeHead(status, {
    'Content-Type':
      'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin':
      'http://127.0.0.1:5173',
    'Access-Control-Allow-Methods':
      'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type',
  })

  res.end(JSON.stringify(data))
}

function sendError(
  res,
  status,
  error,
) {
  sendJson(res, status, {
    ok: false,
    error:
      error instanceof Error
        ? error.message
        : String(error),
  })
}

async function readJsonBody(req) {
  const chunks = []

  for await (const chunk of req) {
    chunks.push(chunk)
  }

  const body = Buffer.concat(chunks).toString(
    'utf8',
  )

  if (!body) {
    return {}
  }

  return JSON.parse(body)
}

function getMediaContentType(
  filePath,
) {
  const ext =
    path.extname(filePath).toLowerCase()

  const contentTypes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
  }

  return (
    contentTypes[ext] ||
    'application/octet-stream'
  )
}

function serveMedia(req, res) {
  const prefix = '/media/'

  if (!req.url.startsWith(prefix)) {
    return false
  }

  const requestedName =
    decodeURIComponent(
      req.url
        .slice(prefix.length)
        .split('?')[0],
    )

  const fileName =
    path.basename(requestedName)

  if (
    !fileName ||
    fileName !== requestedName
  ) {
    res.writeHead(400)
    res.end('Invalid media path')
    return true
  }

  const filePath = path.join(
    MEDIA_DIR,
    fileName,
  )

  fs.stat(
    filePath,
    (error, stats) => {
      if (error || !stats.isFile()) {
        res.writeHead(404)
        res.end('Media file not found')
        return
      }

      res.writeHead(200, {
        'Content-Type':
          getMediaContentType(filePath),
        'Content-Length':
          String(stats.size),
        'Cache-Control':
          'no-store',
        'Accept-Ranges': 'bytes',
      })

      fs.createReadStream(
        filePath,
      ).pipe(res)
    },
  )

  return true
}

async function uploadMedia(
  req,
  res,
) {
  const originalName =
    String(
      req.headers['x-filename'] ||
        'media',
    )

  const extension =
    path
      .extname(originalName)
      .toLowerCase()

  const allowedExtensions =
    new Set([
      '.mp4',
      '.webm',
      '.mov',
      '.mkv',
      '.mp3',
      '.wav',
      '.ogg',
      '.m4a',
      '.aac',
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.bmp',
    ])

  if (
    extension &&
    !allowedExtensions.has(extension)
  ) {
    throw new Error(
      `Unsupported media extension: ${extension}`,
    )
  }

  const fileName =
    `${randomUUID()}${extension}`

  const filePath =
    path.join(
      MEDIA_DIR,
      fileName,
    )

  await pipeline(
    req,
    fs.createWriteStream(
      filePath,
    ),
  )

  return {
    url: `/media/${fileName}`,
  }
}

function serveStatic(req, res) {
  let requestPath = decodeURIComponent(
    req.url.split('?')[0],
  )

  if (requestPath === '/') {
    requestPath = '/index.html'
  }

  const filePath = path.join(
    DIST,
    requestPath,
  )

  if (!filePath.startsWith(DIST)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  fs.readFile(
    filePath,
    (error, data) => {
      if (error) {
        fs.readFile(
          path.join(
            DIST,
            'index.html',
          ),
          (
            fallbackError,
            html,
          ) => {
            if (fallbackError) {
              res.writeHead(404)
              res.end('Not found')
              return
            }

            res.writeHead(200, {
              'Content-Type':
                'text/html; charset=utf-8',
            })

            res.end(html)
          },
        )

        return
      }

      const ext =
        path.extname(filePath)

      const contentTypes = {
        '.html':
          'text/html; charset=utf-8',
        '.js':
          'text/javascript; charset=utf-8',
        '.css':
          'text/css; charset=utf-8',
        '.json':
          'application/json',
        '.svg':
          'image/svg+xml',
        '.png':
          'image/png',
        '.jpg':
          'image/jpeg',
        '.jpeg':
          'image/jpeg',
        '.webp':
          'image/webp',
        '.ico':
          'image/x-icon',
        '.woff':
          'font/woff',
        '.woff2':
          'font/woff2',
      }

      res.writeHead(200, {
        'Content-Type':
          contentTypes[ext] ||
          'application/octet-stream',
      })

      res.end(data)
    },
  )
}

const server = http.createServer(
  async (req, res) => {
    const url =
      req.url.split('?')[0]

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin':
          'http://127.0.0.1:5173',
        'Access-Control-Allow-Methods':
          'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, X-Filename',
      })

      res.end()
      return
    }

    if (
      req.method === 'POST' &&
      url === '/api/media/upload'
    ) {
      try {
        const result =
          await uploadMedia(
            req,
            res,
          )

        sendJson(
          res,
          200,
          {
            ok: true,
            ...result,
          },
        )
      } catch (error) {
        console.error(
          'Media upload failed:',
          error,
        )

        sendError(
          res,
          400,
          error,
        )
      }

      return
    }

    /*
     * GET /api/stream/status
     */
    if (
      req.method === 'GET' &&
      url === '/api/stream/status'
    ) {
      sendJson(res, 200, {
        ok: true,
        metrics:
          streamManager.getMetrics(),
      })

      return
    }

    /*
     * POST /api/stream/start
     */
    if (
      req.method === 'POST' &&
      url === '/api/stream/start'
    ) {
      try {
        const configuration =
          await readJsonBody(req)

        const metrics =
          streamManager.start(
            configuration,
          )

        sendJson(res, 200, {
          ok: true,
          metrics,
        })
      } catch (error) {
        sendError(
          res,
          400,
          error,
        )
      }

      return
    }

    /*
     * POST /api/stream/stop
     */
    if (
      req.method === 'POST' &&
      url === '/api/stream/stop'
    ) {
      try {
        const metrics =
          streamManager.stop()

        sendJson(res, 200, {
          ok: true,
          metrics,
        })
      } catch (error) {
        sendError(
          res,
          500,
          error,
        )
      }

      return
    }

  if (serveMedia(req, res)) {
  return
}
    serveStatic(req, res)
  },
)

server.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `Multi Stream Studio server running on port ${PORT}`,
    )
  },
)
