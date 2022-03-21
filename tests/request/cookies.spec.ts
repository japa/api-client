/*
 * @japa/api-client
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import cookie from 'cookie'
import { test } from '@japa/runner'
import { ApiRequest } from '../../src/Request'
import { httpServer } from '../../test-helpers'

test.group('Request | cookies', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  test('send cookie header', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(cookie.parse(req.headers['cookie'])))
    })

    const request = new ApiRequest(
      { baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' },
      {},
      { setup: [], teardown: [] }
    ).dump()
    const response = await request.cookie('name', 'virk').cookie('pass', 'secret')

    assert.equal(response.status(), 200)
    assert.deepEqual(response.body(), {
      name: 'virk',
      pass: 'secret',
    })
  })

  test('prepare cookies using the serializer', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(cookie.parse(req.headers['cookie'])))
    })

    const request = new ApiRequest(
      { baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' },
      {
        serializers: {
          cookie: {
            process() {},
            prepare(_, value) {
              return Buffer.from(value).toString('base64')
            },
          },
        },
      },
      { setup: [], teardown: [] }
    ).dump()
    const response = await request.cookie('name', 'virk').cookie('pass', 'secret')

    assert.equal(response.status(), 200)
    assert.deepEqual(response.body(), {
      name: Buffer.from('virk').toString('base64'),
      pass: Buffer.from('secret').toString('base64'),
    })
  })
})
