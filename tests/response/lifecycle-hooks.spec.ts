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
import { ApiResponse } from '../../src/Response'
import { httpServer } from '../../test-helpers'

test.group('Response | lifecycle hooks', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  test('execute teardown hooks', async ({ assert }) => {
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

    request.teardown((res) => {
      assert.instanceOf(res, ApiResponse)
      stack.push('teardown')
      return () => stack.push('teardown cleanup')
    })

    const response = await request

    assert.equal(response.status(), 200)
    assert.deepEqual(stack, ['setup', 'setup cleanup', 'teardown', 'teardown cleanup'])
  })

  test('do not execute teardown when request fails', async ({ assert }) => {
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

    request.teardown((res) => {
      assert.instanceOf(res, ApiResponse)
      stack.push('teardown')
      return () => stack.push('teardown cleanup')
    })

    await assert.rejects(async () => request.form({ name: 'virk' }).type('application/xyz'))

    assert.deepEqual(stack, ['setup', 'setup cleanup'])
  })
})
