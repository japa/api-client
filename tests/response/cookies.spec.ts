/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import cookie from 'cookie'
import { test } from '@japa/runner'

import { ApiRequest } from '../../src/request'
import { httpServer } from '../../test_helpers'

test.group('Response | cookies', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  test('parse response cookies', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      res.statusCode = 200
      res.setHeader('set-cookie', cookie.serialize('foo', 'bar'))
      res.end(req.url)
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })

    const response = await request
    response.dump()

    assert.deepEqual(response.cookies(), { foo: { name: 'foo', value: 'bar' } })
  })

  test('parse multiple response cookies', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      res.statusCode = 200
      res.setHeader('set-cookie', [cookie.serialize('foo', 'bar'), cookie.serialize('bar', 'baz')])
      res.end(req.url)
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })

    const response = await request
    response.dump()

    assert.deepEqual(response.cookies(), {
      foo: { name: 'foo', value: 'bar' },
      bar: { name: 'bar', value: 'baz' },
    })
  })

  test('parse cookie attributes', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      res.statusCode = 200
      res.setHeader('set-cookie', [cookie.serialize('foo', 'bar', { path: '/', maxAge: 3600 })])
      res.end(req.url)
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })

    const response = await request
    response.dump()

    assert.deepEqual(response.cookies(), {
      foo: { name: 'foo', value: 'bar', maxAge: 3600, path: '/' },
    })
  })

  test('pass cookies to cookie serializer', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      res.statusCode = 200
      res.setHeader('set-cookie', [
        cookie.serialize('foo', Buffer.from('bar').toString('base64'), { path: '/', maxAge: 3600 }),
      ])
      res.end(req.url)
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
      serializers: {
        cookie: {
          process(_, value) {
            return Buffer.from(value, 'base64').toString('utf8')
          },
          prepare(_, value) {
            return value
          },
        },
      },
    })

    const response = await request
    response.dump()

    assert.deepEqual(response.cookies(), {
      foo: { name: 'foo', value: 'bar', maxAge: 3600, path: '/' },
    })
  })
})
