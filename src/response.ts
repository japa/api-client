/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Assert } from '@japa/assert'
import Macroable from '@poppinss/macroable'
import setCookieParser from 'set-cookie-parser'
import { type HTTPError, Response } from 'superagent'

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
  error(): false | HTTPError {
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

  /**
   * Assert that response has an ok (200) status
   */
  assertOk() {
    this.assertStatus(200)
  }

  /**
   * Assert that response has a created (201) status
   */
  assertCreated() {
    this.assertStatus(201)
  }

  /**
   * Assert that response has an accepted (202) status
   */
  assertAccepted() {
    this.assertStatus(202)
  }

  /**
   * Assert that response has a no content (204) status
   */
  assertNoContent() {
    this.assertStatus(204)
  }

  /**
   * Assert that response has a moved permanently (301) status
   */
  assertMovedPermanently() {
    this.assertStatus(301)
  }

  /**
   * Assert that response has a found (302) status
   */
  assertFound() {
    this.assertStatus(302)
  }

  /**
   * Assert that response has a bad request (400) status
   */
  assertBadRequest() {
    this.assertStatus(400)
  }

  /**
   * Assert that response has an unauthorized (401) status
   */
  assertUnauthorized() {
    this.assertStatus(401)
  }

  /**
   * Assert that response has a payment required (402) status
   */
  assertPaymentRequired() {
    this.assertStatus(402)
  }

  /**
   * Assert that response has a forbidden (403) status
   */
  assertForbidden() {
    this.assertStatus(403)
  }

  /**
   * Assert that response has a not found (404) status
   */
  assertNotFound() {
    this.assertStatus(404)
  }

  /**
   * Assert that response has a method not allowed (405) status
   */
  assertMethodNotAllowed() {
    this.assertStatus(405)
  }

  /**
   * Assert that response has a not acceptable (406) status
   */
  assertNotAcceptable() {
    this.assertStatus(406)
  }

  /**
   * Assert that response has a request timeout (408) status
   */
  assertRequestTimeout() {
    this.assertStatus(408)
  }

  /**
   * Assert that response has a conflict (409) status
   */
  assertConflict() {
    this.assertStatus(409)
  }

  /**
   * Assert that response has a gone (410) status
   */
  assertGone() {
    this.assertStatus(410)
  }

  /**
   * Assert that response has a length required (411) status
   */
  assertLengthRequired() {
    this.assertStatus(411)
  }

  /**
   * Assert that response has a precondition failed (412) status
   */
  assertPreconditionFailed() {
    this.assertStatus(412)
  }

  /**
   * Assert that response has a payload too large (413) status
   */
  assertPayloadTooLarge() {
    this.assertStatus(413)
  }

  /**
   * Assert that response has a URI too long (414) status
   */
  assertURITooLong() {
    this.assertStatus(414)
  }

  /**
   * Assert that response has an unsupported media type (415) status
   */
  assertUnsupportedMediaType() {
    this.assertStatus(415)
  }

  /**
   * Assert that response has a range not satisfiable (416) status
   */
  assertRangeNotSatisfiable() {
    this.assertStatus(416)
  }

  /**
   * Assert that response has an im a teapot (418) status
   */
  assertImATeapot() {
    this.assertStatus(418)
  }

  /**
   * Assert that response has an unprocessable entity (422) status
   */
  assertUnprocessableEntity() {
    this.assertStatus(422)
  }

  /**
   * Assert that response has a locked (423) status
   */
  assertLocked() {
    this.assertStatus(423)
  }

  /**
   * Assert that response has a too many requests (429) status
   */
  assertTooManyRequests() {
    this.assertStatus(429)
  }
}
