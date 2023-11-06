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

import { ApiRequest } from '../../src/request.js'
import { httpServer } from '../../tests_helpers/index.js'

test.group('Response | assertions', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  test('assert response status', async ({ assert }) => {
    assert.plan(1)

    httpServer.onRequest((_, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'text/html')
      res.end('<h1>hello world</h1>')
    })

    const request = new ApiRequest(
      { baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' },
      assert
    )

    const response = await request
    response.assertStatus(200)
  })

  test('assert response headers', async ({ assert }) => {
    assert.plan(2)

    httpServer.onRequest((_, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'text/plain')
      res.end('hello world')
    })

    const request = new ApiRequest(
      { baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' },
      assert
    )

    const response = await request
    response.assertHeader('content-type')
    response.assertHeaderMissing('authorization')
  })

  test('assert response body', async ({ assert }) => {
    assert.plan(1)

    httpServer.onRequest((_, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify([{ message: 'hello world' }, { message: 'hi world' }]))
    })

    const request = new ApiRequest(
      { baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' },
      assert
    )

    const response = await request
    response.assertBodyContains([{ message: 'hello world' }, { message: 'hi world' }])
  })

  test('assert response body subset', async ({ assert }) => {
    assert.plan(1)

    httpServer.onRequest((_, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify([
          { message: 'hello world', time: new Date() },
          { message: 'hi world', time: new Date() },
        ])
      )
    })

    const request = new ApiRequest(
      { baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' },
      assert
    )

    const response = await request
    response.assertBodyContains([{ message: 'hello world' }, { message: 'hi world' }])
  })

  test('assert response body not subset', async ({ assert }) => {
    assert.plan(1)

    httpServer.onRequest((_, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify([{ message: 'hello world', time: new Date() }]))
    })

    const request = new ApiRequest(
      { baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' },
      assert
    )

    const response = await request
    response.assertBodyNotContains([{ message: 'hi world' }])
  })

  test('assert response body when response is not json', async ({ assert }) => {
    httpServer.onRequest((_, res) => {
      res.statusCode = 401
      res.end(JSON.stringify({ message: 'Unauthorized' }))
    })

    const request = new ApiRequest(
      { baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' },
      assert
    )

    const response = await request
    assert.throws(
      () => response.assertBody({ message: 'Unauthorized' }),
      "expected {} to deeply equal { message: 'Unauthorized' }"
    )
  })

  test('assert response cookies', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      res.statusCode = 200
      res.setHeader('set-cookie', cookie.serialize('foo', 'bar'))
      res.end(req.url)
    })

    const request = new ApiRequest(
      { baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' },
      assert
    )

    const response = await request
    response.assertCookie('foo')
    response.assertCookie('foo', 'bar')
    response.assertCookieMissing('baz')
  })

  test('raise exception when assert plugin is not installed', async ({ assert }) => {
    httpServer.onRequest((req, res) => {
      res.statusCode = 200
      res.setHeader('set-cookie', cookie.serialize('foo', 'bar'))
      res.end(req.url)
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })

    const response = await request
    assert.throws(
      () => response.assertCookie('foo'),
      'Response assertions are not available. Make sure to install the @japa/assert plugin'
    )
  })
})
