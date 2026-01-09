/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import Hooks from '@poppinss/hooks'
import { serialize } from 'cookie-es'
import type { Assert } from '@japa/assert'
import Macroable from '@poppinss/macroable'
import superagent, { type Response, type SuperAgentRequest } from 'superagent'

import { ApiResponse } from './response.js'
import { dumpRequest, dumpRequestBody, dumpRequestCookies, dumpRequestHeaders } from './utils.js'
import type {
  SetupHandler,
  RequestConfig,
  MultipartValue,
  RequestCookies,
  TeardownHandler,
  SuperAgentParser,
  SuperAgentSerializer,
  ApiRequestHooks,
} from './types.js'

const DUMP_CALLS = {
  request: dumpRequest,
  body: dumpRequestBody,
  cookies: dumpRequestCookies,
  headers: dumpRequestHeaders,
}

/**
 * ApiRequest represents an HTTP request in the context of API testing.
 * It extends Macroable to allow adding custom methods at runtime.
 * The class provides a fluent interface for building and sending HTTP requests.
 *
 * @example
 * const request = new ApiRequest({
 *   method: 'GET',
 *   endpoint: '/users',
 *   baseUrl: 'http://localhost:3000'
 * })
 * await request.send()
 */
export class ApiRequest<TBody = any, TResponse = any, TQuery = any> extends Macroable {
  /**
   * The serializer to use for serializing request query params
   */
  static qsSerializer: SuperAgentSerializer = (value) => value

  /**
   * Register a custom superagent parser. Parsers are used
   * to parse the incoming response based on content type.
   *
   * @param contentType - The content type to register the parser for
   * @param parser - The parser function to handle the response
   */
  static addParser = (contentType: string, parser: SuperAgentParser) => {
    superagent.parse[contentType] = parser
  }

  /**
   * Remove a custom superagent parser.
   *
   * @param contentType - The content type to remove the parser for
   */
  static removeParser = (contentType: string) => {
    delete superagent.parse[contentType]
  }

  /**
   * Register a custom superagent serializer. Serializers are used
   * to serialize the request body based on content type.
   *
   * @param contentType - The content type to register the serializer for
   * @param serializer - The serializer function to handle the request body
   */
  static addSerializer = (contentType: string, serializer: SuperAgentSerializer) => {
    superagent.serialize[contentType] = serializer
  }

  /**
   * Remove a custom superagent serializer.
   *
   * @param contentType - The content type to remove the serializer for
   */
  static removeSerializer = (contentType: string) => {
    delete superagent.serialize[contentType]
  }

  /**
   * Specify the serializer for query strings. Serializers are used to convert
   * request querystring values to a string.
   *
   * @param serializer - The serializer function to convert query params
   */
  static setQsSerializer = (serializer: SuperAgentSerializer) => {
    ApiRequest.qsSerializer = serializer
  }

  /**
   * Remove the custom query string serializer and restore the default.
   */
  static removeQsSerializer = () => {
    ApiRequest.qsSerializer = (value) => value
  }

  /**
   * Reference to registered hooks
   */
  hooks = new Hooks<ApiRequestHooks>()
  #setupRunner!: ReturnType<Hooks<ApiRequestHooks>['runner']>
  #teardownRunner!: ReturnType<Hooks<ApiRequestHooks>['runner']>

  /**
   * Reference to Assert module
   */
  #assert?: Assert

  /**
   * Dump calls
   */
  #valuesToDump: Set<'cookies' | 'body' | 'headers' | 'request'> = new Set()

  /**
   * The underlying super agent request
   */
  request: SuperAgentRequest

  /**
   * Cookies to be sent with the request
   */
  cookiesJar: RequestCookies = {}

  constructor(
    public config: RequestConfig,
    assert?: Assert
  ) {
    super()
    this.#assert = assert
    this.request = this.#createRequest()
    this.config.hooks?.setup.forEach((handler) => this.setup(handler))
    this.config.hooks?.teardown.forEach((handler) => this.teardown(handler))
  }

