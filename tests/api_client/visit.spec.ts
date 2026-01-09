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
import { httpServer } from '../../tests_helpers/index.js'
import { type RouteBuilder } from '../../src/types.ts'

/**
 * Test routes registry (runtime)
 */
const testRoutes: Record<string, { methods: string[]; pattern: string }> = {
  'users.index': { methods: ['GET'], pattern: '/users' },
  'users.show': { methods: ['GET'], pattern: '/users/:id' },
  'users.create': { methods: ['POST'], pattern: '/users' },
  'users.update': { methods: ['PUT'], pattern: '/users/:id' },
  'posts.index': { methods: ['GET', 'HEAD'], pattern: '/posts' },
}

const routeBuilder: RouteBuilder = (name, params) => {
  const routeDef = testRoutes[name]
  if (!routeDef) {
    throw new Error(`Route "${name}" not found`)
  }
  return {
    url: routeDef.pattern.replace(/:(\w+)/g, (_, key) => String((params as any)[key] ?? '')),
    method: routeDef.methods[0],
  }
}

/**
 * Type augmentation for tests
 */
declare module '../../src/types.ts' {
  interface RoutesRegistry {
    'users.index': {
      methods: ['GET']
      pattern: '/users'
      types: {
        params: {}
        query: { page?: number; limit?: number }
        body: {}
        response: { users: Array<{ id: number; name: string }> }
      }
    }
    'users.show': {
      methods: ['GET']
      pattern: '/users/:id'
      types: {
        params: { id: string }
        query: {}
        body: {}
        response: { user: { id: number; name: string } }
      }
    }
    'users.create': {
      methods: ['POST']
      pattern: '/users'
      types: {
        params: {}
        query: {}
        body: { name: string; email: string }
        response: { user: { id: number; name: string } }
      }
    }
    'users.update': {
      methods: ['PUT']
      pattern: '/users/:id'
      types: {
        params: { id: string }
        query: {}
        body: { name?: string; email?: string }
        response: { user: { id: number; name: string } }
      }
    }
    'posts.index': {
      methods: ['GET', 'HEAD']
      pattern: '/posts'
      types: {
        params: {}
        query: {}
        body: {}
        response: { posts: Array<{ id: number; title: string }> }
      }
    }
  }
}

test.group('API client | visit', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  group.each.setup(() => {
    ApiClient.setRouteBuilder(routeBuilder)
    return () => {
      ApiClient.clearRequestHandlers()
      ApiClient.clearSetupHooks()
      ApiClient.clearTeardownHooks()
    }
  })

  test('make request using named route without params', async ({ assert }) => {
    let requestMethod: string
    let requestUrl: string

    httpServer.onRequest((req, res) => {
      requestMethod = req.method!
      requestUrl = req.url!
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ users: [{ id: 1, name: 'John' }] }))
    })

    const client = new ApiClient(httpServer.baseUrl)
    const response = await client.visit('users.index')

    assert.equal(requestMethod!, 'GET')
    assert.equal(requestUrl!, '/users')
    assert.deepEqual(response.body(), { users: [{ id: 1, name: 'John' }] })
  })

  test('make request using named route with params', async ({ assert }) => {
    let requestMethod: string
    let requestUrl: string

    httpServer.onRequest((req, res) => {
      requestMethod = req.method!
      requestUrl = req.url!
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ user: { id: 123, name: 'John' } }))
    })

    const client = new ApiClient(httpServer.baseUrl)
    const response = await client.visit('users.show', { id: '123' })

    assert.equal(requestMethod!, 'GET')
    assert.equal(requestUrl!, '/users/123')
    assert.deepEqual(response.body(), { user: { id: 123, name: 'John' } })
  })

  test('use first method from methods array', async ({ assert }) => {
    let requestMethod: string

    httpServer.onRequest((req, res) => {
      requestMethod = req.method!
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ posts: [] }))
    })

    const client = new ApiClient(httpServer.baseUrl)
    await client.visit('posts.index')

    assert.equal(requestMethod!, 'GET')
  })

  test('send typed JSON body', async ({ assert }) => {
    let requestBody: any

    httpServer.onRequest((req, res) => {
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => {
        requestBody = JSON.parse(body)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ user: { id: 1, name: 'John' } }))
      })
    })

    const client = new ApiClient(httpServer.baseUrl)
    await client.visit('users.create').json({ name: 'John', email: 'john@example.com' })

    assert.deepEqual(requestBody, { name: 'John', email: 'john@example.com' })
  })

  test('send typed query string', async ({ assert }) => {
    let requestUrl: string

    httpServer.onRequest((req, res) => {
      requestUrl = req.url!
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ users: [] }))
    })

    const client = new ApiClient(httpServer.baseUrl)
    await client.visit('users.index').qs({ page: 2, limit: 10 })

    assert.equal(requestUrl!, '/users?page=2&limit=10')
  })

  test('throw error when routes registry is not configured', async () => {
    ApiClient.clearRouteBuilder()
    const client = new ApiClient(httpServer.baseUrl)
    client.visit('users.index')
  }).throws(
    'Route builder not configured. Use ApiClient.setRouteBuilder() to configure a routes builder'
  )

  test('throw error when route is not found in registry', async ({ assert }) => {
    httpServer.onRequest((_, res) => res.end())

    const client = new ApiClient(httpServer.baseUrl)

    await assert.rejects(
      // @ts-expect-error - intentionally using non-existent route
      () => client.visit('non.existent'),
      /Route "non.existent" not found/
    )
  })
})

