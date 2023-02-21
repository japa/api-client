# @japa/client
> API client to test endpoints over HTTP. Uses superagent under the hood

[![github-actions-image]][github-actions-url] [![npm-image]][npm-url] [![license-image]][license-url] [![typescript-image]][typescript-url]

The API client plugin of Japa makes it super simple to test your API endpoints over HTTP. You can use it to test any HTTP endpoint that returns JSON, XML, HTML, or even plain text.

It has out of the box support for:

- Multiple content types including `application/json`, `application/x-www-form-urlencoded` and `multipart`.
- Ability to upload files.
- Read and write cookies with the option to register custom cookies serializer.
- Lifecycle hooks. A great use-case of hooks is to persist and load session data during a request.
- All other common abilities like sending headers, query-string, and following redirects.
- Support for registering custom body serializers and parsers.

#### [Complete API documentation](https://japa.dev/docs/plugins/api-client)

## Installation
Install the package from the npm registry as follows:

```sh
npm i @japa/api-client

yarn add @japa/api-client
```

## Usage
You can use the assertion package with the `@japa/runner` as follows.

```ts
import { apiClient } from '@japa/api-client'
import { configure } from '@japa/runner'

configure({
  plugins: [apiClient({ baseURL: 'http://localhost:3333' })]
})
```

Once done, you will be able to access the `client` property from the test context.

```ts
test('test title', ({ client }) => {
  const response = await client.get('/')
})
```

[github-actions-url]: https://github.com/japa/api-client/actions/workflows/test.yml
[github-actions-image]: https://img.shields.io/github/actions/workflow/status/japa/api-client/test.yml?style=for-the-badge "github-actions"

[npm-image]: https://img.shields.io/npm/v/@japa/api-client.svg?style=for-the-badge&logo=npm
[npm-url]: https://npmjs.org/package/@japa/api-client "npm"

[license-image]: https://img.shields.io/npm/l/@japa/api-client?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]:  "typescript"
