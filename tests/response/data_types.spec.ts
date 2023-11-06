/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { dirname, join } from 'node:path'
import { test } from '@japa/runner'
import { createReadStream } from 'node:fs'

import { ApiRequest } from '../../src/request.js'
import { awaitStream, httpServer } from '../../tests_helpers/index.js'
import { fileURLToPath } from 'node:url'

test.group('Response | data types', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  test('parse html response from the server', async ({ assert }) => {
    httpServer.onRequest((_, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'text/html')
      res.end('<h1>hello world</h1>')
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })

    const response = await request
    response.dump()

    assert.equal(response.status(), 200)
    assert.isFalse(response.hasBody())
    assert.equal(response.text(), '<h1>hello world</h1>')
  })

  test('parse plain text response from the server', async ({ assert }) => {
    httpServer.onRequest((_, res) => {
      res.statusCode = 200
      res.end('hello world')
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })

    const response = await request
    response.dump()

    assert.equal(response.status(), 200)
    assert.isFalse(response.hasBody())
    assert.equal(response.text(), 'hello world')
  })

  test('parse json response from the server', async ({ assert }) => {
    httpServer.onRequest((_, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ message: 'hello world' }))
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })

    const response = await request
    response.dump()

    assert.equal(response.status(), 200)
    assert.deepEqual(response.body(), { message: 'hello world' })
  })

  test('parse json response with non 200 code', async ({ assert }) => {
    httpServer.onRequest((_, res) => {
      res.statusCode = 401
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ message: 'Unauthorized' }))
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })

    const response = await request
    response.dump()

    assert.equal(response.status(), 401)
    assert.deepEqual(response.body(), { message: 'Unauthorized' })
  })

  test('parse streaming response from the server', async ({ assert }) => {
    httpServer.onRequest((_, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      createReadStream(join(dirname(fileURLToPath(import.meta.url)), '../../package.json')).pipe(
        res
      )
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })

    const response = await request
    response.dump()

    assert.equal(response.status(), 200)
    assert.properties(response.body(), ['name', 'version'])
    assert.equal(response.body().name, '@japa/api-client')
  })

  test('parse binary response from the server', async ({ assert }) => {
    httpServer.onRequest((_, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'image/png')
      createReadStream(join(dirname(fileURLToPath(import.meta.url)), '../../logo.png')).pipe(res)
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })

    const response = await request
    response.dump()

    assert.equal(response.status(), 200)
    assert.isAbove(response.body().length, 1000 * 5)
  })

  test('get unknown content as text', async ({ assert }) => {
    httpServer.onRequest((_, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'foo/bar')
      res.end('<h1>hello world</h1>')
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })

    const response = await request
    response.dump()

    assert.equal(response.status(), 200)
    assert.isFalse(response.hasBody())
    assert.equal(response.text(), '<h1>hello world</h1>')
  })

  test('parse multipart response from the server', async ({ assert }) => {
    httpServer.onRequest(async (req, res) => {
      const body = await awaitStream(req)
      res.statusCode = 200
      res.setHeader('content-type', req.headers['content-type']!)
      res.end(body)
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })

    const response = await request
      .fields({ username: 'virk', age: 22 })
      .file('package', join(dirname(fileURLToPath(import.meta.url)), '../../package.json'))

    response.dump()
    assert.property(response.files(), 'package')
  })
})
