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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'

import { authLayoutClasses } from './lib/auth-layout'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout(props: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  return (
    <main className={authLayoutClasses.page}>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_68%)] dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_68%)]'
      />
      <div className={authLayoutClasses.shell}>
        <Link
          to='/'
          className='mx-auto mb-6 flex items-center gap-2 rounded-full px-2 py-1.5 transition-opacity hover:opacity-80 sm:mb-7'
        >
          <div className='relative h-8 w-8'>
            {loading ? (
              <Skeleton className='absolute inset-0 rounded-full' />
            ) : (
              <img
                src={logo}
                alt={t('Logo')}
                className='h-8 w-8 rounded-full object-cover'
              />
            )}
          </div>
          {loading ? (
            <Skeleton className='h-6 w-24' />
          ) : (
            <span className='text-sm font-semibold tracking-tight'>
              {systemName}
            </span>
          )}
        </Link>
        <section className={authLayoutClasses.content}>
          {props.children}
        </section>
      </div>
    </main>
  )
}
