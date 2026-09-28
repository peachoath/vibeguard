"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "../components/app-header";
import ScreenContent from "../components/screen-content";
import { apiFetch, apiSseUrl, ApiError } from "@/lib/api";

interface ScanDto {
  id: string;
  repositoryId: string;
  ref: string;
  status: string;
}

interface SseStageEvent {
  scanId: string;
  kind: "stage";
  stage: string;
  agent?: number;
  status?: string;
}

interface SseLogEvent {
  scanId: string;
  kind: "log";
  agent?: number;
  payload: { level: string; message: string; ts: string };
}

interface SseDoneEvent {
  scanId: string;
  kind: "done";
  status?: string;
}

const STAGE_ORDER = ["CLONING", "SCANNING", "VERIFYING", "REGRESSION_CHECK", "PR_CREATING"];
const STAGE_LABELS: Record<string, string> = {
  CLONING: "클론",
  SCANNING: "A1 탐지",
  VERIFYING: "A2 검증",
  REGRESSION_CHECK: "A3 회귀 검증",
  PR_CREATING: "A4 PR 작성",
};

function ScanContent() {
  const params = useSearchParams();
  const router = useRouter();
  const repoId = params.get("repoId");
  const ref = params.get("ref") ?? "main";

  const [scan, setScan] = useState<ScanDto | null>(null);
  const [currentStage, setCurrentStage] = useState("");
  const [stageStatus, setStageStatus] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<{ ts: string; agent: number; level: string; message: string }[]>([]);
  const [done, setDone] = useState(false);
  const [finalStatus, setFinalStatus] = useState("");
  const [error, setError] = useState("");
  const [reconnecting, setReconnecting] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const activityListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!repoId) { setError("저장소 정보가 없습니다."); return; }

    apiFetch<ScanDto>("/api/v1/scans", {
      method: "POST",
      body: JSON.stringify({ repositoryId: repoId, ref }),
    })
      .then((s) => {
        setScan(s);
        subscribeStream(s.id);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 409) {
          setReconnecting(true);
          apiFetch<ScanDto[]>("/api/v1/scans")
            .then((scans) => {
              const TERMINAL = ["COMPLETED", "NO_FINDINGS", "PATCH_FAILED", "REGRESSION_BLOCKED", "FAILED", "AGENT_NOT_CONFIGURED", "MCP_NOT_AVAILABLE", "INSTALL_FAILED", "NO_TESTS"];
              const active = scans.find(
                (s) => s.repositoryId === repoId && s.ref === ref && !TERMINAL.includes(s.status),
              );
              setReconnecting(false);
              if (active) {
                setScan(active);
                subscribeStream(active.id);
              } else {
                setError("이미 진행 중인 스캔을 찾을 수 없습니다.");
              }
            })
            .catch(() => { setReconnecting(false); setError("이미 진행 중인 스캔을 찾을 수 없습니다."); });
        } else {
          setError(e.message);
        }
      });

    return () => esRef.current?.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId, ref]);

  function subscribeStream(scanId: string) {
    // SseHub.broadcast()는 named events(event: stage, event: log, event: done)를 전송한다.
    // EventSource.onmessage는 unnamed events(event 헤더 없음)에만 반응하므로
    // 반드시 addEventListener로 각 이벤트를 수신해야 한다.
    const es = new EventSource(apiSseUrl(`/api/v1/scans/${scanId}/stream`), { withCredentials: true });
    esRef.current = es;

    es.addEventListener("stage", (e: MessageEvent) => {
      const evt: SseStageEvent = JSON.parse(e.data);
      if (evt.stage) {
        setCurrentStage(evt.stage);
        setStageStatus((prev) => ({ ...prev, [evt.stage]: evt.status ?? "RUNNING" }));
      }
    });

    es.addEventListener("log", (e: MessageEvent) => {
      const evt: SseLogEvent = JSON.parse(e.data);
      if (evt.payload) {
        setLogs((prev) => [
          ...prev.slice(-100),
          { ts: evt.payload.ts, agent: evt.agent ?? 0, level: evt.payload.level, message: evt.payload.message },
        ]);
      }
    });

    es.addEventListener("done", (e: MessageEvent) => {
      const evt: SseDoneEvent = JSON.parse(e.data);
      setDone(true);
      setFinalStatus(evt.status ?? "COMPLETED");
      es.close();
    });

    es.onerror = () => {
      // 연결 오류 시 닫기. 재연결은 브라우저 기본 동작에 맡기지 않고 명시적으로 차단.
      es.close();
    };
  }

  const stageIndex = STAGE_ORDER.indexOf(currentStage);
  const progress = done ? 100 : Math.min(95, Math.round(((stageIndex + 1) / STAGE_ORDER.length) * 100));

  useEffect(() => {
    const list = activityListRef.current;
    if (!list) return;

    const frame = requestAnimationFrame(() => {
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    });

    return () => cancelAnimationFrame(frame);
  }, [logs.length]);

  if (reconnecting) {
    return (
      <main className="scan-page">
        <AppHeader active="scan" />
        <ScreenContent>
          <p className="scan-error">이미 진행 중인 스캔이 있습니다. 연결 중…</p>
        </ScreenContent>
      </main>
    );
  }

  if (error) {
    return (
      <main className="scan-page">
        <AppHeader active="scan" />
        <ScreenContent>
          <p className="scan-error">{error}</p>
          <Link href="/repositories">저장소로 돌아가기</Link>
        </ScreenContent>
      </main>
    );
  }

  return (
    <main className="scan-page">
      <AppHeader active="scan" />

      <ScreenContent>
        <section className="scan-page-heading">
          <div>
            <h1>실시간 검사</h1>
            <p>{scan ? `스캔 ${scan.id.slice(0, 8)} · ${ref} 브랜치` : "스캔 준비 중…"}</p>
          </div>
          <div className="heading-buttons">
            <Link href="/repositories">전체 저장소</Link>
          </div>
        </section>

        <div className="live-scan-layout">
          <div className="live-scan-main">
            <section className="progress-card" aria-live="polite">
              <Image className="detection-gif" src="/detect.gif" alt="보안 검사 중" width={188} height={140} unoptimized priority />
              <div className="progress-number"><span>진행도</span><strong>{progress}%</strong></div>
              <div className="progress-detail">
                <p>{done ? "검사가 완료되었습니다." : `${STAGE_LABELS[currentStage] ?? "준비 중"} 진행 중`}</p>
                <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
                <b>{done ? "검사 완료" : "진행 중"}</b>
              </div>
            </section>

            <section className="pipeline-card">
              <div className="section-title"><h2>멀티 에이전트 파이프라인</h2><p>독립 세션 + 단계별 MCP 화이트리스트</p></div>
              <div className="pipeline-grid">
                {STAGE_ORDER.slice(1).map((stage) => {
                  const st = stageStatus[stage];
                  const isDone = st === "DONE" || (done && stageIndex >= STAGE_ORDER.indexOf(stage));
                  const isActive = currentStage === stage && !isDone;
                  return (
                    <article className={`pipeline-step ${isActive ? "active" : ""} ${isDone ? "done" : ""}`} key={stage}>
                      <b>{stage.split("_")[0].slice(0, 2).toUpperCase()}</b>
                      <strong>{STAGE_LABELS[stage]}</strong>
                      <em>{isDone ? "완료" : isActive ? "진행 중" : "대기"}</em>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="activity-card">
              <div className="activity-heading"><h2>실시간 활동</h2><span>{done ? "DONE" : "LIVE"}</span></div>
              <div ref={activityListRef} className="activity-list" role="log" aria-label="실시간 활동 로그" aria-live="polite" tabIndex={0}>
                {logs.map((log, i) => (
                  <div className={`activity-row ${log.level === "ERROR" ? "danger" : log.level === "WARN" ? "warning" : ""}`} key={i}>
                    <time>{new Date(log.ts).toLocaleTimeString("ko-KR")}</time>
                    <b>A{log.agent}</b>
                    <span>{log.message}</span>
                  </div>
                ))}
                {logs.length === 0 && <p className="activity-empty">로그를 기다리는 중…</p>}
              </div>
              <p className="activity-footer">테스트 컨테이너 · network=none · read-only · cap-drop=ALL · 300s timeout</p>
            </section>
          </div>

          <aside className="verification-status">
            <div>
              <h2>{done ? "검사 완료" : "검사 진행 중"}</h2>
              <h3>{ref} 브랜치</h3>
            </div>
            <dl>
              {STAGE_ORDER.map((stage) => (
                <div key={stage}>
                  <dt>{STAGE_LABELS[stage]}</dt>
                  <dd className={
                    stageStatus[stage] === "DONE" ? "complete" :
                    currentStage === stage ? "working" : "waiting"
                  }>
                    {stageStatus[stage] === "DONE" ? "완료" :
                     currentStage === stage ? "진행 중" : "대기"}
                  </dd>
                </div>
              ))}
            </dl>
            {done ? (
              <Link className="result-button" href={`/results?scanId=${scan?.id}`} scroll={false}>
                결과 보기
              </Link>
            ) : (
              <button className="result-button" disabled>결과 보기</button>
            )}
          </aside>
        </div>
      </ScreenContent>
    </main>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <ScanContent />
    </Suspense>
  );
}
