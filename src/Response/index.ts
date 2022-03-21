/*
 * @japa/api-client
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Response } from 'superagent'
import { Macroable } from 'macroable'
import setCookieParser from 'set-cookie-parser'
import { SuperAgentResponseFile, ClientConfig, ResponseCookies } from '../Contracts'
import {
  dumpResponse,
  dumpResponseBody,
  dumpResponseError,
  dumpResponseCookies,
  dumpResponseHeaders,
} from '../utils'

export class ApiResponse extends Macroable {
  public static macros = {}
  public static getters = {}

  private valuesDumped: Set<string> = new Set()

  /**
   * Parsed cookies
   */
  public cookiesJar: ResponseCookies = this.parseCookies()

  constructor(public response: Response, private clientConfig: ClientConfig) {
    super()
    this.processCookies()
  }

  /**
   * Parse response header to collect cookies
   */
  private parseCookies(): ResponseCookies {
    const cookieHeader = this.header('set-cookie')
    if (!cookieHeader) {
      return {}
    }

    return setCookieParser.parse(cookieHeader, { map: true })
  }

  /**
   * Process cookies using the serializer
   */
  private processCookies() {
    const cookiesSerializer = this.clientConfig.serializers?.cookie
    const processMethod = cookiesSerializer?.process

    if (!processMethod) {
      return
    }

    Object.keys(this.cookiesJar).forEach((key) => {
      const cookie = this.cookiesJar[key]
      const processedValue = processMethod(cookie.name, cookie.value, this)
      if (processedValue !== undefined) {
        cookie.value = processedValue
      }
    })
  }

  /**
   * Response content-type charset. Undefined if no charset
   * is mentioned.
   */
  public charset(): string | undefined {
    return this.response.charset
  }

  /**
   * Parsed files from the multipart response.
   */
  public files<Properties extends string>(): { [K in Properties]: SuperAgentResponseFile } {
    return this.response.files
  }

  /**
   * Returns an object of links by parsing the "Link" header.
   *
   * @example
   * Link: <https://one.example.com>; rel="preconnect", <https://two.example.com>; rel="preload"
   * response.links()
   * // {
   * //   preconnect: 'https://one.example.com',
     //   preload: 'https://two.example.com',
   * // }
   */
  public links(): Record<string, string> {
    return this.response.links
  }

  /**
   * Response status type
   */
  public statusType(): number {
    return this.response.statusType
  }

  /**
   * Request raw parsed text
   */
  public text(): string {
    return this.response.text
  }

  /**
   * Response body
   */
  public body(): any {
    return this.response.body
  }

  /**
   * Read value for a given response header
   */
  public header(key: string): string | undefined {
    return this.response.headers[key]
  }

  /**
   * Get all response headers
   */
  public headers(): Record<string, string> {
    return this.response.headers
  }

  /**
   * Get response status
   */
  public status(): number {
    return this.response.status
  }

  /**
   * Get response content-type
   */
  public type() {
    return this.response.type
  }

  /**
   * Get redirects URLs the request has followed before
   * getting the response
   */
  public redirects() {
    return this.response.redirects
  }

  /**
   * Find if the response has parsed body. The check is performed
   * by inspecting the response content-type and returns true
   * when content-type is either one of the following.
   *
   * - application/json
   * - application/x-www-form-urlencoded
   * - multipart/form-data
   *
   * Or when the response body is a buffer.
   */
  public hasBody(): boolean {
    return (
      this.type() === 'application/json' ||
      this.type() === 'application/x-www-form-urlencoded' ||
      this.type() === 'multipart/form-data' ||
      Buffer.isBuffer(this.response.body)
    )
  }

  /**
   * Find if the response body has files
   */
  public hasFiles(): boolean {
    return this.files() && Object.keys(this.files()).length > 0
  }

  /**
   * Find if response is an error
   */
  public hasError(): boolean {
    return this.error() ? true : false
  }

  /**
   * Find if response is an fatal error. Response with >=500
   * status code are concerned as fatal errors
   */
  public hasFatalError(): boolean {
    return this.status() >= 500
  }

  /**
   * Find if the request client failed to make the request
   */
  public hasClientError(): boolean {
    return this.response.clientError
  }

  /**
   * Find if the server responded with an error
   */
  public hasServerError(): boolean {
    return this.response.serverError
  }

  /**
   * Access to response error
   */
  public error() {
    return this.response.error
  }

  /**
   * Parsed response cookies
   */
  public cookies() {
    return this.cookiesJar
  }

  /**
   * Dump request headers
   */
  public dumpHeaders(): this {
    if (this.valuesDumped.has('headers')) {
      return this
    }

    this.valuesDumped.add('headers')
    dumpResponseHeaders(this)
    return this
  }

  /**
   * Dump request cookies
   */
  public dumpCookies(): this {
    if (this.valuesDumped.has('cookies')) {
      return this
    }

    this.valuesDumped.add('cookies')
    dumpResponseCookies(this)
    return this
  }

  /**
   * Dump request body
   */
  public dumpBody(): this {
    if (this.valuesDumped.has('body')) {
      return this
    }

    this.valuesDumped.add('body')
    dumpResponseBody(this)
    return this
  }

  /**
   * Dump request body
   */
  public dumpError(): this {
    if (this.valuesDumped.has('error')) {
      return this
    }

    this.valuesDumped.add('error')
    dumpResponseError(this)
    return this
  }

  /**
   * Dump request
   */
  public dump(): this {
    if (this.valuesDumped.has('response')) {
      return this
    }

    this.valuesDumped.add('response')
    dumpResponse(this)
    this.dumpCookies()
    this.dumpHeaders()
    this.dumpBody()
    this.dumpError()
    return this
  }
}
