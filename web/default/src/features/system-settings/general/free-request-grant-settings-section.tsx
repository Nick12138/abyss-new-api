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
import { z } from 'zod'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { getPricing } from '@/features/pricing/api'
import type { PricingModel } from '@/features/pricing/types'

// Schema matches the backend FreeRequestGrantSetting struct JSON tags exactly
const schema = z.object({
  enabled: z.boolean(),
  group: z.string(),
  admin_switch_enabled: z.boolean(),
  admin_switch_count: z.coerce.number().int().min(0),
  admin_switch_valid_hours: z.coerce.number().int().min(1),
  daily_balance_enabled: z.boolean(),
  daily_balance_count: z.coerce.number().int().min(0),
  daily_balance_threshold: z.coerce.number().min(0),
  deduct_count_per_success: z.coerce.number().int().min(1),
  model_deduct_counts: z.record(z.string(), z.coerce.number().int().min(1)),
})

type Values = z.infer<typeof schema>

const DEFAULT_VALUES: Values = {
  enabled: false,
  group: '',
  admin_switch_enabled: true,
  admin_switch_count: 500,
  admin_switch_valid_hours: 72,
  daily_balance_enabled: true,
  daily_balance_count: 100,
  daily_balance_threshold: 0,
  deduct_count_per_success: 1,
  model_deduct_counts: {},
}

function parseSetting(jsonStr?: string): Values {
  if (!jsonStr) return { ...DEFAULT_VALUES }
  try {
    const parsed = JSON.parse(jsonStr)
    return {
      enabled: parsed.enabled ?? DEFAULT_VALUES.enabled,
      group: parsed.group ?? DEFAULT_VALUES.group,
      admin_switch_enabled:
        parsed.admin_switch_enabled ?? DEFAULT_VALUES.admin_switch_enabled,
      admin_switch_count:
        parsed.admin_switch_count ?? DEFAULT_VALUES.admin_switch_count,
      admin_switch_valid_hours:
        parsed.admin_switch_valid_hours ?? DEFAULT_VALUES.admin_switch_valid_hours,
      daily_balance_enabled:
        parsed.daily_balance_enabled ?? DEFAULT_VALUES.daily_balance_enabled,
      daily_balance_count:
        parsed.daily_balance_count ?? DEFAULT_VALUES.daily_balance_count,
      daily_balance_threshold:
        parsed.daily_balance_threshold ?? DEFAULT_VALUES.daily_balance_threshold,
      deduct_count_per_success: Math.max(
        1,
        parsed.deduct_count_per_success ??
          DEFAULT_VALUES.deduct_count_per_success,
      ),
      model_deduct_counts: parsed.model_deduct_counts ?? {},
    }
  } catch {
    return { ...DEFAULT_VALUES }
  }
}

