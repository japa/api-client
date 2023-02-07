/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { parse } from 'querystring'
import { test } from '@japa/runner'

import { ApiRequest } from '../../src/request'
import { httpServer } from '../../test_helpers'

test.group('Request | query string', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  test('pass query string', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(parse(req.url!.split('?')[1])))
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()
    const response = await request.qs('orderBy', 'id').qs('direction', 'desc')

    assert.equal(response.status(), 200)
    assert.deepEqual(response.body(), {
      orderBy: 'id',
      direction: 'desc',
    })
  })

  test('pass query string as object', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(parse(req.url!.split('?')[1])))
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()
    const response = await request.qs({ orderBy: 'id', direction: 'desc' })

    assert.equal(response.status(), 200)
    assert.deepEqual(response.body(), {
      orderBy: 'id',
      direction: 'desc',
    })
  })

  test('pass query string as a string literal', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(parse(req.url!.split('?')[1])))
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()
    const response = await request.qs('orderBy=id&direction=desc')

    assert.equal(response.status(), 200)
    assert.deepEqual(response.body(), {
      orderBy: 'id',
      direction: 'desc',
    })
  })
})
