import { Home, SearchX } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="notfound-page">
      <div className="notfound-icon">
        <SearchX size={40} />
      </div>
      <div className="notfound-code">404</div>
      <h1 className="notfound-title">페이지를 찾을 수 없어요</h1>
      <p className="notfound-desc">주소가 잘못됐거나 삭제된 페이지예요.</p>
      <button type="button" className="btn-primary notfound-btn" onClick={() => navigate('/')}>
        <Home size={14} />
        홈으로 돌아가기
      </button>
    </div>
  )
}
