"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppHeader from "../../components/app-header";
import ScreenContent from "../../components/screen-content";
import { apiFetch } from "@/lib/api";
import { Sk } from "../../components/skeleton";
import { ErrorView } from "../../components/error-view";

interface FindingDetailDto {
  id: string;
  type: string;
  ruleId: string | null;
  cveId: string | null;
  cweId: string | null;
  severity: string;
  cvssScore: number | null;
  filePath: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  manifestPath: string | null;
  packageName: string | null;
  currentVersion: string | null;
  recommendedVersion: string | null;
  verdict: string;
  status: string;
  description: string | null;
  remediationAdvice: string | null;
  references: string[] | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const SEVERITY_LABELS: Record<string, string> = {
  CRITICAL: "치명적", HIGH: "높음", MEDIUM: "보통", LOW: "낮음",
};
const VERDICT_LABELS: Record<string, string> = {
  PATCH: "패치", IGNORE: "무시", MANUAL: "수동 확인",
};

export default function FindingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [finding, setFinding] = useState<FindingDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function load() {
    if (!id) return;
    setLoading(true);
    setError(false);
    apiFetch<FindingDetailDto>(`/api/v1/findings/${id}`)
      .then(setFinding)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

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

        {error && !loading && <ErrorView onRetry={load} />}

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
                  <span className={`finding-verdict ${finding.verdict === "MANUAL" ? "manual" : finding.verdict === "IGNORE" ? "ignore" : "patch"}`}>
                    {VERDICT_LABELS[finding.verdict] ?? finding.verdict}
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

            {finding.description && (
              <div className="finding-description">
                <h3>설명</h3>
                <p>{finding.description}</p>
              </div>
            )}

            {finding.remediationAdvice && (
              <div className="finding-remediation">
                <h3>조치 방법</h3>
                <p>{finding.remediationAdvice}</p>
              </div>
            )}

            {finding.references && finding.references.length > 0 && (
              <div className="finding-references">
                <h3>참고 자료</h3>
                <ul>
                  {finding.references.map((ref) => (
                    <li key={ref}>
                      <a href={ref} target="_blank" rel="noreferrer">{ref}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="finding-detail-actions">
              <a href={`${API_BASE}/api/v1/findings/${id}/evidence`} target="_blank" rel="noreferrer">
                증거 JSON
              </a>
              <a href={`${API_BASE}/api/v1/findings/${id}/diff`} target="_blank" rel="noreferrer">
                Diff JSON
              </a>
              <Link href="/results">← 목록으로</Link>
            </div>
          </div>
        )}
      </ScreenContent>
    </main>
  );
}
