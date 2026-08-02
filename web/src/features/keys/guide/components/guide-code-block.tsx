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
import { CopyButton } from '@/components/copy-button'

type GuideCodeBlockProps = {
  code: string
  language?: string
}

export function GuideCodeBlock(props: GuideCodeBlockProps) {
  return (
    <div className='bg-muted/35 overflow-hidden rounded-lg border'>
      <div className='bg-muted/50 flex items-center justify-between border-b px-3 py-1.5'>
        <span className='text-muted-foreground font-mono text-[11px] uppercase'>
          {props.language ?? 'text'}
        </span>
        <CopyButton
          value={props.code}
          size='icon'
          className='hover:bg-background/70 size-7'
        />
      </div>
      <pre className='m-0 max-w-full overflow-x-auto p-4 text-xs leading-6 sm:text-[13px]'>
        <code>{props.code}</code>
      </pre>
    </div>
  )
}
