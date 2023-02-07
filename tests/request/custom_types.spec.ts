/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'

import { ApiRequest } from '../../src/request'
import { awaitStream, httpServer } from '../../test_helpers'

test.group('Request | custom types', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  group.each.setup(async () => {
    return () => ApiRequest.removeSerializer('application/xyz')
  })

  test('serialize custom data type', async ({ assert }) => {
    httpServer.onRequest(async (req, res) => {
      const body = await awaitStream(req)
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ value: body }))
    })

    ApiRequest.addSerializer('application/xyz', function (value) {
      return `<foo>${value.foo}</foo>`
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()
    const response = await request.form({ foo: 'bar' }).type('application/xyz')

    assert.equal(response.status(), 200)
    assert.deepEqual(response.body(), {
      value: '<foo>bar</foo>',
    })
  })

  test('report error raised by custom serializer', async ({ assert }) => {
    httpServer.onRequest(async (req, res) => {
      const body = await awaitStream(req)
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ value: body }))
    })

    ApiRequest.addSerializer('application/xyz', function () {
      throw new Error('Failed')
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()
    await assert.rejects(() => request.form({ foo: 'bar' }).type('application/xyz'), 'Failed')
  })

  test('report error when content-type has no serializer', async ({ assert }) => {
    httpServer.onRequest(async (req, res) => {
      const body = await awaitStream(req)
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ value: body }))
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()
    await assert.rejects(
      () => request.form({ foo: 'bar' }).type('application/xyz'),
      'The "string" argument must be of type string or an instance of Buffer or ArrayBuffer. Received an instance of Object'
    )
  })
})
