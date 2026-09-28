import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from './toast'

/** 값을 클립보드로 복사하고 짧게 체크 표시 + 토스트. */
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${label ?? '값'}을(를) 복사했어요`)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      toast.error('복사에 실패했어요')
    }
  }

  return (
    <button
      type="button"
      className="copy-btn"
      onClick={copy}
      aria-label={`${label ?? value} 복사`}
      title="복사"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}
