/** shimmer 스켈레톤 블록. 로딩 자리표시용. */
export function Skeleton({ height = 16, width = '100%', radius = 8 }: {
  height?: number | string
  width?: number | string
  radius?: number
}) {
  return <span className="skeleton" style={{ height, width, borderRadius: radius }} />
}

/** 카드형 섹션 로딩 자리표시(제목 + 필드 몇 줄). */
export function SectionSkeleton() {
  return (
    <div className="section" aria-hidden="true">
      <Skeleton height={22} width={140} />
      <div className="tile-group" style={{ gap: 14, padding: 18 }}>
        <Skeleton height={40} />
        <Skeleton height={40} />
      </div>
    </div>
  )
}
