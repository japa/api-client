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
import { httpServer } from '../../test-helpers'

test.group('Response', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  group.each.setup(async () => {
    return () => ApiRequest.removeParser('text/html')
  })

  test('get response content-type', async ({ assert }) => {
    httpServer.onRequest((_, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'text/html')
      res.end()
    })

    const request = new ApiRequest(
      { baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' },
      {},
      { setup: [], teardown: [] }
    )
    const response = await request

    response.dump()
    assert.equal(response.status(), 200)
    assert.equal(response.type(), 'text/html')
    assert.isUndefined(response.charset())
  })

  test('get response charset', async ({ assert }) => {
    httpServer.onRequest((_, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.end()
    })

    const request = new ApiRequest(
      { baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' },
      {},
      { setup: [], teardown: [] }
    )
    const response = await request

    response.dump()
    assert.equal(response.status(), 200)
    assert.equal(response.type(), 'text/html')
    assert.equal(response.charset(), 'utf-8')
  })

  test('get response status type', async ({ assert }) => {
    httpServer.onRequest((_, res) => {
      res.statusCode = 404
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.end()
    })

    const request = new ApiRequest(
      { baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' },
      {},
      { setup: [], teardown: [] }
    )
    const response = await request

    response.dump()
    assert.equal(response.statusType(), 4)
    assert.equal(response.type(), 'text/html')
    assert.equal(response.charset(), 'utf-8')
  })

  test('get response links', async ({ assert }) => {
    httpServer.onRequest((_, res) => {
      res.statusCode = 200
      res.setHeader(
        'Link',
        '<https://one.example.com>; rel="preconnect", <https://two.example.com>; rel="preload"'
      )
      res.end()
    })

    const request = new ApiRequest(
      { baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' },
      {},
      { setup: [], teardown: [] }
    )
    const response = await request

    response.dump()
    assert.equal(response.status(), 200)
    assert.deepEqual(response.links(), {
      preconnect: 'https://one.example.com',
      preload: 'https://two.example.com',
    })
  })
})
