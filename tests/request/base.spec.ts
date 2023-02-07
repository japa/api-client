/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { IncomingMessage } from 'http'

import { ApiRequest } from '../../src/request'
import { RequestConfig } from '../../src/types'
import { ApiResponse } from '../../src/response'
import { httpServer } from '../../test_helpers'

test.group('Request', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  test('make { method } request to a given URL')
    .with<{ method: RequestConfig['method'] }[]>([
      { method: 'GET' },
      { method: 'POST' },
      { method: 'PUT' },
      { method: 'PATCH' },
      { method: 'DELETE' },
      { method: 'HEAD' },
      { method: 'OPTIONS' },
    ])
    .run(async ({ assert }, { method }) => {
      let requestMethod: RequestConfig['method']
      let requestEndpoint: string

      httpServer.onRequest((req, res) => {
        requestMethod = method
        requestEndpoint = req.url!
        res.end('handled')
      })

      const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method, endpoint: '/' })
      const response = await request.dump()

      assert.equal(requestMethod!, method)
      assert.equal(requestEndpoint!, '/')

      if (method !== 'HEAD') {
        assert.equal(response.text(), 'handled')
      }
    })

  test('set accept header for the response', async ({ assert }) => {
    httpServer.onRequest(async (req, res) => {
      res.statusCode = 200
      res.end(req.headers['accept'])
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })
    const response = await request.accept('json')
    assert.equal(response.text(), 'application/json')
  })

  test('abort request after mentioned timeout', async ({ assert }) => {
    let serverRequest: IncomingMessage
    httpServer.onRequest(async (req) => {
      serverRequest = req
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })
    await assert.rejects(() => request.accept('json').timeout(1000), 'Timeout of 1000ms exceeded')

    /**
     * Required to close the HTTP server
     */
    serverRequest!.socket.destroy()
  })

  test('retry failing requests for the given number of count', async ({ assert }) => {
    let retries = 0

    httpServer.onRequest(async (_, res) => {
      retries++
      res.statusCode = 408
      res.end()
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })
    await request.accept('json').retry(3)

    assert.equal(retries, 4)
  })

  test('retry failing request until the callback returns false', async ({ assert }) => {
    let retries = 0

    httpServer.onRequest(async (_, res) => {
      retries++
      res.statusCode = 408
      res.end()
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })
    await request.accept('json').retry(Infinity, () => {
      return retries < 6
    })

    assert.equal(retries, 6)
  })

  test('respect max count even when callback returns true', async ({ assert }) => {
    let retries = 0

    httpServer.onRequest(async (_, res) => {
      retries++
      res.statusCode = 408
      res.end()
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })
    await request.accept('json').retry(3, () => {
      return retries < 6
    })

    assert.equal(retries, 4)
  })

  test('access response within the retry callback', async ({ assert }) => {
    let retries = 0

    httpServer.onRequest(async (_, res) => {
      retries++
      res.statusCode = 408
      res.end()
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })
    await request.accept('json').retry(3, (error, response) => {
      assert.isNull(error)
      assert.instanceOf(response, ApiResponse)
      return retries < 6
    })

    assert.equal(retries, 4)
  })
})
