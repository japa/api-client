/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Macroable } from 'macroable'
import type { Assert } from '@japa/assert'

import { ApiRequest } from './request'
import { SetupHandler, TeardownHandler, CookiesSerializer } from './types'

/**
 * ApiClient exposes the API to make HTTP requests in context of
 * testing.
 */
export class ApiClient extends Macroable {
  /**
   * Properties required by the Macroable class
   */
  public static macros = {}
  public static getters = {}

  /**
   * Invoked when a new instance of request is created
   */
  private static onRequestHandlers: ((request: ApiRequest) => void)[] = []

  /**
   * Hooks handlers to pass onto the request
   */
  private static hooksHandlers: {
    setup: SetupHandler[]
    teardown: TeardownHandler[]
  } = {
    setup: [],
    teardown: [],
  }

  private static customCookiesSerializer?: CookiesSerializer

  constructor(private baseUrl?: string, private assert?: Assert) {
    super()
  }

  /**
   * Remove all globally registered setup hooks
   */
  public static clearSetupHooks() {
    this.hooksHandlers.setup = []
    return this
  }

  /**
   * Remove all globally registered teardown hooks
   */
  public static clearTeardownHooks() {
    this.hooksHandlers.teardown = []
    return this
  }

  /**
   * Clear on request handlers registered using "onRequest"
   * method
   */
  public static clearRequestHandlers() {
    this.onRequestHandlers = []
    return this
  }

  /**
   * Register a handler to be invoked everytime a new request
   * instance is created
   */
  public static onRequest(handler: (request: ApiRequest) => void) {
    this.onRequestHandlers.push(handler)
    return this
  }

  /**
   * Register setup hooks. Setup hooks are called before the request
   */
  public static setup(handler: SetupHandler) {
    this.hooksHandlers.setup.push(handler)
    return this
  }

  /**
   * Register teardown hooks. Teardown hooks are called before the request
   */
  public static teardown(handler: TeardownHandler) {
    this.hooksHandlers.teardown.push(handler)
    return this
  }

  /**
   * Register a custom cookies serializer
   */
  public static cookiesSerializer(serailizer: CookiesSerializer) {
    this.customCookiesSerializer = serailizer
    return this
  }

  /**
   * Create an instance of the request
   */
  public request(endpoint: string, method: string) {
    const hooks = (this.constructor as typeof ApiClient).hooksHandlers
    const requestHandlers = (this.constructor as typeof ApiClient).onRequestHandlers
    const cookiesSerializer = (this.constructor as typeof ApiClient).customCookiesSerializer

    let baseUrl = this.baseUrl
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
      this.assert
    )

    requestHandlers.forEach((handler) => handler(request))
    return request
  }

  /**
   * Create an instance of the request for GET method
   */
  public get(endpoint: string) {
    return this.request(endpoint, 'GET')
  }

  /**
   * Create an instance of the request for POST method
   */
  public post(endpoint: string) {
    return this.request(endpoint, 'POST')
  }

  /**
   * Create an instance of the request for PUT method
   */
  public put(endpoint: string) {
    return this.request(endpoint, 'PUT')
  }

  /**
   * Create an instance of the request for PATCH method
   */
  public patch(endpoint: string) {
    return this.request(endpoint, 'PATCH')
  }

  /**
   * Create an instance of the request for DELETE method
   */
  public delete(endpoint: string) {
    return this.request(endpoint, 'DELETE')
  }

  /**
   * Create an instance of the request for HEAD method
   */
  public head(endpoint: string) {
    return this.request(endpoint, 'HEAD')
  }

  /**
   * Create an instance of the request for OPTIONS method
   */
  public options(endpoint: string) {
    return this.request(endpoint, 'OPTIONS')
  }
}
