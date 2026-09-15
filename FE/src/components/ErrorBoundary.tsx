import { AlertCircle, RefreshCw } from 'lucide-react'
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}
interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="error-boundary">
          <AlertCircle size={22} />
          <div className="error-boundary-title">문제가 발생했어요</div>
          <p className="error-boundary-desc">{this.state.error.message}</p>
          <button type="button" className="btn-ghost" onClick={this.handleReset}>
            <RefreshCw size={13} />
            다시 시도
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