  /**
   * Set cookies header
   */
  #setCookiesHeader() {
    const prepareMethod = this.config.serializers?.cookie?.prepare

    const cookies = Object.keys(this.cookiesJar).map((key) => {
      let { name, value } = this.cookiesJar[key]
      if (prepareMethod) {
        value = prepareMethod(name, value, this)
      }
      return serialize(name, value)
    })

    if (!cookies.length) {
      return
    }

    this.header('Cookie', cookies)
  }

  /**
   * Instantiate hooks runner
   */
  #instantiateHooksRunners() {
    this.#setupRunner = this.hooks.runner('setup')
    this.#teardownRunner = this.hooks.runner('teardown')
  }

  /**
   * Run setup hooks
   */
  async #runSetupHooks() {
    try {
      await this.#setupRunner.run(this)
    } catch (error) {
      await this.#setupRunner.cleanup(error, this)
      throw error
    }
  }

  /**
   * Run teardown hooks
   */
  async #runTeardownHooks(response: ApiResponse) {
    try {
      await this.#teardownRunner.run(response)
    } catch (error) {
      await this.#teardownRunner.cleanup(error, response)
      throw error
    }

    await this.#teardownRunner.cleanup(null, response)
  }

  /**
   * Send HTTP request to the server. Errors except the client errors
   * are tured into a response object.
   */
  async #sendRequest(): Promise<ApiResponse<TResponse>> {
    let response: Response

    try {
      this.#setCookiesHeader()
      this.#dumpValues()
      response = await this.request.buffer(true)
    } catch (error) {
      this.request.abort()

      /**
       * Call cleanup hooks
       */
      if (!error.response) {
        await this.#setupRunner.cleanup(error, this)
        throw error
      }

      /**
       * For all HTTP errors (including 500+), return the error response
       * This allows proper handling of server errors via ApiResponse
       */
      response = error.response
    }

    await this.#setupRunner.cleanup(null, this)
    return new ApiResponse<TResponse>(this, response, this.config, this.#assert)
  }

  /**
   * Invoke calls calls
   */
  #dumpValues() {
    if (!this.#valuesToDump.size) {
      return
    }

    try {
      this.#valuesToDump.forEach((key) => {
        DUMP_CALLS[key](this)
      })
    } catch (error) {
      console.log(error)
    }
  }

  /**
   * Is endpoint a fully qualified URL or not
   */
  #isUrl(url: string) {
    return url.startsWith('http://') || url.startsWith('https://')
  }

  /**
   * Prepend baseUrl to the endpoint
   */
  #prependBaseUrl(url: string) {
    if (!this.config.baseUrl) {
      return url
    }

    return `${this.config.baseUrl}/${url.replace(/^\//, '')}`
  }

  /**
   * Creates the request instance for the given HTTP method
   */
  #createRequest() {
    let url = this.config.endpoint
    if (!this.#isUrl(url)) {
      url = this.#prependBaseUrl(url)
    }

    return superagent(this.config.method, url)
  }

  /**
   * Register a setup hook. Setup hooks are called before
   * making the request.
   *
   * @param handler - The setup handler function to register
   *
   * @example
   * request.setup((req) => {
   *   req.header('Authorization', 'Bearer token')
   * })
   */
  setup(handler: SetupHandler): this {
    this.hooks.add('setup', handler)
    return this
  }

  /**
   * Register a teardown hook. Teardown hooks are called after
   * making the request.
   *
   * @param handler - The teardown handler function to register
   *
   * @example
   * request.teardown((response) => {
   *   console.log('Request completed with status:', response.status())
   * })
   */
  teardown(handler: TeardownHandler): this {
    this.hooks.add('teardown', handler)
    return this
  }

  /**
   * Set cookie as a key-value pair to be sent to the server.
   *
   * @param key - The cookie name
   * @param value - The cookie value
   *
   * @example
   * request.cookie('session_id', 'abc123')
   */
  cookie(key: string, value: any): this {
    this.cookiesJar[key] = { name: key, value }
    return this
  }

  /**
   * Set cookies as an object to be sent to the server.
   *
   * @param cookies - An object containing cookie key-value pairs
   *
   * @example
   * request.cookies({
   *   session_id: 'abc123',
   *   user_token: 'xyz789'
   * })
   */
  cookies(cookies: Record<string, any>): this {
    Object.keys(cookies).forEach((key) => this.cookie(key, cookies[key]))
    return this
  }

  /**
   * Define request header as a key-value pair.
   *
   * @example
   * request.header('x-foo', 'bar')
   * request.header('x-foo', ['bar', 'baz'])
   */
  header(key: string, value: string | string[]) {
    this.headers({ [key]: value })
    return this
  }

  /**
   * Define request headers as an object.
   *
   * @example
   * request.headers({ 'x-foo': 'bar' })
   * request.headers({ 'x-foo': ['bar', 'baz'] })
   */
  headers(headers: Record<string, string | string[]>) {
    this.request.set(headers)
    return this
  }

  /**
   * Define the field value for a multipart request.
   *
   * @note: This method makes a multipart request. See [[this.form]] to
   * make HTML style form submissions.
   *
   * @param name - The field name
   * @param value - The field value(s)
   *
   * @example
   * request.field('name', 'virk')
   * request.field('age', 22)
   */
  field(name: string, value: MultipartValue | MultipartValue[]) {
    this.request.field(name, value)
    return this
  }

  /**
   * Define fields as an object for a multipart request.
   *
   * @note: This method makes a multipart request. See [[this.form]] to
   * make HTML style form submissions.
   *
   * @param values - An object containing field key-value pairs
   *
   * @example
   * request.fields({'name': 'virk', age: 22})
   */
  fields(values: { [name: string]: MultipartValue | MultipartValue[] }) {
    this.request.field(values)
    return this
  }

  /**
   * Upload file for a multipart request. Either you can pass path to a
   * file, a readable stream, or a buffer.
   *
   * @param name - The field name for the file
   * @param value - The file path, stream, or buffer
   * @param options - Optional filename or configuration object
   *
   * @example
   * request.file('avatar', 'absolute/path/to/file')
   * request.file('avatar', createReadStream('./path/to/file'))
   */
  file(
    name: string,
    value: MultipartValue,
    options?: string | { filename?: string | undefined; contentType?: string | undefined }
  ) {
    this.request.attach(name, value, options)
    return this
  }

  /**
   * Set form values. Calling this method will set the content type
   * to "application/x-www-form-urlencoded".
   *
   * @param values - The form data to send
   *
   * @example
   * request.form({
   *   email: 'virk@adonisjs.com',
   *   password: 'secret'
   * })
   */
  form(values: TBody) {
    this.type('form')
    this.request.send(values as string | object)
    return this
  }

  /**
   * Set form values without type checking.
   * Useful for testing invalid form data.
   *
   * @param values - The form data to send (untyped)
   */
  unsafeForm(values: string | object) {
    this.type('form')
    this.request.send(values)
    return this
  }

  /**
   * Set JSON body for the request. Calling this method will set
   * the content type to "application/json".
   *
   * @param values - The JSON data to send
   *
   * @example
   * request.json({
   *   email: 'virk@adonisjs.com',
   *   password: 'secret'
   * })
   */
  json(values: TBody) {
    this.type('json')
    this.request.send(values as string | object)
    return this
  }

  /**
   * Set JSON body for the request without type checking.
   * Useful for testing invalid JSON payloads.
   *
   * @param values - The JSON data to send (untyped)
   */
  unsafeJson(values: string | object) {
    this.type('json')
    this.request.send(values)
    return this
  }

  /**
   * Set querystring for the request.
   *
   * @param key - The query parameter key or an object of query parameters
   * @param value - The query parameter value (when key is a string)
   *
   * @example
   * request.qs('order_by', 'id')
   * request.qs({ order_by: 'id' })
   */
  qs(key: string, value: any): this
  qs(values: TQuery): this
  qs(key: string | TQuery, value?: any): this {
    if (!value) {
      this.request.query(typeof key === 'string' ? key : ApiRequest.qsSerializer(key as object))
    } else {
      this.request.query(ApiRequest.qsSerializer({ [key as string]: value }))
    }
    return this
  }

  /**
   * Set querystring for the request without type checking.
   * Useful for testing invalid query parameters.
   *
   * @param key - The query parameter key or an object of query parameters
   * @param value - The query parameter value (when key is a string)
   */
  unsafeQs(key: string, value: any): this
  unsafeQs(values: string | object): this
  unsafeQs(key: string | object, value?: any): this {
    if (!value) {
      this.request.query(typeof key === 'string' ? key : ApiRequest.qsSerializer(key))
    } else {
      this.request.query(ApiRequest.qsSerializer({ [key as string]: value }))
    }
    return this
  }

  /**
   * Set timeout for the request.
   *
   * @param ms - Timeout in milliseconds or object with response/deadline timeouts
   *
   * @example
   * request.timeout(5000)
   * request.timeout({ response: 5000, deadline: 60000 })
   */
  timeout(ms: number | { deadline?: number | undefined; response?: number | undefined }): this {
    this.request.timeout(ms)
    return this
  }

  /**
   * Set content-type for the request.
   *
   * @param value - The content type
   *
   * @example
   * request.type('json')
   */
  type(value: string): this {
    this.request.type(value)
    return this
  }

  /**
   * Set "accept" header in the request.
   *
   * @param type - The accept type
   *
   * @example
   * request.accept('json')
   */
  accept(type: string): this {
    this.request.accept(type)
    return this
  }

  /**
   * Follow redirects from the response.
   *
   * @param count - Maximum number of redirects to follow
   *
   * @example
   * request.redirects(3)
   */
  redirects(count: number): this {
    this.request.redirects(count)
    return this
  }

  /**
   * Set basic auth header from user and password.
   *
   * @param user - The username
   * @param password - The password
   *
   * @example
   * request.basicAuth('foo@bar.com', 'secret')
   */
  basicAuth(user: string, password: string): this {
    this.request.auth(user, password, { type: 'basic' })
    return this
  }

  /**
   * Pass auth bearer token as authorization header.
   *
   * @param token - The bearer token
   *
   * @example
   * request.bearerToken('tokenValue')
   */
  bearerToken(token: string): this {
    this.request.auth(token, { type: 'bearer' })
    return this
  }

  /**
   * Set the CA certificates to trust.
   *
   * @param certificate - The certificate(s) to trust
   */
  ca(certificate: string | string[] | Buffer | Buffer[]): this {
    this.request.ca(certificate)
    return this
  }

  /**
   * Set the client certificates.
   *
   * @param certificate - The client certificate(s)
   */
  cert(certificate: string | string[] | Buffer | Buffer[]): this {
    this.request.cert(certificate)
    return this
  }

  /**
   * Set the client private key(s).
   *
   * @param key - The private key(s)
   */
  privateKey(key: string | string[] | Buffer | Buffer[]): this {
    this.request.key(key)
    return this
  }

  /**
   * Set the client PFX or PKCS12 encoded private key and certificate chain.
   *
   * @param key - The PFX/PKCS12 key(s) or object with pfx and passphrase
   */
  pfx(
    key: string | string[] | Buffer | Buffer[] | { pfx: string | Buffer; passphrase: string }
  ): this {
    this.request.pfx(key)
    return this
  }

  /**
   * Does not reject expired or invalid TLS certs. Sets internally rejectUnauthorized=true.
   */
  disableTLSCerts(): this {
    this.request.disableTLSCerts()
    return this
  }

  /**
   * Trust broken HTTPs connections on localhost.
   *
   * @param trust - Whether to trust localhost connections (default: true)
   */
  trustLocalhost(trust = true): this {
    this.request.trustLocalhost(trust)
    return this
  }

  /**
   * Dump request headers to the console when the request is sent.
   */
  dumpHeaders(): this {
    this.#valuesToDump.add('headers')
    return this
  }

  /**
   * Dump request cookies to the console when the request is sent.
   */
  dumpCookies(): this {
    this.#valuesToDump.add('cookies')
    return this
  }

  /**
   * Dump request body to the console when the request is sent.
   */
  dumpBody(): this {
    this.#valuesToDump.add('body')
    return this
  }

  /**
   * Dump request details (headers, cookies, body) to the console when the request is sent.
   */
  dump(): this {
    this.#valuesToDump.add('request')
    this.dumpCookies()
    this.dumpHeaders()
    this.dumpBody()
    return this
  }

  /**
   * Retry a failing request. Along with the count, you can also define
   * a callback to decide how long the request should be retried.
   *
   * The max count is applied regardless of whether callback is defined
   * or not.
   *
   * The following response codes are considered failing:
   * - 408, 413, 429, 500, 502, 503, 504, 521, 522, 524
   *
   * The following error codes are considered failing:
   * - 'ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN'
   *
   * @param count - Maximum number of retry attempts
   * @param retryUntilCallback - Optional callback to determine if retry should continue
   *
   * @example
   * request.retry(3)
   * request.retry(5, (error, response) => response.status() >= 500)
   */
  retry(
    count: number,
    retryUntilCallback?: (error: any, response: ApiResponse<TResponse>) => boolean
  ): this {
    if (retryUntilCallback) {
      this.request.retry(count, (error, response) => {
        return retryUntilCallback(
          error,
          new ApiResponse<TResponse>(this, response, this.config, this.#assert)
        )
      })

      return this
    }

    this.request.retry(count)
    return this
  }

  /**
   * Make the API request and return the response.
   * This method executes all setup hooks, sends the request,
   * and runs all teardown hooks.
   *
   * @example
   * const response = await request.send()
   */
  async send(): Promise<ApiResponse<TResponse>> {
    /**
     * Step 1: Instantiate hooks runners
     */
    this.#instantiateHooksRunners()

    /**
     * Step 2: Run setup hooks
     */
    await this.#runSetupHooks()

    /**
     * Step 3: Make HTTP request
     */
    const response = await this.#sendRequest()

    /**
     * Step 4: Run teardown hooks
     */
    await this.#runTeardownHooks(response)

    return response
  }

  /**
   * Implementation of `then` for the promise API.
   * Allows ApiRequest to be used as a promise.
   *
   * @param resolve - The resolve callback
   * @param reject - The reject callback
   */
  then<TResult1 = ApiResponse<TResponse>, TResult2 = never>(
    resolve?:
      | ((value: ApiResponse<TResponse>) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.send().then(resolve, reject)
  }

  /**
   * Implementation of `catch` for the promise API.
   * Allows ApiRequest to be used as a promise.
   *
   * @param reject - The reject callback
   */
  catch<TResult = never>(
    reject?: ((reason: ApiResponse<TResponse>) => TResult | PromiseLike<TResult>) | undefined | null
  ): Promise<ApiResponse<TResponse> | TResult> {
    return this.send().catch(reject)
  }

  /**
   * Implementation of `finally` for the promise API.
   * Allows ApiRequest to be used as a promise.
   *
   * @param fullfilled - The callback to execute when the promise is settled
   */
  finally(fullfilled?: (() => void) | undefined | null): Promise<ApiResponse<TResponse>> {
    return this.send().finally(fullfilled)
  }

  /**
   * Required when Promises are extended
   */
  get [Symbol.toStringTag]() {
    return this.constructor.name
  }
}
