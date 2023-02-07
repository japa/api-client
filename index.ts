/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { PluginFn } from '@japa/runner'
import { ApiClient } from './src/client'

export { ApiClient }
export * from './src/types'
export { ApiRequest } from './src/request'
export { ApiResponse } from './src/response'

/**
 * ApiClient plugin implementation
 */
export function apiClient(baseUrl?: string): PluginFn {
  return function (_, __, { TestContext }) {
    TestContext.getter(
      'client',
      function () {
        return new ApiClient(baseUrl, this.assert)
      },
      true
    )
  }
}

declare module '@japa/runner' {
  interface TestContext {
    client: ApiClient
  }
}
