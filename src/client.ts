/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import Macroable from '@poppinss/macroable'
import type { Assert } from '@japa/assert'

import { ApiRequest } from './request.js'
import {
  type SetupHandler,
  type TeardownHandler,
  type CookiesSerializer,
  type InferBody,
  type InferResponse,
  type InferQuery,
  type RoutesRegistry,
  type InferRouteBody,
  type InferRouteQuery,
  type InferRouteResponse,
  type InferRouteParams,
  type IsEmptyObject,
  type RouteBuilder,
} from './types.js'

/**
 * ApiClient provides a fluent interface for making HTTP requests in the context of testing.
 * It supports type-safe routing, custom serializers, and global hooks.
 *
 * @example
 * const client = new ApiClient('http://localhost:3000')
 * const response = await client.get('/users').send()
 */
export class ApiClient extends Macroable {
  /**
   * Invoked when a new instance of request is created
   */
  static #onRequestHandlers: ((request: ApiRequest) => void)[] = []

  /**
   * Hooks handlers to pass onto the request
   */
  static #hooksHandlers: {
    setup: SetupHandler[]
    teardown: TeardownHandler[]
  } = {
    setup: [],
    teardown: [],
  }

  static #routerBuilder?: RouteBuilder
  static #customCookiesSerializer?: CookiesSerializer

  #baseUrl?: string
  #assert?: Assert

  constructor(baseUrl?: string, assert?: Assert) {
    super()

    this.#baseUrl = baseUrl
    this.#assert = assert
  }

  /**
   * Remove all globally registered setup hooks.
   */
  static clearSetupHooks() {
    this.#hooksHandlers.setup = []
    return this
  }

  /**
   * Remove all globally registered teardown hooks.
   */
  static clearTeardownHooks() {
    this.#hooksHandlers.teardown = []
    return this
  }

  /**
   * Clear all request handlers registered using the `onRequest` method.
   */
  static clearRequestHandlers() {
    this.#onRequestHandlers = []
    return this
  }

  /**
   * Register a handler to be invoked every time a new request instance is created.
   *
   * @param handler - The callback to invoke with the request instance
   *
   * @example
   * ApiClient.onRequest((request) => {
   *   request.header('X-Custom', 'value')
   * })
   */
  static onRequest(handler: (request: ApiRequest) => void) {
    this.#onRequestHandlers.push(handler)
    return this
  }

  /**
   * Register a global setup hook that runs before every request.
   *
   * @param handler - The setup handler function
   *
   * @example
   * ApiClient.setup((request) => {
   *   request.header('Authorization', 'Bearer token')
   * })
   */
  static setup(handler: SetupHandler) {
    this.#hooksHandlers.setup.push(handler)
    return this
  }

  /**
   * Register a global teardown hook that runs after every request.
   *
   * @param handler - The teardown handler function
   *
   * @example
   * ApiClient.teardown((response) => {
   *   console.log('Response status:', response.status())
   * })
   */
  static teardown(handler: TeardownHandler) {
    this.#hooksHandlers.teardown.push(handler)
    return this
  }

  /**
   * Register a custom cookies serializer for processing request and response cookies.
   *
   * @param serailizer - The cookies serializer implementation
   *
   * @example
   * ApiClient.cookiesSerializer({
   *   prepare: (key, value) => encrypt(value),
   *   process: (key, value) => decrypt(value)
   * })
   */
  static cookiesSerializer(serailizer: CookiesSerializer) {
    this.#customCookiesSerializer = serailizer
    return this
  }

  /**
   * Set a route builder for type-safe routing with named routes.
   *
   * @param routerBuilder - The route builder function
   *
   * @example
   * ApiClient.setRouteBuilder((name, params) => {
   *   return routes.make(name, params)
   * })
   */
  static setRouteBuilder(routerBuilder: RouteBuilder) {
    this.#routerBuilder = routerBuilder
    return this
  }

  /**
   * Clear the configured route builder.
   */
  static clearRouteBuilder() {
    this.#routerBuilder = undefined
    return this
  }

  /**
   * Create a new HTTP request instance for the given endpoint and method.
   *
   * @param endpoint - The endpoint or URL path
   * @param method - The HTTP method
   *
   * @example
   * const request = client.request('/users', 'GET')
   */
  request(endpoint: string, method: string) {
    const hooks = (this.constructor as typeof ApiClient).#hooksHandlers
    const requestHandlers = (this.constructor as typeof ApiClient).#onRequestHandlers
    const cookiesSerializer = (this.constructor as typeof ApiClient).#customCookiesSerializer

    let baseUrl = this.#baseUrl
    const envHost = process.env.HOST
    const envPort = process.env.PORT

    /**
     * Compute baseUrl from the HOST and the PORT env variables
     * when no baseUrl is provided
     */
    if (!baseUrl && envHost && envPort) {
      baseUrl = `http://${envHost}:${envPort}`
    }

    const request = new ApiRequest(
      {
        baseUrl,
        method,
        endpoint,
        hooks,
        serializers: { cookie: cookiesSerializer },
      },
      this.#assert
    )

    requestHandlers.forEach((handler) => handler(request))
    return request
  }

  /**
   * Create a new GET request for the given endpoint.
   *
   * @param endpoint - The endpoint or URL path
   *
   * @example
   * const response = await client.get('/users').send()
   */
  get<P extends string>(endpoint: P): ApiRequest<never, InferResponse<P>, InferQuery<P>> {
    return this.request(endpoint, 'GET') as ApiRequest<never, InferResponse<P>, InferQuery<P>>
  }

  /**
   * Create a new POST request for the given endpoint.
   *
   * @param endpoint - The endpoint or URL path
   *
   * @example
   * const response = await client.post('/users').json({ name: 'John' }).send()
   */
  post<P extends string>(endpoint: P): ApiRequest<InferBody<P>, InferResponse<P>, InferQuery<P>> {
    return this.request(endpoint, 'POST') as ApiRequest<
      InferBody<P>,
      InferResponse<P>,
      InferQuery<P>
    >
  }

  /**
   * Create a new PUT request for the given endpoint.
   *
   * @param endpoint - The endpoint or URL path
   *
   * @example
   * const response = await client.put('/users/1').json({ name: 'John' }).send()
   */
  put<P extends string>(endpoint: P): ApiRequest<InferBody<P>, InferResponse<P>, InferQuery<P>> {
    return this.request(endpoint, 'PUT') as ApiRequest<
      InferBody<P>,
      InferResponse<P>,
      InferQuery<P>
    >
  }

  /**
   * Create a new PATCH request for the given endpoint.
   *
   * @param endpoint - The endpoint or URL path
   *
   * @example
   * const response = await client.patch('/users/1').json({ name: 'Jane' }).send()
   */
  patch<P extends string>(endpoint: P): ApiRequest<InferBody<P>, InferResponse<P>, InferQuery<P>> {
    return this.request(endpoint, 'PATCH') as ApiRequest<
      InferBody<P>,
      InferResponse<P>,
      InferQuery<P>
    >
  }

  /**
   * Create a new DELETE request for the given endpoint.
   *
   * @param endpoint - The endpoint or URL path
   *
   * @example
   * const response = await client.delete('/users/1').send()
   */
  delete<P extends string>(endpoint: P): ApiRequest<InferBody<P>, InferResponse<P>, InferQuery<P>> {
    return this.request(endpoint, 'DELETE') as ApiRequest<
      InferBody<P>,
      InferResponse<P>,
      InferQuery<P>
    >
  }

  /**
   * Create a new HEAD request for the given endpoint.
   *
   * @param endpoint - The endpoint or URL path
   *
   * @example
   * const response = await client.head('/users').send()
   */
  head<P extends string>(endpoint: P): ApiRequest<never, InferResponse<P>, InferQuery<P>> {
    return this.request(endpoint, 'HEAD') as ApiRequest<never, InferResponse<P>, InferQuery<P>>
  }

  /**
   * Create a new OPTIONS request for the given endpoint.
   *
   * @param endpoint - The endpoint or URL path
   *
   * @example
   * const response = await client.options('/users').send()
   */
  options<P extends string>(endpoint: P): ApiRequest<never, InferResponse<P>, InferQuery<P>> {
    return this.request(endpoint, 'OPTIONS') as ApiRequest<never, InferResponse<P>, InferQuery<P>>
  }

  /**
   * Create a type-safe request using a named route from the registry.
   * The route name must be registered via `ApiClient.setRouteBuilder()`.
   *
   * @param args - The route name and optional parameters
   *
   * @example
   * const response = await client.visit('users.show', { id: '1' }).send()
   */
  visit<Name extends keyof RoutesRegistry>(
    ...args: IsEmptyObject<InferRouteParams<Name>> extends true
      ? [name: Name]
      : [name: Name, params: InferRouteParams<Name>]
  ): ApiRequest<InferRouteBody<Name>, InferRouteResponse<Name>, InferRouteQuery<Name>> {
    const name = args[0]
    const params = (args[1] ?? {}) as Record<string, any>

    const routerBuilder = (this.constructor as typeof ApiClient).#routerBuilder
    if (!routerBuilder) {
      throw new Error(
        `Route builder not configured. Use ApiClient.setRouteBuilder() to configure a routes builder`
      )
    }

    const routeDef = routerBuilder(name, params)
    return this.request(routeDef.url, routeDef.method) as ApiRequest<
      InferRouteBody<Name>,
      InferRouteResponse<Name>,
      InferRouteQuery<Name>
    >
  }
}
