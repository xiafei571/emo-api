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

import { isRegistrationAvailable } from '../lib/registration-availability.ts'

describe('sign-up navigation availability', () => {
  test('shows sign-up navigation while system status is loading', () => {
    assert.equal(isRegistrationAvailable(null), true)
  })

  test('keeps sign-up navigation available in self-use mode', () => {
    assert.equal(
      isRegistrationAvailable({
        self_use_mode_enabled: true,
        register_enabled: true,
      }),
      true
    )
  })

  test('hides sign-up navigation only when registration is explicitly disabled', () => {
    assert.equal(isRegistrationAvailable({ register_enabled: false }), false)
    assert.equal(
      isRegistrationAvailable({ data: { register_enabled: false } }),
      false
    )
  })
})
