/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { PluginFn } from '@japa/runner/types'
import { ApiClient } from './src/client.js'
import { TestContext } from '@japa/runner/core'
import type { ApiClientPluginOptions } from './src/types.js'

export { ApiClient }
export { ApiRequest } from './src/request.js'
export { ApiResponse } from './src/response.js'

/**
 * API client plugin registers an HTTP request client that
 * can be used for testing API endpoints.
 */
export function apiClient(options?: string | ApiClientPluginOptions): PluginFn {
  return function () {
    const normalizedOptions = typeof options === 'string' ? { baseURL: options } : options
    TestContext.getter(
      'client',
      function (this: TestContext) {
        return new ApiClient(normalizedOptions?.baseURL, this.assert)
      },
      true
    )
  }
}

declare module '@japa/runner/core' {
  interface TestContext {
    client: ApiClient
  }
}
