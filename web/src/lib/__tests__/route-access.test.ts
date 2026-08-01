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

import { resolveProtectedRouteAccess } from '../route-access.ts'

describe('protected route access', () => {
  test('requires sign-in when the authentication session has been cleared', () => {
    assert.equal(
      resolveProtectedRouteAccess({ user: null, accessToken: null }, 100),
      'sign-in'
    )
  })

  test('forbids an authenticated user without the required role', () => {
    assert.equal(
      resolveProtectedRouteAccess(
        { user: { role: 10 }, accessToken: 'admin-token' },
        100
      ),
      'forbidden'
    )
  })

  test('allows an authenticated user with the required role', () => {
    assert.equal(
      resolveProtectedRouteAccess(
        { user: { role: 100 }, accessToken: 'root-token' },
        100
      ),
      'allow'
    )
  })
})
