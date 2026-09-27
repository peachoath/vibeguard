"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "../components/app-header";
import ScreenContent from "../components/screen-content";
import { apiFetch } from "@/lib/api";

interface UserProfile {
  githubId: number;
  login: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

interface UserStats {
  repositoryCount: number;
  scanCount: number;
}

interface UserSettings {
  minSeverity: string;
  excludedPaths: string[];
  notifyEmail: boolean;
}

const SEVERITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const SEVERITY_LABELS: Record<string, string> = {
  LOW: "낮음",
  MEDIUM: "보통",
  HIGH: "높음",
  CRITICAL: "치명적",
};

type Tab = "profile" | "preferences" | "account";

export default function SettingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("profile");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile edit
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Settings edit
  const [minSeverity, setMinSeverity] = useState("LOW");
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Account
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<UserProfile>("/api/v1/users/me"),
      apiFetch<UserStats>("/api/v1/users/me/stats"),
      apiFetch<UserSettings>("/api/v1/users/me/settings"),
    ])
      .then(([p, s, cfg]) => {
        setProfile(p);
        setStats(s);
        setSettings(cfg);
        setDisplayName(p.displayName);
        setEmail(p.email ?? "");
        setMinSeverity(cfg.minSeverity);
        setNotifyEmail(cfg.notifyEmail);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile() {
    setProfileSaving(true);
    try {
      const updated = await apiFetch<UserProfile>("/api/v1/users/me", {
        method: "PATCH",
        body: JSON.stringify({ displayName, email: email || null }),
      });
      setProfile(updated);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } finally {
      setProfileSaving(false);
    }
  }

  async function resync() {
    setResyncing(true);
    try {
      const updated = await apiFetch<UserProfile>("/api/v1/users/me/resync", { method: "POST" });
      setProfile(updated);
      setDisplayName(updated.displayName);
    } finally {
      setResyncing(false);
    }
  }

  async function saveSettings() {
    setSettingsSaving(true);
    try {
      const updated = await apiFetch<UserSettings>("/api/v1/users/me/settings", {
        method: "PATCH",
        body: JSON.stringify({ minSeverity, notifyEmail }),
      });
      setSettings(updated);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } finally {
      setSettingsSaving(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await apiFetch<void>("/api/v1/users/me", { method: "DELETE" });
      router.replace("/login");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="settings-page">
      <AppHeader active="repositories" />

      <ScreenContent>
        <section className="settings-heading">
          <div><h1>설정</h1><p>프로필, 알림 설정, 계정을 관리합니다.</p></div>
          <Link href="/repositories" className="settings-back">저장소로 돌아가기</Link>
        </section>

        <div className="settings-layout">
          <aside className="settings-sidebar">
            <nav aria-label="설정 섹션">
              <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>프로필</button>
              <button className={tab === "preferences" ? "active" : ""} onClick={() => setTab("preferences")}>스캔 설정</button>
              <button className={tab === "account" ? "active" : ""} onClick={() => setTab("account")}>계정</button>
            </nav>

            {profile && (
              <div className="settings-user-card">
                {profile.avatarUrl ? (
                  <Image src={profile.avatarUrl} alt={profile.login} width={48} height={48} className="settings-avatar-img" />
                ) : (
                  <span className="settings-avatar">{profile.login.slice(0, 2).toUpperCase()}</span>
                )}
                <strong>{profile.displayName}</strong>
                <small>@{profile.login}</small>
              </div>
            )}
          </aside>

          <div className="settings-main">
            {loading && <p className="settings-loading">불러오는 중…</p>}

            {!loading && tab === "profile" && (
              <section className="settings-card">
                <h2>프로필</h2>
                <p className="settings-card-sub">GitHub로 동기화된 정보와 표시 이름을 관리합니다.</p>

                <div className="settings-field">
                  <label htmlFor="login">GitHub 로그인</label>
                  <input id="login" value={profile?.login ?? ""} disabled />
                </div>
                <div className="settings-field">
                  <label htmlFor="displayName">표시 이름</label>
                  <input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="표시 이름" />
                </div>
                <div className="settings-field">
                  <label htmlFor="email">이메일</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일 (선택)" />
                </div>
                <div className="settings-field">
                  <label>가입일</label>
                  <input value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("ko-KR") : "-"} disabled />
                </div>
                <div className="settings-field">
                  <label>마지막 로그인</label>
                  <input value={profile?.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString("ko-KR") : "-"} disabled />
                </div>

                <div className="settings-actions">
                  <button onClick={saveProfile} disabled={profileSaving} className="save-button">
                    {profileSaving ? "저장 중…" : profileSaved ? "저장됨 ✓" : "저장"}
                  </button>
                  <button onClick={resync} disabled={resyncing} className="secondary-button">
                    {resyncing ? "동기화 중…" : "GitHub 재동기화"}
                  </button>
                </div>
              </section>
            )}

            {!loading && tab === "preferences" && (
              <section className="settings-card">
                <h2>스캔 설정</h2>
                <p className="settings-card-sub">최소 심각도 필터와 이메일 알림을 설정합니다.</p>

                <div className="settings-field">
                  <label htmlFor="minSeverity">최소 심각도</label>
                  <select id="minSeverity" value={minSeverity} onChange={(e) => setMinSeverity(e.target.value)}>
                    {SEVERITY_OPTIONS.map((s) => (
                      <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
                    ))}
                  </select>
                  <small>이 심각도 이상의 취약점만 보고합니다.</small>
                </div>

                <div className="settings-field settings-toggle">
                  <label htmlFor="notifyEmail">이메일 알림</label>
                  <input
                    id="notifyEmail"
                    type="checkbox"
                    checked={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.checked)}
                    role="switch"
                  />
                  <span>{notifyEmail ? "켜짐" : "꺼짐"}</span>
                </div>

                {settings?.excludedPaths && settings.excludedPaths.length > 0 && (
                  <div className="settings-field">
                    <label>제외 경로</label>
                    <ul className="excluded-paths">
                      {settings.excludedPaths.map((p) => <li key={p}>{p}</li>)}
                    </ul>
                  </div>
                )}

                <div className="settings-actions">
                  <button onClick={saveSettings} disabled={settingsSaving} className="save-button">
                    {settingsSaving ? "저장 중…" : settingsSaved ? "저장됨 ✓" : "저장"}
                  </button>
                </div>
              </section>
            )}

            {!loading && tab === "account" && (
              <section className="settings-card">
                <h2>계정</h2>
                <p className="settings-card-sub">계정 현황과 탈퇴를 관리합니다.</p>

                <div className="account-stats">
                  <article><span>연결된 저장소</span><strong>{stats?.repositoryCount ?? "-"}</strong></article>
                  <article><span>총 스캔 횟수</span><strong>{stats?.scanCount ?? "-"}</strong></article>
                </div>

                <div className="danger-zone">
                  <h3>위험 구역</h3>
                  <p>계정을 삭제하면 모든 저장소, 스캔, Finding 데이터가 영구적으로 제거됩니다.</p>
                  {!deleteConfirm ? (
                    <button className="danger-button" onClick={() => setDeleteConfirm(true)}>계정 삭제</button>
                  ) : (
                    <div className="delete-confirm">
                      <p>정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
                      <div className="settings-actions">
                        <button className="danger-button" onClick={deleteAccount} disabled={deleting}>
                          {deleting ? "삭제 중…" : "확인, 삭제합니다"}
                        </button>
                        <button className="secondary-button" onClick={() => setDeleteConfirm(false)}>취소</button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </ScreenContent>
    </main>
  );
}
