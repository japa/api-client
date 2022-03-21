/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { ApiRequest } from '../Request'
import { ClientConfig, SetupHandler, TeardownHandler } from '../Contracts'

/**
 * ApiClient exposes the API to make HTTP requests in context of
 * testing.
 */
export class ApiClient {
  private baseUrl?: string
  private clientConfig?: ClientConfig

  /**
   * Hooks handlers to pass onto the request
   */
  private hooksHandlers: {
    setup: SetupHandler[]
    teardown: TeardownHandler[]
  } = {
    setup: [],
    teardown: [],
  }

  constructor(config: ClientConfig & { baseUrl?: string }) {
    const { baseUrl, ...clientConfig } = config
    this.baseUrl = baseUrl
    this.clientConfig = clientConfig
  }

  /**
   * Register setup hooks. Setup hooks are called before the request
   */
  public setup(handler: SetupHandler): this {
    this.hooksHandlers.setup.push(handler)
    return this
  }

  /**
   * Register teardown hooks. Teardown hooks are called before the request
   */
  public teardown(handler: TeardownHandler): this {
    this.hooksHandlers.teardown.push(handler)
    return this
  }

  /**
   * Create an instance of the request
   */
  public request(endpoint: string, method: string) {
    return new ApiRequest(
      { baseUrl: this.baseUrl, method, endpoint },
      this.clientConfig || {},
      this.hooksHandlers
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