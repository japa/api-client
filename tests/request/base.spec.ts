/*
 * @japa/api-client
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'

import { ApiRequest } from '../../src/Request'
import { RequestConfig } from '../../src/Contracts'

import { httpServer } from '../../test-helpers'

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
})
