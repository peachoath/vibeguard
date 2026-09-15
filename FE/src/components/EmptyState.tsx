import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <div className="empty-state-title">{title}</div>
      {description && <p className="empty-state-desc">{description}</p>}
      {action && (
        <button
          type="button"
          className="btn-primary empty-state-btn"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
