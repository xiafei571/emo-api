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
import { describe, test } from 'node:test'

import { PAYMENT_TYPES } from '../constants'
import {
  dispatchSelectedPayment,
  getDefaultStripeCurrency,
  isStripePayment,
  isWaffoPayment,
  isWaffoPancakePayment,
  orderStripeCurrencies,
} from './payment'

describe('payment type classification', () => {
  test('keeps Waffo and Waffo Pancake on their dedicated flows', () => {
    assert.equal(isWaffoPayment(PAYMENT_TYPES.WAFFO), true)
    assert.equal(isWaffoPayment(PAYMENT_TYPES.WAFFO_PANCAKE), false)
    assert.equal(isWaffoPancakePayment(PAYMENT_TYPES.WAFFO_PANCAKE), true)
    assert.equal(isWaffoPancakePayment(PAYMENT_TYPES.WAFFO), false)
    assert.equal(isStripePayment(PAYMENT_TYPES.STRIPE), true)
  })
})

describe('payment dispatch', () => {
  test('keeps the selected Waffo method index through confirmation', async () => {
    const calls: string[] = []
    const success = await dispatchSelectedPayment(
      { name: 'Waffo Card', type: PAYMENT_TYPES.WAFFO },
      120,
      3,
      {
        regular: async () => {
          calls.push('regular')
          return false
        },
        waffo: async (amount, index) => {
          calls.push(`waffo:${amount}:${index}`)
          return true
        },
        waffoPancake: async () => {
          calls.push('pancake')
          return false
        },
      }
    )

    assert.equal(success, true)
    assert.deepEqual(calls, ['waffo:120:3'])
  })

  test('does not create a Waffo order without a selected method index', async () => {
    let called = false
    const success = await dispatchSelectedPayment(
      { name: 'Waffo Card', type: PAYMENT_TYPES.WAFFO },
      120,
      null,
      {
        regular: async () => false,
        waffo: async () => {
          called = true
          return true
        },
        waffoPancake: async () => false,
      }
    )

    assert.equal(success, false)
    assert.equal(called, false)
  })

  test('passes the selected Stripe currency to the regular processor', async () => {
    const calls: string[] = []
    const success = await dispatchSelectedPayment(
      { name: 'CNY', type: PAYMENT_TYPES.STRIPE, currency: 'CNY' },
      5,
      null,
      {
        regular: async (amount, type, currency) => {
          calls.push(`${type}:${currency}:${amount}`)
          return true
        },
        waffo: async () => false,
        waffoPancake: async () => false,
      }
    )

    assert.equal(success, true)
    assert.deepEqual(calls, ['stripe:CNY:5'])
  })
})

describe('Stripe currency defaults', () => {
  test('maps interface languages to their local payment currency', () => {
    assert.equal(getDefaultStripeCurrency('zh-CN'), 'CNY')
    assert.equal(getDefaultStripeCurrency('ja-JP'), 'JPY')
    assert.equal(getDefaultStripeCurrency('en-US'), 'USD')
  })

  test('puts the language currency first while preserving other options', () => {
    assert.deepEqual(orderStripeCurrencies(['USD', 'CNY', 'JPY'], 'ja'), [
      'JPY',
      'USD',
      'CNY',
    ])
  })
})
