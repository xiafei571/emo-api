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

import { oauthProviderLayoutClasses } from '../../lib/oauth-provider-layout.ts'

describe('OAuth provider button layout', () => {
  test('long provider status text cannot widen the authentication form', () => {
    const buttonClasses = oauthProviderLayoutClasses.button.split(' ')
    const labelClasses = oauthProviderLayoutClasses.label.split(' ')

    assert.ok(buttonClasses.includes('w-full'))
    assert.ok(buttonClasses.includes('min-w-0'))
    assert.ok(buttonClasses.includes('overflow-hidden'))
    assert.ok(labelClasses.includes('min-w-0'))
    assert.ok(labelClasses.includes('truncate'))
  })
})
