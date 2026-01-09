/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { type ReadStream } from 'node:fs'
import { type Response } from 'superagent'
import { type EventEmitter } from 'node:events'

import { type ApiRequest } from './request.js'
import { type ApiResponse } from './response.js'

/**
 * Represents a file from a multipart response.
 * The interface is copied from formidable's PersistentFile type, as superagent
 * uses formidable for parsing response files.
 */
export interface SuperAgentResponseFile extends EventEmitter {
  open(): void
  toJSON(): {
    length: number
    mimetype: string | null
    mtime: Date | null
    size: number
    filepath: string
    originalFilename: string | null
    hash?: string | null
  }
  toString(): string
  write(buffer: string, cb: () => void): void
  end(cb: () => void): void
  destroy(): void
}

/**
 * Superagent response parser callback method. The method
 * receives an instance of the Node.js readable stream
 */
export type SuperAgentParser = (
  res: Response,
  callback: (err: Error | null, body: any) => void
) => void

/**
 * Superagent request serializer. The method receives the
 * request body object and must serialize it to a string
 */
export type SuperAgentSerializer = (obj: any) => string

/**
 * Allowed multipart values
 */
export type MultipartValue = Blob | Buffer | ReadStream | string | boolean | number

/**
 * Custom cookies serializer for processing request and response cookies.
 */
export type CookiesSerializer = {
  /**
   * Process a cookie from the response
   *
   * @param key - The cookie name
   * @param value - The cookie value
   * @param response - The API response instance
   */
  process(key: string, value: any, response: ApiResponse): any

  /**
   * Prepare a cookie for the request
   *
   * @param key - The cookie name
   * @param value - The cookie value
   * @param request - The API request instance
   */
  prepare(key: string, value: any, request: ApiRequest): string
}

/**
 * Configuration accepted by the ApiRequest class.
 */
export type RequestConfig = {
  /** The HTTP method */
  method: string

  /** The endpoint or URL path */
  endpoint: string

  /** Optional base URL to prepend to the endpoint */
  baseUrl?: string

  /** Lifecycle hooks for the request */
  hooks?: {
    setup: SetupHandler[]
    teardown: TeardownHandler[]
  }

  /** Custom serializers */
  serializers?: {
    cookie?: CookiesSerializer
  }
}

/**
 * Represents a parsed cookie from an HTTP response.
 */
export type ResponseCookie = {
  /** The cookie name */
  name: string

  /** The cookie value */
  value: any

  /** The cookie path */
  path?: string

  /** The cookie domain */
  domain?: string

  /** The cookie expiration date */
  expires?: Date

  /** The cookie max age in seconds */
  maxAge?: number

  /** Whether the cookie is secure (HTTPS only) */
  secure?: boolean

  /** Whether the cookie is HTTP only (not accessible via JavaScript) */
  httpOnly?: boolean

  /** The cookie SameSite attribute */
  sameSite?: string
}

/**
 * A collection of response cookies indexed by name.
 */
export type ResponseCookies = Record<string, ResponseCookie>

/**
 * Represents a cookie to be sent with a request.
 */
export type RequestCookie = {
  /** The cookie name */
  name: string

  /** The cookie value */
  value: any
}

/**
 * A collection of request cookies indexed by name.
 */
export type RequestCookies = Record<string, RequestCookie>

/**
 * Cleanup handler for setup hooks, called after the setup hook completes or errors.
 */
export type SetupCleanupHandler = (error: any | null, request: ApiRequest) => any | Promise<any>

/**
 * Setup handler called before making an HTTP request.
 * Can optionally return a cleanup handler.
 */
export type SetupHandler = (
  request: ApiRequest
) => any | SetupCleanupHandler | Promise<any> | Promise<SetupCleanupHandler>

/**
 * Cleanup handler for teardown hooks, called after the teardown hook completes or errors.
 */
export type TeardownCleanupHandler = (
  error: any | null,
  response: ApiResponse
) => any | Promise<any>

/**
 * Teardown handler called after receiving an HTTP response.
 * Can optionally return a cleanup handler.
 */
export type TeardownHandler = (
  response: ApiResponse
) => any | TeardownCleanupHandler | Promise<any> | Promise<TeardownCleanupHandler>

/**
 * Lifecycle hooks configuration for API requests.
 */
