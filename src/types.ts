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
 * The interface is copied from https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/formidable/PersistentFile.d.ts, since superagent using formidable for parsing response
 * files.
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
 * Shape of custom cookies serializer.
 */
export type CookiesSerializer = {
  process(key: string, value: any, response: ApiResponse): any
  prepare(key: string, value: any, request: ApiRequest): string
}

/**
 * Config accepted by the API request class
 */
export type RequestConfig = {
  method: string
  endpoint: string
  baseUrl?: string
  hooks?: {
    setup: SetupHandler[]
    teardown: TeardownHandler[]
  }
  serializers?: {
    cookie?: CookiesSerializer
  }
}

/**
 * Shape of the parsed response cookie
 */
export type ResponseCookie = {
  name: string
  value: any
  path?: string
  domain?: string
  expires?: Date
  maxAge?: number
  secure?: boolean
  httpOnly?: boolean
  sameSite?: string
}

/**
 * Response cookies jar
 */
export type ResponseCookies = Record<string, ResponseCookie>

/**
 * Shape of the cookie accepted by the request
 */
export type RequestCookie = {
  name: string
  value: any
}

/**
 * Request cookies jar
 */
export type RequestCookies = Record<string, RequestCookie>

/**
 * Setup handlers
 */
export type SetupCleanupHandler = (error: any | null, request: ApiRequest) => any | Promise<any>
export type SetupHandler = (
  request: ApiRequest
) => any | SetupCleanupHandler | Promise<any> | Promise<SetupCleanupHandler>

/**
 * Teardown handlers
 */
export type TeardownCleanupHandler = (
  error: any | null,
  response: ApiResponse
) => any | Promise<any>
export type TeardownHandler = (
  response: ApiResponse
) => any | TeardownCleanupHandler | Promise<any> | Promise<TeardownCleanupHandler>

/**
 * Hooks type
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
export interface UserRoutesRegistry {}

/**
 * Shape of a route definition in the registry
 */
export interface RouteDefinition {
  methods: readonly string[]
  pattern: string
  types: {
    params: Record<string, any>
    query: Record<string, any>
    body: Record<string, any>
    response: any
  }
}

export type RouteBuilder = (
  name: string,
  params?: any[] | Record<string, any>
) => {
  url: string
  method: string
}

/**
 * Check if an object type is empty (has no keys)
 */
export type IsEmptyObject<T> = keyof T extends never ? true : false

/**
 * Check if user has augmented the registry
 */
type HasUserRegistry = keyof UserRoutesRegistry extends never ? false : true

/**
 * Find a route definition by its pattern
 */
type FindRouteByPattern<P extends string> = {
  [K in keyof UserRoutesRegistry]: UserRoutesRegistry[K] extends { pattern: P }
    ? UserRoutesRegistry[K]
    : never
}[keyof UserRoutesRegistry]

/**
 * Extract all patterns from the registry
 */
type AllPatterns = UserRoutesRegistry[keyof UserRoutesRegistry] extends { pattern: infer P }
  ? P extends string
    ? P
    : never
  : never

/**
 * Helper to extract a type from a named route
 */
type InferFromRoute<
  Name extends keyof UserRoutesRegistry,
  Key extends 'params' | 'query' | 'body' | 'response',
> = UserRoutesRegistry[Name] extends { types: infer Types }
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

export type InferRouteParams<Name extends keyof UserRoutesRegistry> = InferFromRoute<Name, 'params'>
export type InferRouteQuery<Name extends keyof UserRoutesRegistry> = InferFromRoute<Name, 'query'>
export type InferRouteBody<Name extends keyof UserRoutesRegistry> = InferFromRoute<Name, 'body'>
export type InferRouteResponse<Name extends keyof UserRoutesRegistry> = InferFromRoute<
  Name,
  'response'
>

export type InferBody<P extends string> = InferFromPattern<P, 'body'>
export type InferResponse<P extends string> = InferFromPattern<P, 'response'>
export type InferQuery<P extends string> = InferFromPattern<P, 'query'>

/**
 * Valid patterns (restricted to known patterns if registry is configured)
 */
export type ValidPattern = HasUserRegistry extends true ? AllPatterns : string

/**
 * Options for the apiClient plugin
 */
export interface ApiClientPluginOptions {
  baseURL?: string
}
