/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { parse, stringify } from 'qs'
import { test } from '@japa/runner'

import { ApiRequest } from '../../src/request.js'
import { httpServer } from '../../tests_helpers/index.js'

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

  test('specify array values in query string', async ({ assert, cleanup }) => {
    httpServer.onRequest((req, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(parse(req.url!.split('?')[1])))
    })

    ApiRequest.setQsSerializer((value) => stringify(value))
    cleanup(() => ApiRequest.removeQsSerializer())

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()

    const response = await request.qs('ids', ['1']).qs('usernames[]', 'virk')

    assert.equal(response.status(), 200)
    assert.deepEqual(response.body(), {
      ids: ['1'],
      usernames: ['virk'],
    })
  })
})
