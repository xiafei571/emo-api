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
import { ArrowRight, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { GettingStartedSteps } from '../getting-started-steps'
import { HeroModelWall } from '../hero-model-wall'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const renderDocsButton = () => {
    return (
      <Button
        variant='outline'
        className='group border-border hover:border-foreground/30 hover:bg-muted/50 inline-flex h-11 items-center gap-1.5 rounded-lg px-5 text-sm font-medium'
        render={<Link to='/guide' />}
      >
        <BookOpen className='text-muted-foreground/80 group-hover:text-foreground size-4 transition-colors duration-200' />
        <span>{t('Docs')}</span>
      </Button>
    )
  }

  return (
    <section className='relative z-10 overflow-hidden px-6 pt-24 pb-16 md:pt-32 md:pb-24 lg:pt-36 lg:pb-28'>
      {/* Radial gradient background */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 opacity-[0.18] dark:opacity-[0.10]'
        style={{
          background: [
            'radial-gradient(ellipse 60% 50% at 18% 18%, oklch(0.78 0.12 235 / 75%) 0%, transparent 70%)',
            'radial-gradient(ellipse 50% 42% at 84% 12%, oklch(0.83 0.10 180 / 60%) 0%, transparent 70%)',
            'radial-gradient(ellipse 42% 38% at 48% 82%, oklch(0.78 0.13 300 / 45%) 0%, transparent 70%)',
          ].join(', '),
        }}
      />
      {/* Grid pattern */}
      <div
        aria-hidden
        className='absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,black_20%,transparent_100%)] bg-[size:4rem_4rem] opacity-[0.08]'
      />

      <div className='mx-auto grid max-w-6xl grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-8'>
        {/* Left Column: Title, description, and action buttons */}
        <div className='flex flex-col items-start text-left lg:col-span-6'>
          {/* Top Pill Badge */}
          <div
            className='landing-animate-fade-up mb-5 inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/[0.06] px-3 py-1.5 text-[11px] font-medium text-indigo-600 opacity-0 shadow-xs dark:border-indigo-400/20 dark:bg-indigo-400/5 dark:text-indigo-400'
            style={{ animationDelay: '0ms' }}
          >
            <span className='relative flex size-1.5'>
              <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75' />
              <span className='relative inline-flex size-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400' />
            </span>
            <span>{t('Better prices · Better uptime · No subscriptions')}</span>
          </div>

          <h1
            className='landing-animate-fade-up text-[clamp(2.25rem,4.5vw,3.25rem)] leading-[1.15] font-bold tracking-tight'
            style={{ animationDelay: '60ms' }}
          >
            {t('Mainstream AI models,')}
            <br />
            <span className='bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent'>
              {t('starting at 10–20% of official prices')}
            </span>
          </h1>
          <p
            className='landing-animate-fade-up text-muted-foreground/80 mt-5 max-w-xl text-base leading-relaxed opacity-0 md:text-[15px]'
            style={{ animationDelay: '120ms' }}
          >
            {t(
              'Unified API access to Claude, GPT, Gemini, and other leading models. Low-cost, stable, and secure, with major API compatibility for fast migration.'
            )}
          </p>

          <div
            className='landing-animate-fade-up mt-8 flex flex-wrap items-center gap-3 opacity-0'
            style={{ animationDelay: '180ms' }}
          >
            {props.isAuthenticated ? (
              <>
                <Button
                  className='group h-11 rounded-lg px-5 text-sm font-medium'
                  render={<Link to='/dashboard' />}
                >
                  {t('Go to Dashboard')}
                  <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
                </Button>
                {renderDocsButton()}
              </>
            ) : (
              <>
                <Button
                  className='group h-11 rounded-lg px-5 text-sm font-medium'
                  render={<Link to='/sign-up' />}
                >
                  {t('Get Started')}
                  <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
                </Button>
                {renderDocsButton()}
              </>
            )}
          </div>
        </div>

        {/* Right Column: Model Square preview */}
        <div
          className='landing-animate-fade-up flex w-full justify-center opacity-0 lg:col-span-6'
          style={{ animationDelay: '320ms' }}
        >
          <HeroModelWall className='mt-8 lg:mt-0' />
        </div>
      </div>
      <GettingStartedSteps />
    </section>
  )
}
