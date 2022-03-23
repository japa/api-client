/*
 * @japa/api-client
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { load } from 'cheerio'
import { test } from '@japa/runner'

import { ApiRequest } from '../../src/Request'
import { httpServer } from '../../test-helpers'

test.group('Response | custom types', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  group.each.setup(async () => {
    return () => ApiRequest.removeParser('text/html')
  })

  test('define custom response parser', async ({ assert }) => {
    httpServer.onRequest((_, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'text/html')
      res.end('<h1>hello world</h1>')
    })

    ApiRequest.addParser('text/html', function (response, cb) {
      response.setEncoding('utf-8')
      response.text = ''
      response.on('data', (chunk) => (response.text += chunk))
      response.on('end', () => cb(null, load(response.text)))
      response.on('error', (error) => cb(error, null))
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })

    const response = await request
    response.dump()

    assert.equal(response.status(), 200)
    assert.isFalse(response.hasBody())
    assert.equal(response.body()('h1').text(), 'hello world')
  })

  test('pass error from the custom parser', async ({ assert }) => {
    httpServer.onRequest((_, res) => {
      res.statusCode = 200
      res.setHeader('content-type', 'text/html')
      res.end('<h1>hello world</h1>')
    })

    ApiRequest.addParser('text/html', function (response, cb) {
      cb(new Error('Parsing failed'), response)
    })

    const request = new ApiRequest({ baseUrl: httpServer.baseUrl, method: 'GET', endpoint: '/' })

    await assert.rejects(() => request, 'Parsing failed')
  })
})
