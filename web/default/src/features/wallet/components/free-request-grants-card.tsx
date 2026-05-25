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
import { CalendarClock, Gift, ShieldCheck, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota, formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type {
  FreeRequestGrantSummary,
  FreeRequestGrantSummaryItem,
} from '../types'

interface FreeRequestGrantsCardProps {
  summary: FreeRequestGrantSummary | null
  loading?: boolean
}

function formatTime(timestamp: number) {
  return timestamp > 0 ? formatTimestampToDate(timestamp) : '-'
}

function getItemTitle(item: FreeRequestGrantSummaryItem) {
  if (item.type === 'daily_balance') return 'Daily grant'
  if (item.type === 'admin_group_switch') return 'Registration grant'
  return 'Activation status'
}

function getStatusLabel(item: FreeRequestGrantSummaryItem) {
  if (item.status === 'active') return 'Active'
  if (item.status === 'available') return 'Available on next request'
  if (item.status === 'pending') return 'Pending activation'
  if (item.status === 'used_up') return 'Used up'
  if (item.status === 'expired') return 'Invalidated'
  if (item.status === 'disabled') return 'Disabled'
  return 'Pending activation'
}

function getStatusClass(item: FreeRequestGrantSummaryItem) {
  if (item.status === 'active' || item.status === 'available') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  }
  if (item.status === 'pending') {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  }
  if (item.status === 'expired' || item.status === 'used_up') {
    return 'border-muted bg-muted text-muted-foreground'
  }
  return 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300'
}

function getDetailText(
  item: FreeRequestGrantSummaryItem,
  balanceThreshold: number,
  t: ReturnType<typeof useTranslation>['t']
) {
  if (item.type === 'activation') {
    return t('Contact an administrator to activate')
  }
  if (item.status === 'pending' && item.balance_needed) {
    return t('Balance required: {{amount}}', {
      amount: formatQuota(balanceThreshold),
    })
  }
  if (item.status === 'expired') {
    return t('Invalidated')
  }
  if (item.type === 'daily_balance') {
    return t('Resets at {{time}}', {
      time: formatTime(item.reset_time || item.end_time),
    })
  }
  return t('Expires at {{time}}', { time: formatTime(item.end_time) })
}

function getRemainingText(
  item: FreeRequestGrantSummaryItem,
  t: ReturnType<typeof useTranslation>['t']
) {
  if (item.type === 'activation') return '-'
  if (item.status === 'pending' && item.balance_needed) return '-'
  return t('{{count}} requests left', {
    count: Math.max(item.remaining || 0, 0).toLocaleString(),
  })
}

function FreeRequestGrantRow(props: {
  item: FreeRequestGrantSummaryItem
  balanceThreshold: number
}) {
  const { t } = useTranslation()
  const Icon =
    props.item.type === 'daily_balance'
      ? CalendarClock
      : props.item.type === 'admin_group_switch'
        ? Gift
        : ShieldCheck

  return (
    <div className='flex min-w-0 items-start gap-3 px-3 py-3 sm:px-5'>
      <div className='border-border bg-muted/50 mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border'>
        <Icon className='text-muted-foreground size-4' />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <div className='text-sm font-medium'>{t(getItemTitle(props.item))}</div>
          <Badge
            variant='outline'
            className={cn('h-5 rounded-md px-1.5', getStatusClass(props.item))}
          >
            {t(getStatusLabel(props.item))}
          </Badge>
        </div>
        <div className='text-muted-foreground mt-1 text-xs'>
          {getDetailText(props.item, props.balanceThreshold, t)}
        </div>
      </div>
      <div className='text-right'>
        <div className='font-mono text-sm font-semibold tabular-nums'>
          {getRemainingText(props.item, t)}
        </div>
        {props.item.total > 0 && (
          <div className='text-muted-foreground mt-1 text-xs'>
            {t('Total {{count}}', {
              count: props.item.total.toLocaleString(),
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function FreeRequestGrantsCard(props: FreeRequestGrantsCardProps) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <div className='overflow-hidden rounded-lg border'>
        <div className='px-3 py-3 sm:px-5 sm:py-4'>
          <Skeleton className='h-4 w-32' />
          <Skeleton className='mt-2 h-3.5 w-56' />
        </div>
        <div className='border-t px-3 py-3 sm:px-5'>
          <Skeleton className='h-12 w-full' />
        </div>
      </div>
    )
  }

  const summary = props.summary
  const items = summary?.items ?? []

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-5 sm:py-4'>
        <div className='flex min-w-0 items-center gap-3'>
          <div className='border-border bg-muted/50 flex size-9 shrink-0 items-center justify-center rounded-md border'>
            <Sparkles className='text-muted-foreground size-4' />
          </div>
          <div>
            <div className='text-sm font-semibold'>{t('Free requests')}</div>
            <div className='text-muted-foreground mt-0.5 text-xs'>
              {summary?.group
                ? t('Available for {{group}} models', { group: summary.group })
                : t('Available for free group models')}
            </div>
          </div>
        </div>
        {summary?.activated && (
          <Badge variant='outline' className='h-6 rounded-md'>
            {summary.user_group}
          </Badge>
        )}
      </div>

      <div className='divide-border/60 divide-y border-t'>
        {items.length > 0 ? (
          items.map((item) => (
            <FreeRequestGrantRow
              key={`${item.type}-${item.end_time}-${item.status}`}
              item={item}
              balanceThreshold={summary?.balance_threshold ?? 0}
            />
          ))
        ) : (
          <div className='text-muted-foreground px-3 py-4 text-sm sm:px-5'>
            {t('No active free request benefits')}
          </div>
        )}
      </div>
    </div>
  )
}
