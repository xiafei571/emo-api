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
export const authLayoutClasses = {
  page: 'relative min-h-svh overflow-y-auto bg-background',
  shell:
    'relative z-10 mx-auto flex min-h-svh w-full max-w-[440px] flex-col px-4 py-6 sm:px-6 sm:py-9',
  content:
    'w-full rounded-3xl border border-border/60 bg-background/95 p-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.42)] backdrop-blur-sm sm:p-8',
} as const
