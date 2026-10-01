"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppHeader from "../../components/app-header";
import ScreenContent from "../../components/screen-content";
import { Sk } from "../../components/skeleton";
import { ErrorView } from "../../components/error-view";
import { useFinding } from "@/lib/queries";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const SEVERITY_LABELS: Record<string, string> = {
  CRITICAL: "치명적", HIGH: "높음", MEDIUM: "보통", LOW: "낮음",
};
const VERDICT_LABELS: Record<string, string> = {
  PATCH: "패치", IGNORE: "무시", MANUAL: "수동 확인",
};

/** verdict가 null/미지정일 수 있어(아직 판정 안 된 OPEN finding) 안전하게 처리. */
function verdictClass(v: string | null | undefined): string {
  if (v === "PATCH") return "patch";
  if (v === "MANUAL") return "manual";
  if (v === "IGNORE") return "ignore";
  return "neutral";
}
function verdictLabel(v: string | null | undefined): string {
  return (v && VERDICT_LABELS[v]) || "미판정";
}

export default function FindingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const findingQuery = useFinding(id);
  const finding = findingQuery.data ?? null;
  const loading = findingQuery.isPending;
  const error = findingQuery.isError;

  return (
    <main className="results-page">
      <AppHeader active="results" />
      <ScreenContent>
        <section className="results-heading">
          <div>
            <h1>Finding 상세</h1>
            <p>
              {loading ? <Sk w={180} h={14} style={{ display: "inline-block" }} /> :
               finding ? `${finding.packageName ?? finding.filePath ?? "알 수 없음"} · ${finding.severity}` : "—"}
            </p>
          </div>
          <div className="results-actions">
            <button className="secondary-button" onClick={() => router.back()}>← 돌아가기</button>
          </div>
        </section>

        {loading && (
          <div className="finding-detail-card" aria-hidden="true">
            <dl className="finding-meta">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i}>
                  <Sk w={60} h={10} r={3} />
                  <Sk w={90} h={16} r={4} style={{ marginTop: 6 }} />
                </div>
              ))}
            </dl>
            <div className="finding-description">
              <Sk w={60} h={16} r={4} />
              <Sk w="100%" h={13} r={4} style={{ marginTop: 12 }} />
              <Sk w="80%" h={13} r={4} style={{ marginTop: 6 }} />
            </div>
          </div>
        )}

        {error && !loading && <ErrorView onRetry={() => findingQuery.refetch()} />}

        {finding && !loading && (
          <div className="finding-detail-card">
            <dl className="finding-meta">
              <div>
                <dt>CVE</dt>
                <dd>{finding.cveId ?? "-"}</dd>
              </div>
              <div>
                <dt>CWE</dt>
                <dd>{finding.cweId ?? "-"}</dd>
              </div>
              <div>
                <dt>심각도</dt>
                <dd>
                  <span className={`severity-badge ${finding.severity.toLowerCase()}`}>
                    {SEVERITY_LABELS[finding.severity] ?? finding.severity}
                  </span>
                </dd>
              </div>
              <div>
                <dt>CVSS 점수</dt>
                <dd>{finding.cvssScore ?? "-"}</dd>
              </div>
              <div>
                <dt>판정</dt>
                <dd>
                  <span className={`finding-verdict ${verdictClass(finding.verdict)}`}>
                    {verdictLabel(finding.verdict)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>상태</dt>
                <dd>{finding.status}</dd>
              </div>
              {finding.packageName && (
                <div>
                  <dt>패키지</dt>
                  <dd>{finding.packageName}</dd>
                </div>
              )}
              {finding.currentVersion && finding.recommendedVersion && (
                <div>
                  <dt>버전 변경</dt>
                  <dd>{finding.currentVersion} → {finding.recommendedVersion}</dd>
                </div>
              )}
              {finding.filePath && (
                <div>
                  <dt>파일</dt>
                  <dd>{finding.filePath}{finding.lineStart ? `:${finding.lineStart}` : ""}</dd>
                </div>
              )}
              {finding.manifestPath && (
                <div>
                  <dt>Manifest</dt>
                  <dd>{finding.manifestPath}</dd>
                </div>
              )}
            </dl>

            {finding.rationale && (
              <div className="finding-description">
                <h3>판정 근거</h3>
                <p>{finding.rationale}</p>
              </div>
            )}

            {finding.snippet && (
              <div className="finding-remediation">
                <h3>탐지 근거</h3>
                <pre>{finding.snippet}</pre>
              </div>
            )}

            <div className="finding-detail-actions">
              {finding.hasPatch ? (
                <>
                  <a href={`${API_BASE}/api/v1/findings/${id}/evidence`} target="_blank" rel="noreferrer">
                    회귀 증거 JSON
                  </a>
                  <a href={`${API_BASE}/api/v1/findings/${id}/diff`} target="_blank" rel="noreferrer">
                    패치 Diff JSON
                  </a>
                </>
              ) : (
                <span>패치가 생성되지 않아 회귀 증거와 Diff가 없습니다.</span>
              )}
              <Link href={`/results?scanId=${finding.scanId}`}>← 목록으로</Link>
            </div>
          </div>
        )}
      </ScreenContent>
    </main>
  );
}
