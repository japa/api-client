/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'

import { ApiClient } from '../../src/client.js'
import { ApiRequest } from '../../src/request.js'
import { httpServer } from '../../tests_helpers/index.js'
import { ApiResponse } from '../../src/response.js'
import { RequestConfig } from '../../src/types.js'

test.group('API client | request', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  group.each.setup(() => {
    return () => {
      ApiClient.clearRequestHandlers()
      ApiClient.clearSetupHooks()
      ApiClient.clearTeardownHooks()
    }
  })

  test('make { method } request using api client')
    .with<{ method: RequestConfig['method'] }[]>([
      { method: 'GET' },
      { method: 'POST' },
      { method: 'PUT' },
      { method: 'PATCH' },
      { method: 'DELETE' },
      { method: 'HEAD' },
      { method: 'OPTIONS' },
    ])
    .run(async ({ assert }, { method }) => {
      let requestMethod: RequestConfig['method']
      let requestEndpoint: string

      httpServer.onRequest((req, res) => {
        requestMethod = method
        requestEndpoint = req.url!
        res.end('handled')
      })

      // @ts-ignore
      const request = new ApiClient(httpServer.baseUrl)[method.toLowerCase()]('/')
      const response = await request

      assert.equal(requestMethod!, method)
      assert.equal(requestEndpoint!, '/')

      if (method !== 'HEAD') {
        assert.equal(response.text(), 'handled')
      }
    })

  test('register global setup hooks using the ApiClient', async ({ assert }) => {
    const stack: string[] = []

    httpServer.onRequest((_, res) => {
      res.end('handled')
    })

    ApiClient.setup(async (req) => {
      assert.instanceOf(req, ApiRequest)
      stack.push('setup')
      return () => stack.push('setup cleanup')
    })

    const request = new ApiClient(httpServer.baseUrl).get('/')
    await request

    assert.deepEqual(stack, ['setup', 'setup cleanup'])
  })

  test('register global teardown hooks using the ApiClient', async ({ assert }) => {
    const stack: string[] = []

    httpServer.onRequest((_, res) => {
      res.end('handled')
    })

    ApiClient.setup(async (req) => {
      assert.instanceOf(req, ApiRequest)
      stack.push('setup')
      return () => stack.push('setup cleanup')
    })

    ApiClient.teardown((res) => {
      assert.instanceOf(res, ApiResponse)
      stack.push('teardown')
      return () => stack.push('teardown cleanup')
    })

    const request = new ApiClient(httpServer.baseUrl).get('/')
    await request

    assert.deepEqual(stack, ['setup', 'setup cleanup', 'teardown', 'teardown cleanup'])
  })

  test('clear setup hooks', async ({ assert }) => {
    const stack: string[] = []

    httpServer.onRequest((_, res) => {
      res.end('handled')
    })

    ApiClient.setup(async (req) => {
      assert.instanceOf(req, ApiRequest)
      stack.push('setup')
      return () => stack.push('setup cleanup')
    })

    ApiClient.clearSetupHooks()
    const request = new ApiClient(httpServer.baseUrl).get('/')
    await request

    assert.deepEqual(stack, [])
  })

  test('clear teardown hooks', async ({ assert }) => {
    const stack: string[] = []

    httpServer.onRequest((_, res) => {
      res.end('handled')
    })

    ApiClient.setup(async (req) => {
      assert.instanceOf(req, ApiRequest)
      stack.push('setup')
      return () => stack.push('setup cleanup')
    })

    ApiClient.teardown((res) => {
      assert.instanceOf(res, ApiResponse)
      stack.push('teardown')
      return () => stack.push('teardown cleanup')
    })

    ApiClient.clearTeardownHooks()

    const request = new ApiClient(httpServer.baseUrl).get('/')
    await request

    assert.deepEqual(stack, ['setup', 'setup cleanup'])
  })

  test('use HOST and PORT env variables when no baseUrl is provided', async ({ assert }) => {
    httpServer.onRequest((_, res) => {
      res.end('handled')
    })

    const request = new ApiClient().get('/')
    const response = await request
    assert.equal(response.text(), 'handled')
  })

  test('invoke request setup handlers when a request is created', async ({ assert }) => {
    assert.plan(1)
    httpServer.onRequest((_, res) => {
      res.end('handled')
    })

    ApiClient.onRequest((request) => {
      assert.instanceOf(request, ApiRequest)
    })

    new ApiClient(httpServer.baseUrl).get('/')
  })
})
