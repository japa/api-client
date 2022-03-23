/*
 * @japa/api-client
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { ReadStream } from 'fs'
import { EventEmitter } from 'events'
import { Response } from 'superagent'
import { ApiRequest } from '../Request'
import { ApiResponse } from '../Response'

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
  secure?: true
  httpOnly?: true
  sameSite?: 'lax' | 'none' | 'strict'
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
