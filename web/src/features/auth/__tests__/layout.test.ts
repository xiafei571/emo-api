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

import { authLayoutClasses } from '../lib/auth-layout.ts'

describe('authentication page layout', () => {
  test('keeps the page scrollable on short screens', () => {
    const pageClasses = authLayoutClasses.page.split(' ')

    assert.ok(pageClasses.includes('min-h-svh'))
    assert.ok(pageClasses.includes('overflow-y-auto'))
  })

  test('keeps the authentication form at a readable width', () => {
    const shellClasses = authLayoutClasses.shell.split(' ')

    assert.ok(shellClasses.includes('max-w-[440px]'))
    assert.ok(shellClasses.includes('w-full'))
  })

  test('preserves mobile and desktop panel padding', () => {
    const contentClasses = authLayoutClasses.content.split(' ')

    assert.ok(contentClasses.includes('p-5'))
    assert.ok(contentClasses.includes('sm:p-8'))
  })
})