export type ApiRequestHooks = {
  setup: [Parameters<SetupHandler>, Parameters<SetupCleanupHandler>]
  teardown: [Parameters<TeardownHandler>, Parameters<TeardownCleanupHandler>]
}

/**
 * User-augmentable routes registry for type-safe API client.
 * Augment this interface to enable type-safe endpoints.
 *
 * @example
 * declare module '@japa/api-client' {
 *   interface UserRoutesRegistry {
 *     'users.show': {
 *       methods: ['GET', 'HEAD']
 *       pattern: '/users/:id'
 *       types: {
 *         params: { id: string }
 *         query: {}
 *         body: {}
 *         response: { user: { id: string; name: string } }
 *       }
 *     }
 *   }
 * }
 */
export interface RoutesRegistry {}

/**
 * Defines the structure of a route in the routes registry.
 */
export interface RouteDefinition {
  /** Allowed HTTP methods for this route */
  methods: readonly string[]

  /** The URL pattern for this route */
  pattern: string

  /** Type definitions for the route */
  types: {
    /** Route parameter types */
    params: Record<string, any>

    /** Query string parameter types */
    query: Record<string, any>

    /** Request body type */
    body: Record<string, any>

    /** Response body type */
    response: any
  }
}

/**
 * Function that builds a route URL and method from a route name and parameters.
 */
export type RouteBuilder = (
  name: string,
  params?: any[] | Record<string, any>
) => {
  /** The built URL */
  url: string

  /** The HTTP method */
  method: string
}

/**
 * Check if an object type is empty (has no keys)
 */
export type IsEmptyObject<T> = keyof T extends never ? true : false

/**
 * Check if user has augmented the registry
 */
type HasUserRegistry = keyof RoutesRegistry extends never ? false : true

/**
 * Find a route definition by its pattern
 */
type FindRouteByPattern<P extends string> = {
  [K in keyof RoutesRegistry]: RoutesRegistry[K] extends { pattern: P } ? RoutesRegistry[K] : never
}[keyof RoutesRegistry]

/**
 * Extract all patterns from the registry
 */
type AllPatterns = RoutesRegistry[keyof RoutesRegistry] extends { pattern: infer P }
  ? P extends string
    ? P
    : never
  : never

/**
 * Helper to extract a type from a named route
 */
type InferFromRoute<
  Name extends keyof RoutesRegistry,
  Key extends 'params' | 'query' | 'body' | 'response',
> = RoutesRegistry[Name] extends { types: infer Types }
  ? Key extends keyof Types
    ? Types[Key]
    : never
  : never

/**
 * Helper to extract a type from a route pattern
 */
type InferFromPattern<
  P extends string,
  Key extends 'body' | 'query' | 'response',
> = HasUserRegistry extends true
  ? [FindRouteByPattern<P>] extends [never]
    ? any
    : FindRouteByPattern<P> extends { types: infer Types }
      ? Key extends keyof Types
        ? Types[Key]
        : any
      : any
  : any

export type InferRouteParams<Name extends keyof RoutesRegistry> = InferFromRoute<Name, 'params'>

/**
 * Infer the query type from a named route.
 */
export type InferRouteQuery<Name extends keyof RoutesRegistry> = InferFromRoute<Name, 'query'>

/**
 * Infer the body type from a named route.
 */
export type InferRouteBody<Name extends keyof RoutesRegistry> = InferFromRoute<Name, 'body'>

/**
 * Infer the response type from a named route.
 */
export type InferRouteResponse<Name extends keyof RoutesRegistry> = InferFromRoute<Name, 'response'>

/**
 * Infer the body type from a route pattern.
 */
export type InferBody<P extends string> = InferFromPattern<P, 'body'>

/**
 * Infer the response type from a route pattern.
 */
export type InferResponse<P extends string> = InferFromPattern<P, 'response'>

/**
 * Infer the query type from a route pattern.
 */
export type InferQuery<P extends string> = InferFromPattern<P, 'query'>

/**
 * Valid patterns (restricted to known patterns if registry is configured)
 */
export type ValidPattern = HasUserRegistry extends true ? AllPatterns : string

/**
 * Configuration options for the apiClient plugin.
 */
export interface ApiClientPluginOptions {
  /** The base URL for all requests */
  baseURL?: string
}

/**
 * Infer the params type from a named route.
 */
