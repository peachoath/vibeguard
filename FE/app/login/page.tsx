"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useAuth } from "../components/auth-provider";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/repositories");
  }, [user, loading, router]);

  return (
    <main className="login-page">
      <div className="login-card">
        <Image src="/vibeguard_logo_1.png" alt="VibeGuard" width={226} height={85} priority />
        <h1>취약점은 줄이고<br />기능은 그대로</h1>
        <p>GitHub 저장소를 연결하면 취약점 탐지부터 패치 PR 생성까지 자동으로 이어집니다.</p>
        <a
          className="button button-primary login-github-button"
          href={`${API_BASE}/oauth2/authorization/github`}
        >
          GitHub으로 시작하기
        </a>
      </div>
    </main>
  );
}
