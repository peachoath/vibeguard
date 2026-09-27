import { useEffect, useState } from 'react'
import { Segmented } from '@/components/Segmented'
import { SaveButton } from '@/components/SaveButton'
import { SectionSkeleton } from '@/components/Skeleton'
import { toast } from '@/components/toast'
import { useLeaveGuard } from '../leaveGuard'
import type { Severity, UserSettings } from '../types'
import { useSettings, useUpdateSettings } from '../useUser'

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
]

/** 스캔 정책 — 최소 심각도(즉시 저장) + 제외 경로(명시 저장). */
export function PolicySection() {
  const { data: settings, isPending, isError } = useSettings()

  if (isPending) return <SectionSkeleton />
  if (isError || !settings) return <p className="section-error">설정을 불러오지 못했습니다.</p>

  return <PolicyForm initial={settings} />
}

function PolicyForm({ initial }: { initial: UserSettings }) {
  const update = useUpdateSettings()
  const { setDirty } = useLeaveGuard()
  const [excludedText, setExcludedText] = useState(initial.excludedPaths.join('\n'))
  const [success, setSuccess] = useState(false)

  const pathsDirty = excludedText !== initial.excludedPaths.join('\n')

  useEffect(() => {
    setDirty(pathsDirty)
    return () => setDirty(false)
  }, [pathsDirty, setDirty])

  function savePaths() {
    const excludedPaths = excludedText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    setSuccess(false)
    update.mutate(
      { excludedPaths },
      {
        onSuccess: () => {
          setSuccess(true)
          setTimeout(() => setSuccess(false), 1600)
          toast.success('제외 경로를 저장했어요')
        },
        onError: () => toast.error('저장에 실패했어요'),
      },
    )
  }

  return (
    <div className="section">
      <header className="section-head">
        <h2 className="section-title">스캔 정책</h2>
        <p className="section-sub">스캔 결과에 적용할 기본 임계값과 제외 범위예요.</p>
      </header>

      <div className="tile-group">
        <div className="tile-row tile-row-stack">
          <div className="tile-row-text">
            <span className="tile-row-title">최소 심각도</span>
            <span className="tile-row-desc">이 심각도 이상만 결과/알림에 노출해요.</span>
          </div>
          <Segmented<Severity>
            ariaLabel="최소 심각도"
            value={initial.minSeverity}
            onChange={(v) =>
              update.mutate({ minSeverity: v }, { onSuccess: () => toast.success('최소 심각도를 변경했어요') })
            }
            options={SEVERITIES}
          />
        </div>
      </div>

      <div className="tile-group">
        <label className="tile-field">
          <span className="tile-field-label">스캔 제외 경로</span>
          <span className="tile-field-hint">한 줄에 하나씩 (glob 지원). 예: dist/**</span>
          <textarea
            className="tile-input tile-textarea"
            rows={5}
            value={excludedText}
            placeholder={'dist/**\nnode_modules/**\n**/*.test.ts'}
            onChange={(e) => setExcludedText(e.target.value)}
          />
        </label>
      </div>

      <div className="section-actions">
        <SaveButton
          idleLabel="제외 경로 저장"
          onClick={savePaths}
          disabled={!pathsDirty}
          pending={update.isPending}
          success={success}
        />
        {pathsDirty && <span className="dirty-hint">저장 안 된 변경</span>}
      </div>
    </div>
  )
}
