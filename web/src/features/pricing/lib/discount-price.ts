import type { PricingModel } from '../types'
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
import { parseTiersFromExpr, type TierCondition } from './billing-expr'

export type CatalogRate = { min: number; max: number }
export type CatalogTier = {
  label: string
  conditions: TierCondition[]
  rates: Record<string, CatalogRate>
}
export type CatalogPricing = {
  dynamic: boolean
  unsupported: boolean
  rates: Record<string, CatalogRate>
  tiers: CatalogTier[]
  timeSchedule?: {
    timezone: string
    weekdayStart: number
    weekdayEnd: number
    windows: number[][]
  }
}
const fields: Record<string, string> = {
  p: 'input',
  c: 'output',
  cr: 'cache',
  cc: 'create_cache',
  cc1h: 'cache_write_1h',
  img: 'image',
  img_o: 'image_output',
  ai: 'audio_input',
  ao: 'audio_output',
}
const number = '(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?'
const term = new RegExp(
  `^(${Object.keys(fields).join('|')})\\s*\\*\\s*(${number})$`
)

// Present the actual configured contract. Never use stale ratio-table prices
// for a dynamic model that the catalog cannot safely interpret.
export function getDiscountPricing(
  model: PricingModel,
  ratio: number
): CatalogPricing {
  const dynamic = model.billing_mode === 'tiered_expr'
  const result: CatalogPricing = {
    dynamic,
    unsupported: false,
    rates: {},
    tiers: [],
  }
  if (!Number.isFinite(ratio) || ratio < 0) {
    return { ...result, unsupported: true }
  }
  if (!dynamic) {
    const base = model.model_ratio * 2 * ratio
    const rates =
      model.quota_type === 1
        ? { input: (model.model_price ?? 0) * ratio }
        : {
            input: base,
            output: base * model.completion_ratio,
            cache:
              model.cache_ratio == null ? undefined : base * model.cache_ratio,
            create_cache:
              model.create_cache_ratio == null
                ? undefined
                : base * model.create_cache_ratio,
            cache_write_1h:
              model.create_cache_1h_ratio == null
                ? undefined
                : base * model.create_cache_1h_ratio,
          }
    for (const [key, value] of Object.entries(rates)) {
      if (value !== undefined && Number.isFinite(value) && value >= 0) {
        result.rates[key] = { min: value, max: value }
      }
    }
    return result
  }
  const expression = (model.billing_expr ?? '').replace(/^v1:/, '').trim()
  if (expression.includes('|||')) return { ...result, unsupported: true }
  const matches = [...expression.matchAll(/tier\("([^"\\]*)",\s*([^()]*)\)/g)]
  const parsed = parseTiersFromExpr(expression)
  if (
    !matches.length ||
    matches.length !== parsed.length ||
    new Set(matches.map((m) => m[1])).size !== matches.length
  ) {
    return { ...result, unsupported: true }
  }
  const outside = expression
    .replaceAll(/tier\("([^"\\]*)",\s*([^()]*)\)/g, '__tier__')
    .replaceAll(/"[^"\\]*"/g, '""')
  if (!hasTierOnlyBranches(outside)) {
    return { ...result, unsupported: true }
  }
  for (const [index, match] of matches.entries()) {
    const rates: Record<string, CatalogRate> = {}
    // Split plus operators without splitting a scientific-notation exponent.
    for (const piece of match[2].split(/(?<![eE])\+/)) {
      const coefficient = piece.trim().match(term)
      if (!coefficient || rates[fields[coefficient[1]]]) {
        return { ...result, unsupported: true }
      }
      const price = Number(coefficient[2]) * ratio
      if (!Number.isFinite(price) || price < 0) {
        return { ...result, unsupported: true }
      }
      rates[fields[coefficient[1]]] = { min: price, max: price }
    }
    result.tiers.push({
      label: match[1],
      conditions: parsed[index].conditions,
      rates,
    })
  }
  for (const key of Object.values(fields)) {
    const values = result.tiers.map((tier) => tier.rates[key]?.min)
    if (values.some((value) => value === undefined)) continue
    const prices = values as number[]
    result.rates[key] = { min: Math.min(...prices), max: Math.max(...prices) }
  }
  // Explain the supported recurring peak schedule from the expression itself,
  // rather than hard-coding hours based on the model name.
  const condition = expression.split('?')[0].replaceAll(/\s/g, '')
  const schedule = condition.match(
    /^\(weekday\("([^"]+)"\)>=([0-6])&&weekday\("\1"\)<=([0-6])&&\(\(hour\("\1"\)>=(\d+)&&hour\("\1"\)<(\d+)\)\|\|\(hour\("\1"\)>=(\d+)&&hour\("\1"\)<(\d+)\)\)\)$/
  )
  if (schedule && matches[0][1] === 'peak' && matches[1]?.[1] === 'off_peak') {
    result.timeSchedule = {
      timezone: schedule[1],
      weekdayStart: Number(schedule[2]),
      weekdayEnd: Number(schedule[3]),
      windows: [
        [Number(schedule[4]), Number(schedule[5])],
        [Number(schedule[6]), Number(schedule[7])],
      ],
    }
  }
  return result
}

// A quoted tariff must be a complete result branch, not a tier call multiplied
// by another value or merely used in a condition.
function hasTierOnlyBranches(source: string): boolean {
  let body = source.trim()
  while (body.startsWith('(') && body.endsWith(')')) {
    let depth = 0
    let wrapsAll = true
    for (let index = 0; index < body.length - 1; index++) {
      if (body[index] === '(') depth++
      if (body[index] === ')') depth--
      if (depth === 0) {
        wrapsAll = false
        break
      }
    }
    if (!wrapsAll) break
    body = body.slice(1, -1).trim()
  }
  if (body === '__tier__') return true
  let depth = 0
  let question = -1
  let nested = 0
  for (let index = 0; index < body.length; index++) {
    const char = body[index]
    if (char === '(') depth++
    if (char === ')') depth--
    if (depth !== 0) continue
    if (char === '?') {
      if (question < 0) question = index
      else nested++
    }
    if (char === ':' && question >= 0) {
      if (nested > 0) {
        nested--
        continue
      }
      return (
        !body.slice(0, question).includes('__tier__') &&
        hasTierOnlyBranches(body.slice(question + 1, index)) &&
        hasTierOnlyBranches(body.slice(index + 1))
      )
    }
  }
  return false
}

export function formatCatalogRate(rate: CatalogRate): string {
  const format = (value: number) =>
    new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 8,
      useGrouping: false,
    }).format(value)
  if (rate.min === rate.max) return `$${format(rate.min)}`
  return `$${format(rate.min)}–$${format(rate.max)}`
}
