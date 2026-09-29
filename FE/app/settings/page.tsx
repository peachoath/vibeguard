"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppHeader from "../components/app-header";
import ScreenContent from "../components/screen-content";
import { Sk } from "../components/skeleton";
import { ErrorView } from "../components/error-view";
import { toast } from "../components/providers";
import {
  useDeleteAccount,
  useResyncProfile,
  useSaveProfile,
  useSaveSettings,
  useUserProfile,
  useUserSettings,
  useUserStats,
} from "@/lib/queries";

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

  const profileQuery = useUserProfile();
  const statsQuery = useUserStats();
  const settingsQuery = useUserSettings();
  const profile = profileQuery.data ?? null;
  const stats = statsQuery.data ?? null;
  const settings = settingsQuery.data ?? null;
  const loading = profileQuery.isPending || statsQuery.isPending || settingsQuery.isPending;
  const error = profileQuery.isError || statsQuery.isError || settingsQuery.isError;

  // 편집 드래프트 — null이면 서버 값을 그대로 보여주고, 입력하면 그 값으로 덮어쓴다.
  const [displayNameDraft, setDisplayName] = useState<string | null>(null);
  const [emailDraft, setEmail] = useState<string | null>(null);
  const [minSeverityDraft, setMinSeverity] = useState<string | null>(null);
  const [notifyEmailDraft, setNotifyEmail] = useState<boolean | null>(null);
  const displayName = displayNameDraft ?? profile?.displayName ?? "";
  const email = emailDraft ?? profile?.email ?? "";
  const minSeverity = minSeverityDraft ?? settings?.minSeverity ?? "LOW";
  const notifyEmail = notifyEmailDraft ?? settings?.notifyEmail ?? false;

  const [profileSaved, setProfileSaved] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const saveProfileMut = useSaveProfile();
  const resyncMut = useResyncProfile();
  const saveSettingsMut = useSaveSettings();
  const deleteMut = useDeleteAccount();
  const profileSaving = saveProfileMut.isPending;
  const resyncing = resyncMut.isPending;
  const settingsSaving = saveSettingsMut.isPending;
  const deleting = deleteMut.isPending;

  async function saveProfile() {
    try {
      await saveProfileMut.mutateAsync({ displayName, email: email || null });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
      toast.success("프로필이 저장되었습니다.");
    } catch {
      toast.error("프로필 저장에 실패했습니다.");
    }
  }

  async function resync() {
    try {
      const updated = await resyncMut.mutateAsync();
      setDisplayName(updated.displayName);
      toast.success("GitHub 정보가 동기화되었습니다.");
    } catch {
      toast.error("동기화에 실패했습니다.");
    }
  }

  async function saveSettings() {
    try {
      await saveSettingsMut.mutateAsync({ minSeverity, notifyEmail });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
      toast.success("설정이 저장되었습니다.");
    } catch {
      toast.error("설정 저장에 실패했습니다.");
    }
  }

  async function deleteAccount() {
    try {
      await deleteMut.mutateAsync();
      router.replace("/login");
    } catch {
      toast.error("계정 삭제에 실패했습니다. 다시 시도해주세요.");
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
            {error && !loading && <ErrorView onRetry={() => { profileQuery.refetch(); statsQuery.refetch(); settingsQuery.refetch(); }} />}

            {loading && (
              <>
                <div className="settings-sk-card">
                  <Sk w={120} h={18} r={4} />
                  <Sk w={220} h={12} r={4} />
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="settings-sk-field">
                      <Sk w="80%" h={13} r={4} />
                      <Sk w="100%" h={38} r={10} />
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <Sk w={80} h={38} r={10} />
                    <Sk w={130} h={38} r={10} />
                  </div>
                </div>
              </>
            )}

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
