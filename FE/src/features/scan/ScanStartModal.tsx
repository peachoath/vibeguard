import { useMutation } from '@tanstack/react-query'
import { GitBranch, Play, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/toast'

export interface ScanStartRepo {
  id: string
  fullName: string
  defaultBranch?: string
}

interface Props {
  repo: ScanStartRepo
  onClose: () => void
}

export function ScanStartModal({ repo, onClose }: Props) {
  const navigate  = useNavigate()
  const [ref, setRef] = useState(repo.defaultBranch ?? 'main')
  const inputRef  = useRef<HTMLInputElement>(null)

  // ESC 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // 열릴 때 포커스
  useEffect(() => { inputRef.current?.focus() }, [])

  const startScan = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>('/scans', {
        method: 'POST',
        body: JSON.stringify({ repositoryId: repo.id, ref: ref.trim() }),
      }),
    onSuccess: scan => {
      toast.success(`${repo.fullName} 스캔을 시작했어요.`)
      navigate(`/scans/${scan.id}/live`)
    },
    onError: () => toast.error('스캔을 시작하지 못했어요.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ref.trim() || startScan.isPending) return
    startScan.mutate()
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} aria-hidden>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-labelledby="scan-modal-title"
      >
        {/* 헤더 */}
        <div className="modal-header">
          <span className="modal-title" id="scan-modal-title">
            <GitBranch size={14} />
            스캔 시작
          </span>
          <button type="button" className="btn-ghost modal-close" onClick={onClose} aria-label="닫기">
            <X size={14} />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="modal-repo-name">{repo.fullName}</div>

          <label className="modal-label" htmlFor="scan-ref">
            브랜치 / 태그 / 커밋 SHA
          </label>
          <input
            ref={inputRef}
            id="scan-ref"
            type="text"
            className="modal-input"
            value={ref}
            onChange={e => setRef(e.target.value)}
            placeholder="main"
            required
            spellCheck={false}
            autoComplete="off"
          />
          <p className="modal-hint">
            비워두면 기본 브랜치({repo.defaultBranch ?? 'main'})로 스캔해요.
          </p>

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>
              취소
            </button>
            <button
              type="submit"
              className="btn-primary modal-submit"
              disabled={startScan.isPending || !ref.trim()}
            >
              <Play size={12} />
              {startScan.isPending ? '시작 중…' : '스캔 시작'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
