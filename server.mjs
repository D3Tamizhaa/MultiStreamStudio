import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin':
          'http://127.0.0.1:5173',
        'Access-Control-Allow-Methods':
          'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type',
      })

      res.end()
      return
    }

    const url =
      req.url.split('?')[0]

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

    /*
     * Everything else is the React/Vite build.
     */
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
