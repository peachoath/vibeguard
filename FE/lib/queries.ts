"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";

// ──────────────────────────────────────────────────────────
// 타입 (BE ScanDto/Repository 등은 모든 호출자에게 동일 shape를 반환하므로 여기서 단일화)
// ──────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  githubId: number;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
}

export interface SummaryDto {
  severityDistribution: Record<string, number>;
  patchSuccessRate: number;
  avgDurationMs: number | null;
  totalScans: number;
  totalPrs: number;
}

export interface ScanDto {
  id: string;
  repositoryId: string;
  ref: string;
  commitSha: string | null;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  errorCode: string | null;
}

export interface Repository {
  id: string;
  fullName: string;
  defaultBranch: string;
  language: string | null;
  connectedAt: string;
}

export interface GitHubRepo {
  githubRepoId: number;
  fullName: string;
  defaultBranch: string;
  language: string | null;
  isPrivate: boolean;
}

export interface FindingDto {
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
}

export interface FindingDetailDto extends FindingDto {
  description: string | null;
  remediationAdvice: string | null;
  references: string[] | null;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
}

export interface UserProfile {
  githubId: number;
  login: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserStats {
  repositoryCount: number;
  scanCount: number;
}

export interface UserSettings {
  minSeverity: string;
  excludedPaths: string[];
  notifyEmail: boolean;
}

// ──────────────────────────────────────────────────────────
// Query keys — 동일 키를 공유해 페이지 간 캐시를 재사용한다.
// ──────────────────────────────────────────────────────────
export const qk = {
  authMe: ["auth", "me"] as const,
  summary: ["dashboard", "summary"] as const,
  scans: ["scans"] as const,
  repositories: ["repositories"] as const,
  githubRepos: ["repositories", "github"] as const,
  findings: (scanId: string) => ["scans", scanId, "findings"] as const,
  finding: (id: string) => ["findings", id] as const,
  userProfile: ["users", "me"] as const,
  userStats: ["users", "me", "stats"] as const,
  userSettings: ["users", "me", "settings"] as const,
};

// ──────────────────────────────────────────────────────────
// 조회 훅
// ──────────────────────────────────────────────────────────
export function useAuthUser() {
  return useQuery({
    queryKey: qk.authMe,
    queryFn: () => apiFetch<AuthUser>("/api/v1/auth/me"),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: qk.summary,
    queryFn: () => apiFetch<SummaryDto>("/api/v1/dashboard/summary"),
  });
}

/** poll=true면 진행 중(QUEUED/RUNNING) 스캔이 있을 때만 5초 간격으로 갱신한다. */
export function useScans(opts?: { poll?: boolean }) {
  return useQuery({
    queryKey: qk.scans,
    queryFn: () => apiFetch<ScanDto[]>("/api/v1/scans"),
    refetchInterval: opts?.poll
      ? (query) => {
          const data = query.state.data as ScanDto[] | undefined;
          const live = data?.some((s) => s.status === "QUEUED" || s.status === "RUNNING");
          return live ? 5000 : false;
        }
      : false,
  });
}

export function useRepositories() {
  return useQuery({
    queryKey: qk.repositories,
    queryFn: () => apiFetch<Repository[]>("/api/v1/repositories"),
  });
}

/** 저장소 추가 모달이 열릴 때(enabled)만 GitHub 목록을 불러온다. */
export function useGithubRepos(enabled: boolean) {
  return useQuery({
    queryKey: qk.githubRepos,
    queryFn: () => apiFetch<GitHubRepo[]>("/api/v1/repositories?source=github"),
    enabled,
    staleTime: 60_000,
  });
}

export function useScanFindings(scanId: string | null) {
  return useQuery({
    queryKey: qk.findings(scanId ?? ""),
    queryFn: () => apiFetch<PageResponse<FindingDto>>(`/api/v1/scans/${scanId}/findings?size=100`),
    enabled: !!scanId,
  });
}

export function useFinding(id: string | undefined) {
  return useQuery({
    queryKey: qk.finding(id ?? ""),
    queryFn: () => apiFetch<FindingDetailDto>(`/api/v1/findings/${id}`),
    enabled: !!id,
  });
}

export function useUserProfile() {
  return useQuery({
    queryKey: qk.userProfile,
    queryFn: () => apiFetch<UserProfile>("/api/v1/users/me"),
  });
}

export function useUserStats() {
  return useQuery({
    queryKey: qk.userStats,
    queryFn: () => apiFetch<UserStats>("/api/v1/users/me/stats"),
  });
}

export function useUserSettings() {
  return useQuery({
    queryKey: qk.userSettings,
    queryFn: () => apiFetch<UserSettings>("/api/v1/users/me/settings"),
  });
}

// ──────────────────────────────────────────────────────────
// 변경(mutation) 훅 — 성공 시 관련 캐시를 무효화/갱신한다.
// ──────────────────────────────────────────────────────────
export function useConnectRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (repo: GitHubRepo) =>
      apiFetch<Repository>("/api/v1/repositories", {
        method: "POST",
        body: JSON.stringify({
          githubRepoId: repo.githubRepoId,
          fullName: repo.fullName,
          defaultBranch: repo.defaultBranch,
          language: repo.language,
        }),
      }),
    onSuccess: (added) => {
      qc.setQueryData<Repository[]>(qk.repositories, (prev) =>
        prev ? [added, ...prev] : [added],
      );
    },
  });
}

export function useStartScan() {
  return useMutation({
    mutationFn: (vars: { repositoryId: string; ref: string }) =>
      apiFetch<ScanDto>("/api/v1/scans", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
  });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { displayName: string; email: string | null }) =>
      apiFetch<UserProfile>("/api/v1/users/me", { method: "PATCH", body: JSON.stringify(vars) }),
    onSuccess: (updated) => qc.setQueryData(qk.userProfile, updated),
  });
}

export function useResyncProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<UserProfile>("/api/v1/users/me/resync", { method: "POST" }),
    onSuccess: (updated) => qc.setQueryData(qk.userProfile, updated),
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { minSeverity: string; notifyEmail: boolean }) =>
      apiFetch<UserSettings>("/api/v1/users/me/settings", { method: "PATCH", body: JSON.stringify(vars) }),
    onSuccess: (updated) => qc.setQueryData(qk.userSettings, updated),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => apiFetch<void>("/api/v1/users/me", { method: "DELETE" }),
  });
}

// ──────────────────────────────────────────────────────────
// Hover 프리페치 — 링크에 마우스를 올리면 대상 데이터를 미리 받아 체감 속도를 높인다.
// prefetchQuery는 staleTime(기본 30s) 내 재호출을 자동 무시하므로 과호출되지 않는다.
// ──────────────────────────────────────────────────────────
export function usePrefetch() {
  const qc = useQueryClient();
  const repositories = () =>
    qc.prefetchQuery({ queryKey: qk.repositories, queryFn: () => apiFetch<Repository[]>("/api/v1/repositories") });
  const scans = () =>
    qc.prefetchQuery({ queryKey: qk.scans, queryFn: () => apiFetch<ScanDto[]>("/api/v1/scans") });
  const summary = () =>
    qc.prefetchQuery({ queryKey: qk.summary, queryFn: () => apiFetch<SummaryDto>("/api/v1/dashboard/summary") });
  return {
    repositories,
    history: () => {
      scans();
      repositories();
    },
    dashboard: () => {
      summary();
      scans();
      repositories();
    },
    finding: (id: string) =>
      qc.prefetchQuery({ queryKey: qk.finding(id), queryFn: () => apiFetch<FindingDetailDto>(`/api/v1/findings/${id}`) }),
  };
}
