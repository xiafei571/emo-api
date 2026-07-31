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

import { getEmoPrivacyPolicy } from '../emo-privacy-policy.ts'

describe('EMO privacy policy localization', () => {
  test('returns Simplified Chinese for the Chinese interface locale', () => {
    const policy = getEmoPrivacyPolicy('zhCN')

    assert.match(policy, /EMO API 隐私政策/)
    assert.match(policy, /Data Partner/)
  })

  test('returns Japanese for the Japanese interface locale', () => {
    const policy = getEmoPrivacyPolicy('ja')

    assert.match(policy, /EMO API プライバシーポリシー/)
    assert.match(policy, /Data Partner/)
  })

  test('falls back to English for English and unsupported locales', () => {
    const englishPolicy = getEmoPrivacyPolicy('en')
    const fallbackPolicy = getEmoPrivacyPolicy('fr')

    assert.match(englishPolicy, /EMO API Privacy Policy/)
    assert.equal(fallbackPolicy, englishPolicy)
  })
})
