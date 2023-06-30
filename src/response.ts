/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Response } from 'superagent'
import Macroable from '@poppinss/macroable'
import { Assert } from '@japa/assert'
import setCookieParser from 'set-cookie-parser'

import { ApiRequest } from './request.js'
import { RequestConfig, ResponseCookie, ResponseCookies, SuperAgentResponseFile } from './types.js'
import {
  dumpResponse,
  dumpResponseBody,
  dumpResponseError,
  dumpResponseCookies,
  dumpResponseHeaders,
} from './utils.js'

export class ApiResponse extends Macroable {
  #valuesDumped: Set<string> = new Set()

  /**
   * Parsed cookies
   */
  cookiesJar: ResponseCookies

  constructor(
    public request: ApiRequest,
    public response: Response,
    protected config: RequestConfig,
    public assert?: Assert
  ) {
    super()
    this.cookiesJar = this.#parseCookies()
    this.#processCookies()
  }

  /**
   * Parse response header to collect cookies
   */
  #parseCookies(): ResponseCookies {
    const cookieHeader = this.header('set-cookie')
    if (!cookieHeader) {
      return {}
    }

    return setCookieParser.parse(cookieHeader, { map: true })
  }

  /**
   * Process cookies using the serializer
   */
  #processCookies() {
    const cookiesSerializer = this.config.serializers?.cookie
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
   * Ensure assert plugin is installed
   */
  ensureHasAssert() {
    if (!this.assert) {
      throw new Error(
        'Response assertions are not available. Make sure to install the @japa/assert plugin'
      )
    }
  }

  /**
   * Response content-type charset. Undefined if no charset
   * is mentioned.
   */
  charset(): string | undefined {
    return this.response.charset
  }

  /**
   * Parsed files from the multipart response.
   */
  files<Properties extends string>(): { [K in Properties]: SuperAgentResponseFile } {
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
  links(): Record<string, string> {
    return this.response.links
  }

  /**
   * Response status type
   */
  statusType(): number {
    return this.response.statusType
  }

  /**
   * Request raw parsed text
   */
  text(): string {
    return this.response.text
  }

  /**
   * Response body
   */
  body(): any {
    return this.response.body
  }

  /**
   * Read value for a given response header
   */
  header(key: string): string | undefined {
    return this.response.headers[key]
  }

  /**
   * Get all response headers
   */
  headers(): Record<string, string> {
    return this.response.headers
  }

  /**
   * Get response status
   */
  status(): number {
    return this.response.status
  }

  /**
   * Get response content-type
   */
  type() {
    return this.response.type
  }

  /**
   * Get redirects URLs the request has followed before
   * getting the response
   */
  redirects() {
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
  hasBody(): boolean {
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
  hasFiles(): boolean {
    return this.files() && Object.keys(this.files()).length > 0
  }

  /**
   * Find if response is an error
   */
  hasError(): boolean {
    return this.error() ? true : false
  }

  /**
   * Find if response is an fatal error. Response with >=500
   * status code are concerned as fatal errors
   */
  hasFatalError(): boolean {
    return this.status() >= 500
  }

  /**
   * Find if the request client failed to make the request
   */
  hasClientError(): boolean {
    return this.response.clientError
  }

  /**
   * Find if the server responded with an error
   */
  hasServerError(): boolean {
    return this.response.serverError
  }

  /**
   * Access to response error
   */
  error() {
    return this.response.error
  }

  /**
   * Get cookie by name
   */
  cookie(name: string): ResponseCookie | undefined {
    return this.cookiesJar[name]
  }

  /**
   * Parsed response cookies
   */
  cookies() {
    return this.cookiesJar
  }

  /**
   * Dump request headers
   */
  dumpHeaders(): this {
    if (this.#valuesDumped.has('headers')) {
      return this
    }

    this.#valuesDumped.add('headers')
    dumpResponseHeaders(this)
    return this
  }

  /**
   * Dump request cookies
   */
  dumpCookies(): this {
    if (this.#valuesDumped.has('cookies')) {
      return this
    }

    this.#valuesDumped.add('cookies')
    dumpResponseCookies(this)
    return this
  }

  /**
   * Dump request body
   */
  dumpBody(): this {
    if (this.#valuesDumped.has('body')) {
      return this
    }

    this.#valuesDumped.add('body')
    dumpResponseBody(this)
    return this
  }

  /**
   * Dump request body
   */
  dumpError(): this {
    if (this.#valuesDumped.has('error')) {
      return this
    }

    this.#valuesDumped.add('error')
    dumpResponseError(this)
    return this
  }

  /**
   * Dump request
   */
  dump(): this {
    if (this.#valuesDumped.has('response')) {
      return this
    }

    this.#valuesDumped.add('response')
    dumpResponse(this)
    this.dumpCookies()
    this.dumpHeaders()
    this.dumpBody()
    this.dumpError()
    return this
  }

  /**
   * Assert response status to match the expected status
   */
  assertStatus(expectedStatus: number) {
    this.ensureHasAssert()
    this.assert!.equal(this.status(), expectedStatus)
  }

  /**
   * Assert response body to match the expected body
   */
  assertBody(expectedBody: any) {
    this.ensureHasAssert()
    this.assert!.deepEqual(this.body(), expectedBody)
  }

  /**
   * Assert response body to match the subset from the
   * expected body
   */
  assertBodyContains(expectedBody: any) {
    this.ensureHasAssert()
    this.assert!.containsSubset(this.body(), expectedBody)
  }

  /**
   * Assert response body not to match the subset from the
   * expected body
   */
  assertBodyNotContains(expectedBody: any) {
    this.ensureHasAssert()
    this.assert!.notContainsSubset(this.body(), expectedBody)
  }

  /**
   * Assert response to contain a given cookie and optionally
   * has the expected value
   */
  assertCookie(name: string, value?: any) {
    this.ensureHasAssert()
    this.assert!.property(this.cookies(), name)

    if (value !== undefined) {
      this.assert!.deepEqual(this.cookie(name)!.value, value)
    }
  }

  /**
   * Assert response to not contain a given cookie
   */
  assertCookieMissing(name: string) {
    this.ensureHasAssert()
    this.assert!.notProperty(this.cookies(), name)
  }

  /**
   * Assert response to contain a given header and optionally
   * has the expected value
   */
  assertHeader(name: string, value?: any) {
    this.ensureHasAssert()
    this.assert!.property(this.headers(), name)

    if (value !== undefined) {
      this.assert!.deepEqual(this.header(name), value)
    }
  }

  /**
   * Assert response to not contain a given header
   */
  assertHeaderMissing(name: string) {
    this.ensureHasAssert()
    this.assert!.notProperty(this.headers(), name)
  }

  /**
   * Assert response text to include the expected value
   */
  assertTextIncludes(expectedSubset: string) {
    this.ensureHasAssert()
    this.assert!.include(this.text(), expectedSubset)
  }

  /**
   * Assert response body is valid as per the API spec.
   */
  assertAgainstApiSpec() {
    this.ensureHasAssert()
    this.assert!.isValidApiResponse(this.response)
  }

  /**
   * Assert there is a matching redirect
   */
  assertRedirectsTo(pathname: string) {
    this.ensureHasAssert()
    const redirects = this.redirects().map((url) => new URL(url).pathname)

    this.assert!.evaluate(
      redirects.find((one) => one === pathname),
      `Expected #{exp} to be one of #{act}`,
      {
        expected: [pathname],
        actual: redirects,
        operator: 'includes',
      }
    )
  }
}
