/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { inspect } from 'node:util'
import { ApiRequest } from './request.js'
import { ApiResponse } from './response.js'

const INSPECT_OPTIONS = { colors: true, depth: 2, showHidden: false }

/**
 * Convert error stack string to an error object.
 *
 * It is an expirement to use server error stack and convert
 * it to an actual error object.
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
 * Default implementation to print request errors
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
 * Default implementation to log request cookies
 */
export function dumpRequestCookies(request: ApiRequest) {
  console.log(`"cookies"  => ${inspect(request.cookiesJar, INSPECT_OPTIONS)}`)
}

/**
 * Default implementation to log response cookies
 */
export function dumpResponseCookies(response: ApiResponse) {
  console.log(`"cookies"   => ${inspect(response.cookies(), INSPECT_OPTIONS)}`)
}

/**
 * Default implementation to log request headers
 */
export function dumpRequestHeaders(request: ApiRequest) {
  // @ts-ignore
  console.log(`"headers"  => ${inspect(request.request['header'], INSPECT_OPTIONS)}`)
}

/**
 * Default implementation to log response headers
 */
export function dumpResponseHeaders(response: ApiResponse) {
  console.log(`"headers"   => ${inspect(response.headers(), INSPECT_OPTIONS)}`)
}

/**
 * Default implementation to log request body
 */
export function dumpRequestBody(request: ApiRequest) {
  // @ts-ignore
  const data = request.request['_data']
  if (data) {
    console.log(`"body"     => ${inspect(data, INSPECT_OPTIONS)}`)
  }
}

/**
 * Default implementation to log response body
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
    const files = Object.keys(response.files()).reduce((result, fileName) => {
      result[fileName] = response.files()[fileName].toJSON()
      return result
    }, {} as Record<string, any>)
    console.log(`"files"    => ${inspect(files, INSPECT_OPTIONS)}`)
  }
}

/**
 * Default implementation to log request
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

  // @ts-ignore
  console.log(`"qs"       => ${inspect(request.request['qs'], INSPECT_OPTIONS)}`)
}

/**
 * Default implementation to log response
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
