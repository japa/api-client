/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Readable } from 'node:stream'
import { createServer, RequestListener, Server } from 'node:http'

process.env.HOST = 'localhost'
process.env.PORT = '3000'

class HttpServer {
  baseUrl = `http://${process.env.HOST}:${process.env.PORT}`
  server?: Server

  close() {
    return new Promise<void>((resolve, reject) => {
      if (!this.server) {
        return resolve()
      }

      this.server.close((error) => {
        this.server = undefined
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  create() {
    return new Promise<void>((resolve) => {
      this.server = createServer()
      this.server.listen(process.env.PORT, () => {
        resolve()
      })
    })
  }

  onRequest(listener: RequestListener) {
    this.server!.on('request', listener)
  }
}

export const httpServer = new HttpServer()

export function awaitStream(stream: Readable) {
  return new Promise<string>((resolve, reject) => {
    let buffer = ''
    stream.on('data', (chunk) => (buffer += chunk))
    stream.on('end', () => resolve(buffer))
    stream.on('error', (error) => reject(error))
  })
}
