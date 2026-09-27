"use client";
import { useState } from "react";

const TABS = [
  {
    key: "urllib3",
    label: "urllib3",
    cve: "CVE-2023-43804",
    title: "urllib3 1.24.1 → 2.0.7 · 보안 패치",
    file: "requirements.txt",
    changes: [
      { type: "del", line: "urllib3==1.24.1" },
      { type: "add", line: "urllib3==2.0.7" },
    ],
  },
  {
    key: "requests",
    label: "requests",
    cve: "CVE-2023-32681",
    title: "requests 2.18.4 → 2.31.0 · 보안 패치",
    file: "requirements.txt",
    changes: [
      { type: "del", line: "requests==2.18.4" },
      { type: "add", line: "requests==2.31.0" },
    ],
  },
  {
    key: "certifi",
    label: "certifi",
    cve: "CVE-2023-37920",
    title: "certifi 2018.4.16 → 2023.7.22 · 보안 패치",
    file: "requirements.txt",
    changes: [
      { type: "del", line: "certifi==2018.4.16" },
      { type: "add", line: "certifi==2023.7.22" },
    ],
  },
] as const;

export default function PRTabs() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];

  return (
    <div className="pre-card pre-pr">
      <div className="pre-card-head">
        <span className="pre-card-label">자동 생성 PR</span>
        <span className="pre-pr-status">열림</span>
      </div>

      <div className="pr-tab-list" role="tablist">
        {TABS.map((t, i) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={i === active}
            className={`pr-tab${i === active ? " active" : ""}`}
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pre-pr-title">
        <span className="pre-pr-tag">[VibeGuard]</span>{" "}
        {tab.title}
      </div>

      <div className="pre-diff">
        <div className="pre-diff-file">
          {tab.file} · <span style={{ color: "#748092" }}>{tab.cve}</span>
        </div>
        {tab.changes.map((c, i) =>
          c.type === "del" ? (
            <div key={i} className="pre-diff-line pre-diff-del">
              <span>−</span>{c.line}
            </div>
          ) : (
            <div key={i} className="pre-diff-line pre-diff-add">
              <span>+</span>{c.line}
            </div>
          )
        )}
      </div>

      <div className="pre-pr-checks">
        <div className="pre-check pre-check-pass">
          <span className="pre-check-dot" />
          회귀 테스트 24 / 24 통과
        </div>
        <div className="pre-check pre-check-pass">
          <span className="pre-check-dot" />
          NVD · OSV · GHSA 검증 완료
        </div>
        <div className="pre-check pre-check-warn">
          <span className="pre-check-dot warn" />
          머지는 사람이 결정합니다
        </div>
      </div>
    </div>
  );
}
