"use client";

import Image from "next/image";
import Link from "next/link";
import { Search, Settings } from "lucide-react";
import DashboardNav from "./dashboard-nav";
import { useAuth } from "./auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type NavTab = "repositories" | "scan" | "results" | "history" | "dashboard";

export default function AppHeader({ active }: { active: NavTab }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const initials = user?.login?.slice(0, 2).toUpperCase() ?? "..";

  return (
    <header className="dashboard-header">
      <Link className="dashboard-brand" href="/" aria-label="Vibe Guard 홈">
        <Image src="/vibeguard_logo_1.png" alt="Vibe Guard" width={452} height={170} priority />
      </Link>

      <DashboardNav active={active} />

      <div className="account-area">
        <button
          type="button"
          className="cmdk-trigger"
          aria-label="빠른 이동 열기 (Command K)"
          onClick={() => window.dispatchEvent(new Event("vg:cmdk"))}
        >
          <Search size={14} aria-hidden="true" />
          <kbd>⌘K</kbd>
        </button>
        <Link className="settings-button" href="/settings" aria-label="설정">
          <Settings size={21} />
        </Link>
        {user?.avatarUrl ? (
          <Image
            className="account-avatar-img"
            src={user.avatarUrl}
            alt={user.login}
            width={32}
            height={32}
          />
        ) : (
          <span className="account-avatar">{initials}</span>
        )}
        <span className="account-copy">
          <strong>{user?.login ?? "로딩 중"}</strong>
          <small>@{user?.login ?? ""}</small>
        </span>
      </div>
    </header>
  );
}
