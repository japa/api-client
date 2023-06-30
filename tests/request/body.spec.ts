/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { dirname, join } from 'node:path'
import { parse } from 'node:querystring'
import { test } from '@japa/runner'

import { ApiRequest } from '../../src/request.js'
import { awaitStream, httpServer } from '../../test_helpers/index.js'
import { fileURLToPath } from 'node:url'

test.group('Request | body', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  test('send form body', async ({ assert }) => {
    httpServer.onRequest(async (req, res) => {
      const body = await awaitStream(req)
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(parse(body)))
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()
    const response = await request.form({ username: 'virk', age: 22 })

    assert.equal(response.status(), 200)
    assert.deepEqual(response.body(), {
      username: 'virk',
      age: '22',
    })
  })

  test('send json body', async ({ assert }) => {
    httpServer.onRequest(async (req, res) => {
      const body = await awaitStream(req)
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(body)
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()
    const response = await request.json({ username: 'virk', age: 22 })

    assert.equal(response.status(), 200)
    assert.deepEqual(response.body(), {
      username: 'virk',
      age: 22,
    })
  })

  test('send multipart body', async ({ assert }) => {
    assert.plan(3)

    httpServer.onRequest(async (req, res) => {
      const body = await awaitStream(req)

      assert.match(req.headers['content-type']!, /multipart\/form-data; boundary/)
      assert.match(body, /virk/)
      assert.match(body, /22/)
      res.statusCode = 200
      res.end()
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()
    await request.fields({ username: 'virk', age: 22 })
  })

  test('attach files', async ({ assert }) => {
    assert.plan(4)

    httpServer.onRequest(async (req, res) => {
      const body = await awaitStream(req)

      assert.match(req.headers['content-type']!, /multipart\/form-data; boundary/)
      assert.match(body, /virk/)
      assert.match(body, /22/)
      assert.match(body, /filename="package.json"/)
      res.statusCode = 200
      res.end()
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()
    await request
      .fields({ username: 'virk', age: 22 })
      .file('package', join(dirname(fileURLToPath(import.meta.url)), '../../package.json'))
  })

  test('attach files with custom filename', async ({ assert }) => {
    assert.plan(4)

    httpServer.onRequest(async (req, res) => {
      const body = await awaitStream(req)

      assert.match(req.headers['content-type']!, /multipart\/form-data; boundary/)
      assert.match(body, /virk/)
      assert.match(body, /22/)
      assert.match(body, /filename="pkg.json"/)
      res.statusCode = 200
      res.end()
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()
    await request
      .fields({ username: 'virk', age: 22 })
      .file('package', join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), {
        filename: 'pkg.json',
      })
  })
})
