/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { inspect } from 'node:util'
import { type ApiRequest } from './request.js'
import { type ApiResponse } from './response.js'
import { parse } from '@poppinss/qs'

const INSPECT_OPTIONS = { colors: true, depth: 2, showHidden: false }

/**
 * Convert error stack string to an error object.
 *
 * It is an expirement to use server error stack and convert
 * it to an actual error object.
 *
 * @param errorStack - The error stack string or any value to process
 */
export function stackToError(errorStack: any): string | Error {
  if (typeof errorStack === 'string' && /^\s*at .*(\S+:\d+|\(native\))/m.test(errorStack)) {
    const customError = new Error(errorStack.split('\n')[0])
    customError.stack = errorStack
    return customError
  }

  return errorStack
}

/**
 * Default implementation to print request errors.
 * Attempts to convert error stack to an error object when status >= 500.
 *
 * @param response - The API response to dump errors from
 *
 * @example
 * dumpResponseError(response)
 */
export function dumpResponseError(response: ApiResponse) {
  /**
   * Attempt to convert error stack to a error object when status >= 500
   */
  if (response.status() >= 500 && response.hasError()) {
    console.log(`"error"   => ${inspect(stackToError(response.text()))}`)
    return
  }
}

/**
 * Default implementation to log request cookies.
 * Outputs the cookies jar to the console.
 *
 * @param request - The API request containing cookies to dump
 *
 * @example
 * dumpRequestCookies(request)
 */
export function dumpRequestCookies(request: ApiRequest) {
  console.log(`"cookies"  => ${inspect(request.cookiesJar, INSPECT_OPTIONS)}`)
}

/**
 * Default implementation to log response cookies.
 * Outputs the response cookies to the console.
 *
 * @param response - The API response containing cookies to dump
 *
 * @example
 * dumpResponseCookies(response)
 */
export function dumpResponseCookies(response: ApiResponse) {
  console.log(`"cookies"   => ${inspect(response.cookies(), INSPECT_OPTIONS)}`)
}

/**
 * Default implementation to log request headers.
 * Outputs the request headers to the console.
 *
 * @param request - The API request containing headers to dump
 *
 * @example
 * dumpRequestHeaders(request)
 */
export function dumpRequestHeaders(request: ApiRequest) {
  // @ts-ignore
  console.log(`"headers"  => ${inspect(request.request['header'], INSPECT_OPTIONS)}`)
}

/**
 * Default implementation to log response headers.
 * Outputs the response headers to the console.
 *
 * @param response - The API response containing headers to dump
 *
 * @example
 * dumpResponseHeaders(response)
 */
export function dumpResponseHeaders(response: ApiResponse) {
  console.log(`"headers"   => ${inspect(response.headers(), INSPECT_OPTIONS)}`)
}

/**
 * Default implementation to log request body.
 * Outputs the request body data to the console.
 *
 * @param request - The API request containing body to dump
 *
 * @example
 * dumpRequestBody(request)
 */
export function dumpRequestBody(request: ApiRequest) {
  // @ts-ignore
  const data = request.request['_data']
  if (data) {
    console.log(`"body"     => ${inspect(data, INSPECT_OPTIONS)}`)
  }
}

/**
 * Default implementation to log response body.
 * Outputs the response body, text, and files to the console.
 * Skips body output for server errors (status >= 500).
 *
 * @param response - The API response containing body to dump
 *
 * @example
 * dumpResponseBody(response)
 */
export function dumpResponseBody(response: ApiResponse) {
  if (response.status() >= 500) {
    return
  }

  if (response.hasBody()) {
    console.log(`"body"     => ${inspect(response.body(), INSPECT_OPTIONS)}`)
  } else if (response.text()) {
    console.log(`"text"     => ${inspect(response.text(), INSPECT_OPTIONS)}`)
  }

  if (response.hasFiles()) {
    const files = Object.keys(response.files()).reduce(
      (result, fileName) => {
        result[fileName] = response.files()[fileName].toJSON()
        return result
      },
      {} as Record<string, any>
    )
    console.log(`"files"    => ${inspect(files, INSPECT_OPTIONS)}`)
  }
}

/**
 * Default implementation to log request.
 * Outputs the request method, endpoint, and query string to the console.
 *
 * @param request - The API request to dump
 *
 * @example
 * dumpRequest(request)
 */
export function dumpRequest(request: ApiRequest) {
  console.log(
    `"request"  => ${inspect(
      {
        method: request.request.method,
        endpoint: request.config.endpoint,
      },
      INSPECT_OPTIONS
    )}`
  )

  if ('qsRaw' in request.request && Array.isArray(request.request.qsRaw)) {
    console.log(`"qs"       => ${inspect(parse(request.request.qsRaw.join('&')), INSPECT_OPTIONS)}`)
  }
}

/**
 * Default implementation to log response.
 * Outputs the response status to the console.
 *
 * @param response - The API response to dump
 *
 * @example
 * dumpResponse(response)
 */
export function dumpResponse(response: ApiResponse) {
  console.log(
    `"response"  => ${inspect(
      {
        status: response.status(),
      },
      INSPECT_OPTIONS
    )}`
  )
}
