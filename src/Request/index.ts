/*
 * @japa/api-client
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import {
  SetupHandler,
  RequestConfig,
  MultipartValue,
  RequestCookies,
  TeardownHandler,
  SuperAgentParser,
  SuperAgentSerializer,
} from '../Contracts'
import cookie from 'cookie'
import { Macroable } from 'macroable'
import { Hooks } from '@poppinss/hooks'
import type { Assert } from '@japa/assert'
import { ApiResponse } from '../Response'
import superagent, { Response } from 'superagent'
import {
  dumpRequest,
  dumpRequestBody,
  dumpRequestCookies,
  dumpRequestHeaders,
  stackToError,
} from '../utils'

const DUMP_CALLS = {
  request: dumpRequest,
  body: dumpRequestBody,
  cookies: dumpRequestCookies,
  headers: dumpRequestHeaders,
}

export class ApiRequest extends Macroable {
  /**
   * Properties required by the Macroable class
   */
  public static macros = {}
  public static getters = {}

  /**
   * Register/remove custom superagent parser
   */
  public static addParser = (contentType: string, parser: SuperAgentParser) => {
    superagent.parse[contentType] = parser
  }
  public static removeParser = (contentType: string) => {
    delete superagent.parse[contentType]
  }

  /**
   * Register/remove custom superagent serializers
   */
  public static addSerializer = (contentType: string, serializer: SuperAgentSerializer) => {
    superagent.serialize[contentType] = serializer
  }
  public static removeSerializer = (contentType: string) => {
    delete superagent.serialize[contentType]
  }

  /**
   * Reference to registered hooks
   */
  public hooks = new Hooks()
  private setupRunner: ReturnType<Hooks['runner']>
  private teardownRunner: ReturnType<Hooks['runner']>

  /**
   * Dump calls
   */
  private valuesToDump: Set<'cookies' | 'body' | 'headers' | 'request'> = new Set()

  /**
   * The underlying super agent request
   */
  public request = this.createRequest()

  /**
   * Cookies to be sent with the request
   */
  public cookiesJar: RequestCookies = {}

  constructor(public config: RequestConfig, private assert?: Assert) {
    super()
    this.config.hooks?.setup.forEach((handler) => this.setup(handler))
    this.config.hooks?.teardown.forEach((handler) => this.teardown(handler))
  }

  /**
   * Set cookies header
   */
  private setCookiesHeader() {
    const prepareMethod = this.config.serializers?.cookie?.prepare

    const cookies = Object.keys(this.cookiesJar).map((key) => {
      let { name, value } = this.cookiesJar[key]
      if (prepareMethod) {
        value = prepareMethod(name, value, this)
      }
      return cookie.serialize(name, value)
    })

    if (!cookies.length) {
      return
    }

    this.header('Cookie', cookies)
  }

  /**
   * Instantiate hooks runner
   */
  private instantiateHooksRunners() {
    this.setupRunner = this.hooks.runner('setup')
    this.teardownRunner = this.hooks.runner('teardown')
  }

  /**
   * Run setup hooks
   */
  private async runSetupHooks() {
    try {
      await this.setupRunner.run(this)
    } catch (error) {
      await this.setupRunner.cleanup(error, this)
      throw error
    }
  }

  /**
   * Run teardown hooks
   */
  private async runTeardownHooks(response: ApiResponse) {
    try {
      await this.teardownRunner.run(response)
    } catch (error) {
      await this.teardownRunner.cleanup(error, response)
      throw error
    }

    await this.teardownRunner.cleanup(null, response)
  }

  /**
   * Send HTTP request to the server. Errors except the client errors
   * are tured into a response object.
   */
  private async sendRequest() {
    let response: Response

    try {
      this.setCookiesHeader()
      this.dumpValues()
      response = await this.request.buffer(true)
    } catch (error) {
      this.request.abort()

      /**
       * Call cleanup hooks
       */
      if (!error.response) {
        await this.setupRunner.cleanup(error, this)
        throw error
      }

      /**
       * Raise exception when received 500 status code from the server
       */
      if (error.response.status >= 500) {
        await this.setupRunner.cleanup(error, this)
        throw stackToError(error.response.text)
      }

      response = error.response
    }

    await this.setupRunner.cleanup(null, this)
    return new ApiResponse(this, response, this.config, this.assert)
  }

  /**
   * Invoke calls calls
   */
  private dumpValues() {
    if (!this.valuesToDump.size) {
      return
    }

    try {
      this.valuesToDump.forEach((key) => {
        DUMP_CALLS[key](this)
      })
    } catch (error) {
      console.log(error)
    }
  }

  /**
   * Is endpoint a fully qualified URL or not
   */
  private isUrl(url: string) {
    return url.startsWith('http://') || url.startsWith('https://')
  }

  /**
   * Prepend baseUrl to the endpoint
   */
  private prependBaseUrl(url: string) {
    if (!this.config.baseUrl) {
      return url
    }

    return `${this.config.baseUrl}/${url.replace(/^\//, '')}`
  }

  /**
   * Creates the request instance for the given HTTP method
   */
  private createRequest() {
    let url = this.config.endpoint
    if (!this.isUrl(url)) {
      url = this.prependBaseUrl(url)
    }

    return superagent(this.config.method, url)
  }

  /**
   * Register a setup hook. Setup hooks are called before
   * making the request
   */
  public setup(handler: SetupHandler): this {
    this.hooks.add('setup', handler)
    return this
  }

  /**
   * Register a teardown hook. Teardown hooks are called after
   * making the request
   */
  public teardown(handler: TeardownHandler): this {
    this.hooks.add('teardown', handler)
    return this
  }

  /**
   * Set cookie as a key-value pair to be sent to the server
   */
  public cookie(key: string, value: any): this {
    this.cookiesJar[key] = { name: key, value }
    return this
  }

  /**
   * Set cookies as an object to be sent to the server
   */
  public cookies(cookies: Record<string, any>): this {
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
  public header(key: string, value: string | string[]) {
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
  public headers(headers: Record<string, string | string[]>) {
    this.request.set(headers)
    return this
  }

  /**
   * Define the field value for a multipart request.
   *
   * @note: This method makes a multipart request. See [[this.form]] to
   * make HTML style form submissions.
   *
   * @example
   * request.field('name', 'virk')
   * request.field('age', 22)
   */
  public field(name: string, value: MultipartValue | MultipartValue[]) {
    this.request.field(name, value)
    return this
  }

  /**
   * Define fields as an object for a multipart request
   *
   * @note: This method makes a multipart request. See [[this.form]] to
   * make HTML style form submissions.
   *
   * @example
   * request.fields({'name': 'virk', age: 22})
   */
  public fields(values: { [name: string]: MultipartValue | MultipartValue[] }) {
    this.request.field(values)
    return this
  }

  /**
   * Upload file for a multipart request. Either you can pass path to a
   * file, a readable stream, or a buffer
   *
   * @example
   * request.file('avatar', 'absolute/path/to/file')
   * request.file('avatar', createReadStream('./path/to/file'))
   */
  public file(
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
   * @example
   * request.form({
   *   email: 'virk@adonisjs.com',
   *   password: 'secret'
   * })
   */
  public form(values: string | object) {
    this.type('form')
    this.request.send(values)
    return this
  }

  /**
   * Set JSON body for the request. Calling this method will set
   * the content type to "application/json".
   *
   * @example
   * request.json({
   *   email: 'virk@adonisjs.com',
   *   password: 'secret'
   * })
   */
  public json(values: string | object) {
    this.type('json')
    this.request.send(values)
    return this
  }

  /**
   * Set querystring for the request.
   *
   * @example
   * request.qs('order_by', 'id')
   * request.qs({ order_by: 'id' })
   */
  public qs(key: string, value: any): this
  public qs(values: string | object): this
  public qs(key: string | object, value?: any): this {
    if (!value) {
      this.request.query(key)
    } else {
      this.request.query({ [key as string]: value })
    }
    return this
  }

  /**
   * Set timeout for the request.
   *
   * @example
   * request.timeout(5000)
   * request.timeout({ response: 5000, deadline: 60000 })
   */
  public timeout(
    ms: number | { deadline?: number | undefined; response?: number | undefined }
  ): this {
    this.request.timeout(ms)
    return this
  }

  /**
   * Set content-type for the request
   *
   * @example
   * request.type('json')
   */
  public type(value: string): this {
    this.request.type(value)
    return this
  }

  /**
   * Set "accept" header in the request
   *
   * @example
   * request.accept('json')
   */
  public accept(type: string): this {
    this.request.accept(type)
    return this
  }

  /**
   * Follow redirects from the response
   *
   * @example
   * request.redirects(3)
   */
  public redirects(count: number): this {
    this.request.redirects(count)
    return this
  }

  /**
   * Set basic auth header from user and password
   *
   * @example
   * request.basicAuth('foo@bar.com', 'secret')
   */
  public basicAuth(user: string, password: string): this {
    this.request.auth(user, password, { type: 'basic' })
    return this
  }

  /**
   * Pass auth bearer token as authorization header.
   *
   * @example
   * request.apiToken('tokenValue')
   */
  public bearerToken(token: string): this {
    this.request.auth(token, { type: 'bearer' })
    return this
  }

  /**
   * Set the ca certificates to trust
   */
  public ca(certificate: string | string[] | Buffer | Buffer[]): this {
    this.request.ca(certificate)
    return this
  }

  /**
   * Set the client certificates
   */
  public cert(certificate: string | string[] | Buffer | Buffer[]): this {
    this.request.cert(certificate)
    return this
  }

  /**
   * Set the client private key(s)
   */
  public privateKey(key: string | string[] | Buffer | Buffer[]): this {
    this.request.key(key)
    return this
  }

  /**
   * Set the client PFX or PKCS12 encoded private key and certificate chain
   */
  public pfx(
    key: string | string[] | Buffer | Buffer[] | { pfx: string | Buffer; passphrase: string }
  ): this {
    this.request.pfx(key)
    return this
  }

  /**
   * Does not reject expired or invalid TLS certs. Sets internally rejectUnauthorized=true
   */
  public disableTLSCerts(): this {
    this.request.disableTLSCerts()
    return this
  }

  /**
   * Trust broken HTTPs connections on localhost
   */
  public trustLocalhost(trust = true): this {
    this.request.trustLocalhost(trust)
    return this
  }

  /**
   * Dump request headers
   */
  public dumpHeaders(): this {
    this.valuesToDump.add('headers')
    return this
  }

  /**
   * Dump request cookies
   */
  public dumpCookies(): this {
    this.valuesToDump.add('cookies')
    return this
  }

  /**
   * Dump request body
   */
  public dumpBody(): this {
    this.valuesToDump.add('body')
    return this
  }

  /**
   * Dump request
   */
  public dump(): this {
    this.valuesToDump.add('request')
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
   * or not
   *
   * The following response codes are considered failing.
   * - 408
   * - 413
   * - 429
   * - 500
   * - 502
   * - 503
   * - 504
   * - 521
   * - 522
   * - 524
   *
   * The following error codes are considered failing.
   * - 'ETIMEDOUT'
   * - 'ECONNRESET'
   * - 'EADDRINUSE'
   * - 'ECONNREFUSED'
   * - 'EPIPE'
   * - 'ENOTFOUND'
   * - 'ENETUNREACH'
   * - 'EAI_AGAIN'
   */
  public retry(
    count: number,
    retryUntilCallback?: (error: any, response: ApiResponse) => boolean
  ): this {
    if (retryUntilCallback) {
      this.request.retry(count, (error, response) => {
        return retryUntilCallback(error, new ApiResponse(this, response, this.config, this.assert))
      })

      return this
    }

    this.request.retry(count)
    return this
  }

  /**
   * Make the API request
   */
  public async send() {
    /**
     * Step 1: Instantiate hooks runners
     */
    this.instantiateHooksRunners()

    /**
     * Step 2: Run setup hooks
     */
    await this.runSetupHooks()

    /**
     * Step 3: Make HTTP request
     */
    const response = await this.sendRequest()

    /**
     * Step 4: Run teardown hooks
     */
    await this.runTeardownHooks(response)

    return response
  }

  /**
   * Implementation of `then` for the promise API
   */
  public then<TResult1 = ApiResponse, TResult2 = never>(
    resolve?: ((value: ApiResponse) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.send().then(resolve, reject)
  }

  /**
   * Implementation of `catch` for the promise API
   */
  public catch<TResult = never>(
    reject?: ((reason: ApiResponse) => TResult | PromiseLike<TResult>) | undefined | null
  ): Promise<ApiResponse | TResult> {
    return this.send().catch(reject)
  }

  /**
   * Implementation of `finally` for the promise API
   */
  public finally(fullfilled?: (() => void) | undefined | null): Promise<ApiResponse> {
    return this.send().finally(fullfilled)
  }

  /**
   * Required when Promises are extended
   */
  public get [Symbol.toStringTag]() {
    return this.constructor.name
  }
}
