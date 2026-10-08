/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost' })
const globals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLInputElement',
  'Element',
  'Node',
  'Event',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'localStorage',
] as const
for (const key of globals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: dom[key],
  })
}
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
})

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { QueryClient, QueryClientProvider, notifyManager } =
  await import('@tanstack/react-query')
const i18next = (await import('i18next')).default
const { initReactI18next } = await import('react-i18next')
const { api } = await import('@/lib/api')
const { UserBillDialog } = await import('../components/user-bill-dialog')
const { billFixture } = await import('./fixtures')
await i18next
  .use(initReactI18next)
  .init({ lng: 'en', resources: {}, fallbackLng: 'en' })
notifyManager.setScheduler(queueMicrotask)

after(() => {
  notifyManager.setScheduler((callback) => setTimeout(callback, 0))
  dom.close()
})

test('admin bill disables export while loading, displays the result, and submits today for the selected user', async () => {
  const oldAdapter = api.defaults.adapter
  const requests: InternalAxiosRequestConfig[] = []
  let completeRequest: ((response: AxiosResponse) => void) | undefined
  api.defaults.adapter = (config) => {
    requests.push(config)
    return new Promise<AxiosResponse>((resolve) => {
      completeRequest = resolve
    })
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const button = (label: string): HTMLButtonElement => {
    const found = [...document.querySelectorAll('button')].find(
      (element) => element.textContent === label
    )
    assert.ok(found, `Missing button: ${label}`)
    return found
  }
  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <UserBillDialog userId={7} onOpenChange={() => undefined} />
        </QueryClientProvider>
      )
    })
    assert.ok(button('Export CSV').disabled)
    assert.ok(document.querySelector('[role="status"]'))
    assert.equal(requests[0].url, '/api/user/7/bill')
    const complete = completeRequest
    assert.ok(complete)
    await act(async () => {
      complete({
        data: { success: true, data: billFixture },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: requests[0],
      })
    })
    assert.equal(button('Export CSV').disabled, false)
    assert.ok(document.body.textContent?.includes('buyer'))
    await act(async () => {
      button('Today').click()
    })
    assert.equal(requests[1].params.start_date, requests[1].params.end_date)
    assert.ok(button('Export CSV').disabled)
    const fail = completeRequest
    assert.ok(fail)
    await act(async () => {
      fail({
        data: { success: false, message: 'failed' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: requests[1],
      })
    })
    assert.ok(document.body.textContent?.includes('Failed to load bill'))
    assert.ok(button('Export CSV').disabled)
    assert.ok(button('Retry'))
  } finally {
    await act(async () => root.unmount())
    client.clear()
    api.defaults.adapter = oldAdapter
    container.remove()
  }
})
