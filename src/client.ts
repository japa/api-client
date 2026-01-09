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
  type UserRoutesRegistry,
  type InferRouteBody,
  type InferRouteQuery,
  type InferRouteResponse,
  type InferRouteParams,
  type IsEmptyObject,
  type RouteBuilder,
} from './types.js'

/**
 * ApiClient exposes the API to make HTTP requests in context of
 * testing.
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
   * Remove all globally registered setup hooks
   */
  static clearSetupHooks() {
    this.#hooksHandlers.setup = []
    return this
  }

  /**
   * Remove all globally registered teardown hooks
   */
  static clearTeardownHooks() {
    this.#hooksHandlers.teardown = []
    return this
  }

  /**
   * Clear on request handlers registered using "onRequest"
   * method
   */
  static clearRequestHandlers() {
    this.#onRequestHandlers = []
    return this
  }

  /**
   * Register a handler to be invoked everytime a new request
   * instance is created
   */
  static onRequest(handler: (request: ApiRequest) => void) {
    this.#onRequestHandlers.push(handler)
    return this
  }

  /**
   * Register setup hooks. Setup hooks are called before the request
   */
  static setup(handler: SetupHandler) {
    this.#hooksHandlers.setup.push(handler)
    return this
  }

  /**
   * Register teardown hooks. Teardown hooks are called before the request
   */
  static teardown(handler: TeardownHandler) {
    this.#hooksHandlers.teardown.push(handler)
    return this
  }

  /**
   * Register a custom cookies serializer
   */
  static cookiesSerializer(serailizer: CookiesSerializer) {
    this.#customCookiesSerializer = serailizer
    return this
  }

  static setRouteBuilder(routerBuilder: RouteBuilder) {
    this.#routerBuilder = routerBuilder
    return this
  }

  static clearRouteBuilder() {
    this.#routerBuilder = undefined
    return this
  }

  /**
   * Create an instance of the request
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
   * Create an instance of the request for GET method
   */
  get<P extends string>(endpoint: P): ApiRequest<never, InferResponse<P>, InferQuery<P>> {
    return this.request(endpoint, 'GET') as ApiRequest<never, InferResponse<P>, InferQuery<P>>
  }

  /**
   * Create an instance of the request for POST method
   */
  post<P extends string>(endpoint: P): ApiRequest<InferBody<P>, InferResponse<P>, InferQuery<P>> {
    return this.request(endpoint, 'POST') as ApiRequest<
      InferBody<P>,
      InferResponse<P>,
      InferQuery<P>
    >
  }

  /**
   * Create an instance of the request for PUT method
   */
  put<P extends string>(endpoint: P): ApiRequest<InferBody<P>, InferResponse<P>, InferQuery<P>> {
    return this.request(endpoint, 'PUT') as ApiRequest<
      InferBody<P>,
      InferResponse<P>,
      InferQuery<P>
    >
  }

  /**
   * Create an instance of the request for PATCH method
   */
  patch<P extends string>(endpoint: P): ApiRequest<InferBody<P>, InferResponse<P>, InferQuery<P>> {
    return this.request(endpoint, 'PATCH') as ApiRequest<
      InferBody<P>,
      InferResponse<P>,
      InferQuery<P>
    >
  }

  /**
   * Create an instance of the request for DELETE method
   */
  delete<P extends string>(endpoint: P): ApiRequest<InferBody<P>, InferResponse<P>, InferQuery<P>> {
    return this.request(endpoint, 'DELETE') as ApiRequest<
      InferBody<P>,
      InferResponse<P>,
      InferQuery<P>
    >
  }

  /**
   * Create an instance of the request for HEAD method
   */
  head<P extends string>(endpoint: P): ApiRequest<never, InferResponse<P>, InferQuery<P>> {
    return this.request(endpoint, 'HEAD') as ApiRequest<never, InferResponse<P>, InferQuery<P>>
  }

  /**
   * Create an instance of the request for OPTIONS method
   */
  options<P extends string>(endpoint: P): ApiRequest<never, InferResponse<P>, InferQuery<P>> {
    return this.request(endpoint, 'OPTIONS') as ApiRequest<never, InferResponse<P>, InferQuery<P>>
  }

  /**
   * Create a type-safe request using a named route from the registry.
   * The route name must be registered in both the runtime registry
   * (via ApiClient.setRoutes()) and the type registry (UserRoutesRegistry).
   */
  visit<Name extends keyof UserRoutesRegistry>(
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
