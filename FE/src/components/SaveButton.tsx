import { Check, Loader2 } from 'lucide-react'

/** 저장 버튼 3단 상태: 대기 → 로딩(스피너) → 성공(체크 플래시). */
export function SaveButton({
  onClick,
  disabled,
  pending,
  success,
  idleLabel = '변경사항 저장',
}: {
  onClick: () => void
  disabled?: boolean
  pending?: boolean
  success?: boolean
  idleLabel?: string
}) {
  return (
    <button
      type="button"
      className={`btn-primary-sm save-btn${success ? ' is-success' : ''}`}
      onClick={onClick}
      disabled={disabled || pending}
    >
      {pending ? (
        <>
          <Loader2 size={15} className="spin" /> 저장 중…
        </>
      ) : success ? (
        <>
          <Check size={15} /> 저장됨
        </>
      ) : (
        idleLabel
      )}
    </button>
  )
}
