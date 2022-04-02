/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Macroable } from 'macroable'
import { ApiRequest } from '../Request'
import type { Assert } from '@japa/assert'
import { SetupHandler, TeardownHandler, CookiesSerializer } from '../Contracts'

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
    const cookiesSerializer = (this.constructor as typeof ApiClient).customCookiesSerializer

    return new ApiRequest(
      {
        baseUrl: this.baseUrl,
        method,
        endpoint,
        hooks,
        serializers: { cookie: cookiesSerializer },
      },
      this.assert
    )
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
