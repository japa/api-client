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

test.group('Response | redirects', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  test('follow redirects', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      if (req.url === '/') {
        res.statusCode = 301
        res.setHeader('Location', '/see-this-instead')
        res.end()
      } else {
        res.statusCode = 200
        res.end(req.url)
      }
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })

    const response = await request
    response.dump()

    assert.equal(response.status(), 200)
    assert.deepEqual(response.redirects(), [`${httpServer.baseUrl}/see-this-instead`])
    assert.equal(response.text(), '/see-this-instead')
  })

  test('do not follow redirects more than the mentioned times', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      if (req.url === '/') {
        res.statusCode = 301
        res.setHeader('Location', '/see-this-instead')
        res.end()
      } else if (req.url === '/see-this-instead') {
        res.statusCode = 301
        res.setHeader('Location', '/see-that-instead')
        res.end()
      } else {
        res.statusCode = 200
        res.end(req.url)
      }
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })

    const response = await request.redirects(1)
    response.dump()

    assert.equal(response.status(), 301)
    assert.deepEqual(response.redirects(), [`${httpServer.baseUrl}/see-this-instead`])
    assert.equal(response.text(), '')
  })

  test('follow redirect multiple times', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      if (req.url === '/') {
        res.statusCode = 301
        res.setHeader('Location', '/see-this-instead')
        res.end()
      } else if (req.url === '/see-this-instead') {
        res.statusCode = 301
        res.setHeader('Location', '/see-that-instead')
        res.end()
      } else {
        res.statusCode = 200
        res.end(req.url)
      }
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })

    const response = await request.redirects(2)
    response.dump()

    assert.equal(response.status(), 200)
    assert.deepEqual(response.redirects(), [
      `${httpServer.baseUrl}/see-this-instead`,
      `${httpServer.baseUrl}/see-that-instead`,
    ])
    assert.equal(response.text(), '/see-that-instead')
  })
})
