import { Mail, Slack, Webhook } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { SectionSkeleton } from '@/components/Skeleton'
import { Switch } from '@/components/Switch'
import { toast } from '@/components/toast'
import { useProfile, useSettings, useUpdateSettings } from '../useUser'

/** 알림 채널 설정. 이메일(즉시 저장) + Webhook·Slack(준비 중). */
export function NotificationsSection() {
  const { data: settings, isPending, isError } = useSettings()
  const { data: profile } = useProfile()
  const update = useUpdateSettings()
  const navigate = useNavigate()

  if (isPending) return <SectionSkeleton />
  if (isError || !settings) return <p className="section-error">설정을 불러오지 못했습니다.</p>

  const active = settings.notifyEmail

  function emailDesc() {
    if (!active) return '스캔이 끝나면 결과를 이메일로 보내드려요.'
    if (profile?.email) return profile.email
    return '이메일 없음 — 프로필에서 먼저 등록해주세요.'
  }

  return (
    <div className="section">
      <header className="section-head">
        <h2 className="section-title">알림</h2>
        <p className="section-sub">스캔 결과를 어떻게 받아볼지 설정해요.</p>
      </header>

      <div className="notif-status">
        <span className={`notif-dot${active ? ' notif-dot--on' : ''}`} />
        {active ? '이메일 알림 켜짐' : '모든 알림 꺼짐'}
      </div>

      <div className="tile-group">
        {/* 이메일 */}
        <div className="tile-row">
          <div className="notif-ch-left">
            <div className="notif-ch-icon">
              <Mail size={16} />
            </div>
            <div className="tile-row-text">
              <span className="tile-row-title">이메일</span>
              <span className={`tile-row-desc${active && !profile?.email ? ' notif-desc-warn' : ''}`}>
                {emailDesc()}
              </span>
            </div>
          </div>
          <Switch
            label="이메일 알림"
            checked={active}
            disabled={update.isPending}
            onChange={(next) =>
              update.mutate(
                { notifyEmail: next },
                {
                  onSuccess: () =>
                    toast.success(next ? '이메일 알림을 켰어요' : '이메일 알림을 껐어요'),
                  onError: () => toast.error('저장에 실패했어요'),
                },
              )
            }
          />
        </div>

        {/* Webhook — 준비 중 */}
        <div className="tile-row notif-coming">
          <div className="notif-ch-left">
            <div className="notif-ch-icon notif-ch-icon--muted">
              <Webhook size={16} />
            </div>
            <div className="tile-row-text">
              <span className="tile-row-title">
                Webhook
                <span className="notif-chip">준비 중</span>
              </span>
              <span className="tile-row-desc">외부 시스템으로 스캔 이벤트를 전송해요.</span>
            </div>
          </div>
        </div>

        {/* Slack — 준비 중 */}
        <div className="tile-row notif-coming">
          <div className="notif-ch-left">
            <div className="notif-ch-icon notif-ch-icon--muted">
              <Slack size={16} />
            </div>
            <div className="tile-row-text">
              <span className="tile-row-title">
                Slack
                <span className="notif-chip">준비 중</span>
              </span>
              <span className="tile-row-desc">Slack 채널로 실시간 스캔 알림을 받아요.</span>
            </div>
          </div>
        </div>
      </div>

      <p className="notif-footer">
        알림을 받을 심각도 기준은{' '}
        <button type="button" className="notif-footer-link" onClick={() => navigate('/settings/policy')}>
          스캔 정책
        </button>
        에서 관리해요.
      </p>
    </div>
  )
}