export function FreeRequestGrantSettingsSection({
  defaultValues: defaultValuesJson,
}: {
  defaultValues: string
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const parsedDefaults = parseSetting(defaultValuesJson)

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: parsedDefaults,
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')
  const group = form.watch('group')
  const adminSwitchEnabled = form.watch('admin_switch_enabled')
  const dailyBalanceEnabled = form.watch('daily_balance_enabled')
  const modelDeductCounts = form.watch('model_deduct_counts')
  const defaultDeductCount = form.watch('deduct_count_per_success')

  // Fetch pricing data to get models for the target group
  const { data: pricingData, refetch: refetchPricing } = useQuery({
    queryKey: ['pricing'],
    queryFn: getPricing,
    staleTime: 5 * 60 * 1000,
    enabled: false, // Don't auto-fetch, only on button click
  })

  const modelsInGroup = useMemo(() => {
    if (!pricingData?.data || !group) return []
    const groupName = group.trim().toLowerCase()
    return pricingData.data
      .filter((m: PricingModel) =>
        m.enable_groups?.some((g: string) => g.toLowerCase() === groupName),
      )
      .map((m: PricingModel) => m.model_name)
      .sort((a: string, b: string) => a.localeCompare(b))
  }, [pricingData, group])

  const handleFetchModels = useCallback(async () => {
    if (!group.trim()) {
      toast.error(t('Please enter a target group first'))
      return
    }
    const result = await refetchPricing()
    if (!result.data?.data) {
      toast.error(t('Failed to fetch pricing data'))
      return
    }
    const groupName = group.trim().toLowerCase()
    const models = result.data.data
      .filter((m: PricingModel) =>
        m.enable_groups?.some((g: string) => g.toLowerCase() === groupName),
      )
      .map((m: PricingModel) => m.model_name)
      .sort((a: string, b: string) => a.localeCompare(b))

    if (models.length === 0) {
      toast.info(t('No models found for group {{group}}', { group }))
      return
    }

    // Merge: keep existing overrides, add new models with default count
    const currentCounts = form.getValues('model_deduct_counts')
    const defaultCount = form.getValues('deduct_count_per_success') || 1
    const newCounts: Record<string, number> = {}
    for (const modelName of models) {
      newCounts[modelName] = (currentCounts as Record<string, number>)[modelName] ?? defaultCount
    }
    form.setValue('model_deduct_counts', newCounts, { shouldDirty: true })
    toast.success(
      t('Loaded {{count}} models for group {{group}}', {
        count: models.length,
        group,
      }),
    )
  }, [form, group, refetchPricing, t])

  const handleRemoveModel = useCallback(
    (modelName: string) => {
      const current = { ...form.getValues('model_deduct_counts') }
      delete (current as Record<string, number>)[modelName]
      form.setValue('model_deduct_counts', current, { shouldDirty: true })
    },
    [form],
  )

  const handleModelCountChange = useCallback(
    (modelName: string, value: string) => {
      const numVal = parseInt(value, 10)
      if (isNaN(numVal) || numVal < 1) return
      const current = { ...form.getValues('model_deduct_counts') }
      ;(current as Record<string, number>)[modelName] = numVal
      form.setValue('model_deduct_counts', current, { shouldDirty: true })
    },
    [form],
  )

  const handleClearModels = useCallback(() => {
    form.setValue('model_deduct_counts', {}, { shouldDirty: true })
  }, [form])

  async function onSubmit(values: Values) {
    const jsonStr = JSON.stringify(values)
    await updateOption.mutateAsync({
      key: 'FreeRequestGrantSetting',
      value: jsonStr,
    })
    form.reset(values)
  }

  const modelEntries = useMemo(() => {
    const counts = modelDeductCounts ?? {}
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
  }, [modelDeductCounts])

  return (
    <SettingsSection title={t('Free Request Grants')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel={t('Save free request grant settings')}
          />
          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable free request grants')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Allow users in a specific group to use free requests per day'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending || isSubmitting}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          {enabled && (
            <div className='space-y-6'>
              <FormField
                control={form.control}
                name='group'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Target group')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('e.g. free')} {...field} />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Only users in this group can receive and use free requests'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='admin_switch_enabled'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Enable registration grant')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Grant free requests when admin switches user to the target group'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={updateOption.isPending || isSubmitting}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />

              {adminSwitchEnabled && (
              <div className='grid gap-6 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='admin_switch_count'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Registration grant count')}</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={0}
                          placeholder='500'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Number of free requests granted when admin switches user to the target group'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='admin_switch_valid_hours'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('Registration grant expire hours')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={1}
                          placeholder='72'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Hours until the registration grant expires')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              )}

              <FormField
                control={form.control}
                name='daily_balance_enabled'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Enable daily grant')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Grant free requests daily when user balance meets the threshold'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={updateOption.isPending || isSubmitting}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />

              {dailyBalanceEnabled && (
              <div className='grid gap-6 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='daily_balance_count'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Daily grant count')}</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={0}
                          placeholder='100'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Number of free requests granted daily when balance meets threshold'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='daily_balance_threshold'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('Daily grant balance threshold')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={0}
                          step={0.1}
                          placeholder='0'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Minimum balance required to receive daily free requests (in quota units, 0 = no threshold)'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              )}

              <FormField
                control={form.control}
                name='deduct_count_per_success'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Default deduct count per success')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={1}
                        placeholder='1'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Default number of free request quota deducted per successful request for models not in the list below (minimum 1)'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Model-specific deduct counts */}
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <div>
                    <FormLabel>{t('Model deduct counts')}</FormLabel>
                    <FormDescription className='mt-1'>
                      {t(
                        'Configure different deduct counts for specific models. Models not listed will use the default count.'
                      )}
                    </FormDescription>
                  </div>
                  <div className='flex gap-2'>
                    {modelEntries.length > 0 && (
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={handleClearModels}
                      >
                        {t('Clear all')}
                      </Button>
                    )}
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={handleFetchModels}
                      disabled={!group.trim()}
                    >
                      {t('Fetch models from group')}
                    </Button>
                  </div>
                </div>

                {modelEntries.length > 0 ? (
                  <div className='border-border overflow-hidden rounded-md border'>
                    <div className='bg-muted/50 grid grid-cols-[1fr_100px_40px] gap-2 border-b px-3 py-2 text-xs font-medium'>
                      <span>{t('Model')}</span>
                      <span>{t('Count')}</span>
                      <span></span>
                    </div>
                    <div className='divide-border/60 divide-y max-h-80 overflow-y-auto'>
                      {modelEntries.map(([modelName, count]) => (
                        <div
                          key={modelName}
                          className='grid grid-cols-[1fr_100px_40px] items-center gap-2 px-3 py-1.5'
                        >
                          <span
                            className='truncate text-sm font-mono'
                            title={modelName}
                          >
                            {modelName}
                          </span>
                          <Input
                            type='number'
                            min={1}
                            value={count as number}
                            onChange={(e) =>
                              handleModelCountChange(modelName, e.target.value)
                            }
                            className='h-7 text-sm tabular-nums'
                          />
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            className='h-7 w-7 p-0 text-muted-foreground hover:text-destructive'
                            onClick={() => handleRemoveModel(modelName)}
                            title={t('Remove')}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className='text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center text-sm'>
                    {t(
                      'No model-specific counts configured. Click "Fetch models from group" to load models for the target group.'
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
