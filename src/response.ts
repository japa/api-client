/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference types="@japa/openapi-assertions" />

import { type Assert } from '@japa/assert'
import Macroable from '@poppinss/macroable'
import setCookieParser from 'set-cookie-parser'
import { type HTTPError, type Response } from 'superagent'

import { type ApiRequest } from './request.js'
import {
  type RequestConfig,
  type ResponseCookie,
  type ResponseCookies,
  type SuperAgentResponseFile,
} from './types.js'
import {
  dumpResponse,
  dumpResponseBody,
  dumpResponseError,
  dumpResponseCookies,
  dumpResponseHeaders,
} from './utils.js'

/**
 * ApiResponse represents an HTTP response in the context of API testing.
 * It extends Macroable to allow adding custom methods at runtime.
 * The class provides methods for accessing response data and making assertions.
 *
 * @example
 * const response = await request.send()
 * response.assertStatus(200)
 * console.log(response.body())
 */
export class ApiResponse<TResponse = any> extends Macroable {
  #valuesDumped: Set<string> = new Set()

  /**
   * Parsed cookies from the response
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
   * Ensure assert plugin is installed and configured
   */
  #ensureHasAssert() {
    if (!this.assert) {
      throw new Error(
        'Response assertions are not available. Make sure to install the @japa/assert plugin'
      )
    }
  }

  /**
   * Ensure OpenAPI assertions package is installed and
   * configured
   */
  #ensureHasOpenAPIAssertions() {
    this.#ensureHasAssert()
    if ('isValidApiResponse' in this.assert! === false) {
      throw new Error(
        'OpenAPI assertions are not available. Make sure to install the @japa/openapi-assertions plugin'
      )
    }
  }

  /**
   * Get the response content-type charset.
   *
   * @example
   * response.charset() // 'utf-8'
   */
  charset(): string | undefined {
    return this.response.charset
  }

  /**
   * Get parsed files from the multipart response.
   *
   * @example
   * const files = response.files()
   * console.log(files.avatar)
   */
  files<Properties extends string>(): { [K in Properties]: SuperAgentResponseFile } {
    return this.response.files
  }

  /**
   * Returns an object of links by parsing the "Link" header.
   *
   * @example
   * // Link: <https://one.example.com>; rel="preconnect", <https://two.example.com>; rel="preload"
   * response.links()
   * // {
   * //   preconnect: 'https://one.example.com',
   * //   preload: 'https://two.example.com',
   * // }
   */
  links(): Record<string, string> {
    return this.response.links
  }

  /**
   * Get the response status type (1xx, 2xx, 3xx, 4xx, 5xx).
   *
   * @example
   * response.statusType() // 2
   */
  statusType(): number {
    return this.response.statusType
  }

  /**
   * Get the response raw parsed text.
   *
   * @example
   * const text = response.text()
   */
  text(): string {
    return this.response.text
  }

  /**
   * Get the response body (parsed JSON, form data, or buffer).
   *
   * @example
   * const body = response.body()
   */
  body(): TResponse {
    return this.response.body
  }

  /**
   * Get the value for a given response header.
   *
   * @param key - The header name (case-insensitive)
   *
   * @example
   * const contentType = response.header('content-type')
   */
  header(key: string): string | undefined {
    key = key.toLowerCase()
    return this.response.headers[key]
  }

  /**
   * Get all response headers as an object.
   *
   * @example
   * const headers = response.headers()
   */
  headers(): Record<string, string> {
    return this.response.headers
  }

  /**
   * Get the response HTTP status code.
   *
   * @example
   * response.status() // 200
   */
  status(): number {
    return this.response.status
  }

  /**
   * Get the response content-type.
   *
   * @example
   * response.type() // 'application/json'
   */
  type() {
    return this.response.type
  }

  /**
   * Get redirect URLs the request has followed before
   * receiving the response.
   *
   * @example
   * const redirects = response.redirects()
   */
  redirects() {
    return this.response.redirects
  }

  /**
   * Check if the response has a parsed body. Returns true when
   * content-type is one of: application/json, application/x-www-form-urlencoded,
   * multipart/form-data, or when the response body is a buffer.
   *
   * @example
   * if (response.hasBody()) {
   *   console.log(response.body())
   * }
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
   * Check if the response body contains files.
   *
   * @example
   * if (response.hasFiles()) {
   *   console.log(response.files())
   * }
   */
  hasFiles(): boolean {
    return this.files() && Object.keys(this.files()).length > 0
  }

  /**
   * Check if the response is an error.
   *
   * @example
   * if (response.hasError()) {
   *   console.error(response.error())
   * }
   */
  hasError(): boolean {
    return this.error() ? true : false
  }

  /**
   * Check if the response is a fatal error (status >= 500).
   *
   * @example
   * if (response.hasFatalError()) {
   *   console.error('Server error')
   * }
   */
  hasFatalError(): boolean {
    return this.status() >= 500
  }

  /**
   * Check if the request client failed to make the request.
   *
   * @example
   * if (response.hasClientError()) {
   *   console.error('Client error')
   * }
   */
  hasClientError(): boolean {
    return this.response.clientError
  }

  /**
   * Check if the server responded with an error.
   *
   * @example
   * if (response.hasServerError()) {
   *   console.error('Server error')
   * }
   */
  hasServerError(): boolean {
    return this.response.serverError
  }

  /**
   * Get the response error object, or false if no error.
   *
   * @example
   * const error = response.error()
   */
  error(): false | HTTPError {
    return this.response.error
  }

  /**
   * Get a cookie by name from the response.
   *
   * @param name - The cookie name
   *
   * @example
   * const sessionCookie = response.cookie('session_id')
   */
  cookie(name: string): ResponseCookie | undefined {
    return this.cookiesJar[name]
  }

  /**
   * Get all parsed response cookies.
   *
   * @example
   * const cookies = response.cookies()
   */
  cookies() {
    return this.cookiesJar
  }

  /**
   * Dump response headers to the console.
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
   * Dump response cookies to the console.
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
   * Dump response body to the console.
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
   * Dump response error to the console.
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
   * Dump response details (status, headers, cookies, body, errors) to the console.
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
   * Assert response status to match the expected status.
   *
   * @param expectedStatus - The expected HTTP status code
   *
   * @example
   * response.assertStatus(200)
   */
  assertStatus(expectedStatus: number) {
    this.#ensureHasAssert()
    this.assert!.equal(this.status(), expectedStatus)
  }

  /**
   * Assert response body to match the expected body.
   *
   * @param expectedBody - The expected response body
   *
   * @example
   * response.assertBody({ id: 1, name: 'John' })
   */
  assertBody(expectedBody: TResponse) {
    this.#ensureHasAssert()
    this.assert!.deepEqual(this.body(), expectedBody)
  }

  /**
   * Assert response body contains a subset of the expected body.
   *
   * @param expectedBody - The expected body subset
   *
   * @example
   * response.assertBodyContains({ name: 'John' })
   */
  assertBodyContains(expectedBody: any) {
    this.#ensureHasAssert()
    this.assert!.containsSubset(this.body(), expectedBody)
  }

  /**
   * Assert response body does not contain a subset of the expected body.
   *
   * @param expectedBody - The body subset that should not be present
   *
   * @example
   * response.assertBodyNotContains({ password: 'secret' })
   */
  assertBodyNotContains(expectedBody: any) {
    this.#ensureHasAssert()
    this.assert!.notContainsSubset(this.body(), expectedBody)
  }

  /**
   * Assert response contains a given cookie and optionally
   * has the expected value.
   *
   * @param name - The cookie name
   * @param value - Optional expected cookie value
   *
   * @example
   * response.assertCookie('session_id')
   * response.assertCookie('session_id', 'abc123')
   */
  assertCookie(name: string, value?: any) {
    this.#ensureHasAssert()
    this.assert!.property(this.cookies(), name)

    if (value !== undefined) {
      this.assert!.deepEqual(this.cookie(name)!.value, value)
    }
  }

  /**
   * Assert response does not contain a given cookie.
   *
   * @param name - The cookie name
   *
   * @example
   * response.assertCookieMissing('old_session')
   */
  assertCookieMissing(name: string) {
    this.#ensureHasAssert()
    this.assert!.notProperty(this.cookies(), name)
  }

  /**
   * Assert response contains a given header and optionally
   * has the expected value.
   *
   * @param name - The header name
   * @param value - Optional expected header value
   *
   * @example
   * response.assertHeader('content-type')
   * response.assertHeader('content-type', 'application/json')
   */
  assertHeader(name: string, value?: any) {
    name = name.toLowerCase()
    this.#ensureHasAssert()
    this.assert!.property(this.headers(), name)

    if (value !== undefined) {
      this.assert!.deepEqual(this.header(name), value)
    }
  }

  /**
   * Assert response does not contain a given header.
   *
   * @param name - The header name
   *
   * @example
   * response.assertHeaderMissing('x-deprecated-header')
   */
  assertHeaderMissing(name: string) {
    name = name.toLowerCase()
    this.#ensureHasAssert()
    this.assert!.notProperty(this.headers(), name)
  }

  /**
   * Assert response text includes the expected substring.
   *
   * @param expectedSubset - The expected substring
   *
   * @example
   * response.assertTextIncludes('Welcome')
   */
  assertTextIncludes(expectedSubset: string) {
    this.#ensureHasAssert()
    this.assert!.include(this.text(), expectedSubset)
  }

  /**
   * Assert response body is valid as per the OpenAPI spec.
   * Requires @japa/openapi-assertions plugin.
   *
   * @example
   * response.assertAgainstApiSpec()
   */
  assertAgainstApiSpec() {
    this.#ensureHasOpenAPIAssertions()
    this.assert!.isValidApiResponse(this.response)
  }

  /**
   * Assert the response redirected to a given pathname.
   *
   * @param pathname - The expected redirect pathname
   *
   * @example
   * response.assertRedirectsTo('/dashboard')
   */
  assertRedirectsTo(pathname: string) {
    this.#ensureHasAssert()
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
   * Assert that response has an ok (200) status.
   *
   * @example
   * response.assertOk()
   */
  assertOk() {
    this.assertStatus(200)
  }

  /**
   * Assert that response has a created (201) status.
   *
   * @example
   * response.assertCreated()
   */
  assertCreated() {
    this.assertStatus(201)
  }

  /**
   * Assert that response has an accepted (202) status.
   *
   * @example
   * response.assertAccepted()
   */
  assertAccepted() {
    this.assertStatus(202)
  }

  /**
   * Assert that response has a no content (204) status.
   *
   * @example
   * response.assertNoContent()
   */
  assertNoContent() {
    this.assertStatus(204)
  }

  /**
   * Assert that response has a moved permanently (301) status.
   *
   * @example
   * response.assertMovedPermanently()
   */
  assertMovedPermanently() {
    this.assertStatus(301)
  }

  /**
   * Assert that response has a found (302) status.
   *
   * @example
   * response.assertFound()
   */
  assertFound() {
    this.assertStatus(302)
  }

  /**
   * Assert that response has a bad request (400) status.
   *
   * @example
   * response.assertBadRequest()
   */
  assertBadRequest() {
    this.assertStatus(400)
  }

  /**
   * Assert that response has an unauthorized (401) status.
   *
   * @example
   * response.assertUnauthorized()
   */
  assertUnauthorized() {
    this.assertStatus(401)
  }

  /**
   * Assert that response has a payment required (402) status.
   *
   * @example
   * response.assertPaymentRequired()
   */
  assertPaymentRequired() {
    this.assertStatus(402)
  }

  /**
   * Assert that response has a forbidden (403) status.
   *
   * @example
   * response.assertForbidden()
   */
  assertForbidden() {
    this.assertStatus(403)
  }

  /**
   * Assert that response has a not found (404) status.
   *
   * @example
   * response.assertNotFound()
   */
  assertNotFound() {
    this.assertStatus(404)
  }

  /**
   * Assert that response has a method not allowed (405) status.
   *
   * @example
   * response.assertMethodNotAllowed()
   */
  assertMethodNotAllowed() {
    this.assertStatus(405)
  }

  /**
   * Assert that response has a not acceptable (406) status.
   *
   * @example
   * response.assertNotAcceptable()
   */
  assertNotAcceptable() {
    this.assertStatus(406)
  }

  /**
   * Assert that response has a request timeout (408) status.
   *
   * @example
   * response.assertRequestTimeout()
   */
  assertRequestTimeout() {
    this.assertStatus(408)
  }

  /**
   * Assert that response has a conflict (409) status.
   *
   * @example
   * response.assertConflict()
   */
  assertConflict() {
    this.assertStatus(409)
  }

  /**
   * Assert that response has a gone (410) status.
   *
   * @example
   * response.assertGone()
   */
  assertGone() {
    this.assertStatus(410)
  }

  /**
   * Assert that response has a length required (411) status.
   *
   * @example
   * response.assertLengthRequired()
   */
  assertLengthRequired() {
    this.assertStatus(411)
  }

  /**
   * Assert that response has a precondition failed (412) status.
   *
   * @example
   * response.assertPreconditionFailed()
   */
  assertPreconditionFailed() {
    this.assertStatus(412)
  }

  /**
   * Assert that response has a payload too large (413) status.
   *
   * @example
   * response.assertPayloadTooLarge()
   */
  assertPayloadTooLarge() {
    this.assertStatus(413)
  }

  /**
   * Assert that response has a URI too long (414) status.
   *
   * @example
   * response.assertURITooLong()
   */
  assertURITooLong() {
    this.assertStatus(414)
  }

  /**
   * Assert that response has an unsupported media type (415) status.
   *
   * @example
   * response.assertUnsupportedMediaType()
   */
  assertUnsupportedMediaType() {
    this.assertStatus(415)
  }

  /**
   * Assert that response has a range not satisfiable (416) status.
   *
   * @example
   * response.assertRangeNotSatisfiable()
   */
  assertRangeNotSatisfiable() {
    this.assertStatus(416)
  }

  /**
   * Assert that response has an im a teapot (418) status.
   *
   * @example
   * response.assertImATeapot()
   */
  assertImATeapot() {
    this.assertStatus(418)
  }

  /**
   * Assert that response has an unprocessable entity (422) status.
   *
   * @example
   * response.assertUnprocessableEntity()
   */
  assertUnprocessableEntity() {
    this.assertStatus(422)
  }

  /**
   * Assert that response has a locked (423) status.
   *
   * @example
   * response.assertLocked()
   */
  assertLocked() {
    this.assertStatus(423)
  }

  /**
   * Assert that response has a too many requests (429) status.
   *
   * @example
   * response.assertTooManyRequests()
   */
  assertTooManyRequests() {
    this.assertStatus(429)
  }
}
