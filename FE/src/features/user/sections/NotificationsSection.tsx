import { Switch } from '@/components/Switch'
import { useSettings, useUpdateSettings } from '../useUser'

/** 알림 — 이메일 알림 등 토글. 토글 즉시 저장(토스 UX). */
export function NotificationsSection() {
  const { data: settings, isPending, isError } = useSettings()
  const update = useUpdateSettings()

  if (isPending) return <div className="section section-loading">불러오는 중…</div>
  if (isError || !settings) return <p className="section-error">설정을 불러오지 못했습니다.</p>

  return (
    <div className="section">
      <header className="section-head">
        <h2 className="section-title">알림</h2>
        <p className="section-sub">스캔 상태를 어떻게 받아볼지 설정해요.</p>
      </header>

      <div className="tile-group">
        <div className="tile-row">
          <div className="tile-row-text">
            <span className="tile-row-title">이메일 알림</span>
            <span className="tile-row-desc">스캔이 끝나면 이메일로 결과를 받아요.</span>
          </div>
          <Switch
            label="이메일 알림"
            checked={settings.notifyEmail}
            disabled={update.isPending}
            onChange={(next) => update.mutate({ notifyEmail: next })}
          />
        </div>
      </div>
    </div>
  )
}
