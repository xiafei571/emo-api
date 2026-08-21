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
import { CreditCard, KeyRound, Mail, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconGithub } from '@/assets/brand-icons'

const steps = [
  {
    number: '1',
    title: 'Create an account',
    description: 'Sign up in seconds and get access to the EMO API workspace.',
    icon: UserRound,
  },
  {
    number: '2',
    title: 'Buy credits',
    description: 'Add credits in USD and use them across supported AI models.',
    icon: CreditCard,
  },
  {
    number: '3',
    title: 'Get your API key',
    description:
      'Create an API key and start making requests with familiar API formats.',
    icon: KeyRound,
  },
] as const

export function GettingStartedSteps() {
  const { t } = useTranslation()

  return (
    <section className='border-border/40 relative z-10 border-t px-6 py-16 md:py-20'>
      <div className='mx-auto grid max-w-6xl gap-12 md:grid-cols-3 md:gap-10'>
        {steps.map((step) => {
          const Icon = step.icon

          return (
            <div key={step.number} className='min-w-0'>
              <div className='flex items-center gap-4'>
                <div className='bg-muted flex size-12 shrink-0 items-center justify-center rounded-full text-lg font-medium'>
                  {step.number}
                </div>
                <h2 className='text-xl font-medium tracking-tight'>
                  {t(step.title)}
                </h2>
              </div>
              <p className='text-muted-foreground mt-7 max-w-sm text-base leading-relaxed'>
                {t(step.description)}
              </p>
              {step.number === '1' && (
                <div className='mt-10 space-y-4'>
                  <div className='text-muted-foreground flex items-center gap-3'>
                    <div className='bg-muted/40 flex size-10 items-center justify-center rounded-xl'>
                      <Icon className='size-5' strokeWidth={1.7} />
                    </div>
                    <div className='flex gap-1.5'>
                      <span className='bg-border h-2 w-12 rounded-full' />
                      <span className='bg-border/70 h-2 w-20 rounded-full' />
                    </div>
                  </div>
                  <div className='flex gap-2'>
                    <div className='bg-muted/40 text-muted-foreground flex size-12 items-center justify-center rounded-xl'>
                      <IconGithub className='size-6' strokeWidth={1.7} />
                    </div>
                    <div className='bg-muted/40 text-muted-foreground flex size-12 items-center justify-center rounded-xl'>
                      <Mail className='size-6' strokeWidth={1.7} />
                    </div>
                  </div>
                </div>
              )}
              {step.number === '2' && (
                <div className='mt-10 space-y-4'>
                  <div className='text-muted-foreground flex items-center gap-3'>
                    <div className='bg-muted/40 flex size-10 items-center justify-center rounded-xl'>
                      <Icon className='size-5' strokeWidth={1.7} />
                    </div>
                    <div className='flex gap-1.5'>
                      <span className='bg-border h-2 w-12 rounded-full' />
                      <span className='bg-border/70 h-2 w-12 rounded-full' />
                      <span className='bg-border/50 h-2 w-12 rounded-full' />
                      <span className='bg-border/40 h-2 w-12 rounded-full' />
                    </div>
                  </div>
                  <div className='max-w-[270px] space-y-2 text-sm'>
                    {[
                      ['Apr 1', '$99'],
                      ['Mar 30', '$10'],
                    ].map(([date, amount]) => (
                      <div
                        key={date}
                        className='bg-muted/70 text-muted-foreground flex items-center gap-2 rounded-md px-3 py-2'
                      >
                        <span className='shrink-0'>{date}</span>
                        <span className='bg-border/80 h-2 min-w-0 flex-1 rounded-full' />
                        <span className='bg-border/70 h-2 w-14 rounded-full' />
                        <span className='text-foreground ml-1 shrink-0 text-base font-medium'>
                          {amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {step.number === '3' && (
                <div className='mt-10 space-y-3'>
                  <div className='flex items-center gap-3'>
                    <div className='bg-muted/40 text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl'>
                      <Icon className='size-5' strokeWidth={1.7} />
                    </div>
                    <div className='bg-muted/70 text-muted-foreground min-w-0 flex-1 truncate rounded-md px-3 py-2 text-sm'>
                      EMO_API_KEY
                    </div>
                  </div>
                  <div className='bg-muted/70 text-muted-foreground rounded-md px-3 py-2 text-sm tracking-[0.28em]'>
                    ••••••••••••••••
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
