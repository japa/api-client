/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'

import { ApiRequest } from '../../src/request.js'
import { httpServer } from '../../tests_helpers/index.js'

test.group('Request | headers', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  test('send custom headers', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify({
          foo: req.headers['x-foo'],
          baz: req.headers['x-baz'],
        })
      )
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()
    const response = await request.header('X-Foo', 'bar').header('X-Baz', ['foo', 'bar'])

    assert.equal(response.status(), 200)
    assert.deepEqual(response.body(), {
      foo: 'bar',
      baz: 'foo, bar',
    })
  })

  test('send custom headers as an object', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify({
          foo: req.headers['x-foo'],
          baz: req.headers['x-baz'],
        })
      )
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()
    const response = await request.headers({ 'X-Foo': 'bar', 'X-Baz': ['foo', 'bar'] })

    assert.equal(response.status(), 200)
    assert.deepEqual(response.body(), {
      foo: 'bar',
      baz: 'foo, bar',
    })
  })
})
