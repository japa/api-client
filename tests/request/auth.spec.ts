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
import { httpServer } from '../../test_helpers'

test.group('Request | auth', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  test('login using basic auth', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      res.statusCode = 200
      const [user, password] = Buffer.from(
        req.headers['authorization']!.split('Basic ')[1],
        'base64'
      )
        .toString('utf8')
        .split(':')

      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ user, password }))
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()
    const response = await request.basicAuth('virk', 'secret')

    assert.equal(response.status(), 200)
    assert.deepEqual(response.body(), {
      user: 'virk',
      password: 'secret',
    })
  })

  test('login using bearer token', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      res.statusCode = 200
      const token = req.headers['authorization']!.split('Bearer ')[1]
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ token }))
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()
    const response = await request.bearerToken('foobar')

    assert.equal(response.status(), 200)
    assert.deepEqual(response.body(), {
      token: 'foobar',
    })
  })
})
