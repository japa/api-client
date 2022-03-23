/*
 * @japa/api-client
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { PluginFn } from '@japa/runner'
import { ApiClient } from './src/Client'

export * from './src/Contracts'
export { ApiClient } from './src/Client'
export { ApiRequest } from './src/Request'
export { ApiResponse } from './src/Response'

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