test.group('API client | unsafe methods', (group) => {
  group.each.setup(async () => {
    await httpServer.create()
    return () => httpServer.close()
  })

  group.each.setup(() => {
    ApiClient.setRouteBuilder(routeBuilder)
    return () => {
      ApiClient.clearRequestHandlers()
      ApiClient.clearSetupHooks()
      ApiClient.clearTeardownHooks()
    }
  })

  test('unsafeJson allows sending invalid body', async ({ assert }) => {
    let requestBody: any

    httpServer.onRequest((req, res) => {
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => {
        requestBody = JSON.parse(body)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ user: { id: 1, name: 'John' } }))
      })
    })

    const client = new ApiClient(httpServer.baseUrl)
    // Using unsafeJson to send data that doesn't match the expected body type
    await client.visit('users.create').unsafeJson({ invalid: 'data', extra: 123 })

    assert.deepEqual(requestBody, { invalid: 'data', extra: 123 })
  })

  test('unsafeForm allows sending invalid form data', async ({ assert }) => {
    let requestBody: string

    httpServer.onRequest((req, res) => {
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => {
        requestBody = body
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ user: { id: 1, name: 'John' } }))
      })
    })

    const client = new ApiClient(httpServer.baseUrl)
    await client.visit('users.create').unsafeForm({ wrong: 'field' })

    assert.equal(requestBody!, 'wrong=field')
  })

  test('unsafeQs allows sending invalid query params', async ({ assert }) => {
    let requestUrl: string

    httpServer.onRequest((req, res) => {
      requestUrl = req.url!
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ users: [] }))
    })

    const client = new ApiClient(httpServer.baseUrl)
    await client.visit('users.index').unsafeQs({ invalid: 'param' })

    assert.equal(requestUrl!, '/users?invalid=param')
  })
})

test.group('API client | type safety', (group) => {
  group.each.setup(() => {
    ApiClient.setRouteBuilder(routeBuilder)
    return () => {
      ApiClient.clearRequestHandlers()
    }
  })

  test('positive', async () => {
    const client = new ApiClient()

    // visit without params when route has no params
    client.visit('users.index')

    // visit with params when route requires params
    client.visit('users.show', { id: '123' })

    // json with correct body type
    client.visit('users.create').json({ name: 'John', email: 'john@example.com' })

    // qs with correct query type
    client.visit('users.index').qs({ page: 1 })

    // response body has correct type
    const response = await client.visit('users.index')
    const body = response.body()
    const users: Array<{ id: number; name: string }> = body.users
    console.log(users)

    // response body for single resource
    const showResponse = await client.visit('users.show', { id: '1' })
    const showBody = showResponse.body()
    const user: { id: number; name: string } = showBody.user
    console.log(user)
  }).skip(true, 'Type-only test')

  test('negative', async () => {
    const client = new ApiClient()

    // visit non-existent route
    // @ts-expect-error - 'invalid.route' doesn't exist in UserRoutesRegistry
    client.visit('invalid.route')

    // visit without required params
    // @ts-expect-error - users.show requires { id: string } param
    client.visit('users.show')

    // visit with wrong param type
    // @ts-expect-error - id should be string, not number
    client.visit('users.show', { id: 123 })

    // visit with missing param
    // @ts-expect-error - missing required 'id' param
    client.visit('users.show', {})

    // json with wrong body type
    // @ts-expect-error - body should have name and email, not just 'wrong'
    client.visit('users.create').json({ wrong: 'field' })

    // json with missing required field
    // @ts-expect-error - missing required 'email' field
    client.visit('users.create').json({ name: 'John' })

    // qs with wrong query type
    // @ts-expect-error - 'invalid' is not a valid query param for users.index
    client.visit('users.index').qs({ invalid: 'param' })

    // response body with wrong type
    const response = await client.visit('users.index')
    const body = response.body()
    // @ts-expect-error - body.users is Array<{ id: number; name: string }>, not string
    const wrongType: string = body.users
    console.log(wrongType)

    // accessing non-existent property on response
    // @ts-expect-error - 'nonExistent' doesn't exist on response body
    console.log(body.nonExistent)
  }).skip(true, 'Type-only test')
})
