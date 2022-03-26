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

test.group('Request | lifecycle hooks', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  test('execute setup hooks', async ({ assert }) => {
    const stack: string[] = []

    httpServer.onRequest((_, res) => {
      res.end()
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()

    request.setup((req) => {
      assert.instanceOf(req, ApiRequest)
      stack.push('setup')
      return () => stack.push('setup cleanup')
    })

    const response = await request

    assert.equal(response.status(), 200)
    assert.deepEqual(stack, ['setup', 'setup cleanup'])
  })

  test('execute cleanup hooks when request fails', async ({ assert }) => {
    const stack: string[] = []

    httpServer.onRequest((_, res) => {
      res.end()
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()

    request.setup((req) => {
      assert.instanceOf(req, ApiRequest)
      stack.push('setup')
      return (error: any) => {
        assert.isDefined(error)
        assert.notInstanceOf(error, ApiRequest)
        stack.push('setup cleanup')
      }
    })

    await assert.rejects(async () => request.form({ name: 'virk' }).type('application/xyz'))
    assert.deepEqual(stack, ['setup', 'setup cleanup'])
  })

  test('execute cleanup hooks when request passes', async ({ assert }) => {
    const stack: string[] = []

    httpServer.onRequest((_, res) => {
      res.end()
    })

    const request = new ApiRequest({
      baseUrl: httpServer.baseUrl,
      method: 'GET',
      endpoint: '/',
    }).dump()

    request.setup((req) => {
      assert.instanceOf(req, ApiRequest)
      stack.push('setup')
      return (error: any) => {
        assert.isNull(error)
        assert.notInstanceOf(error, ApiRequest)
        stack.push('setup cleanup')
      }
    })

    await request.form({ name: 'virk' })
    assert.deepEqual(stack, ['setup', 'setup cleanup'])
  })
})
