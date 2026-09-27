"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../components/auth-provider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/repositories");
  }, [user, loading, router]);

  return (
    <main className="login-page">
      <section className="login-page-content" aria-labelledby="login-page-title">
        <Link className="login-page-brand" href="/" aria-label="Vibe Guard 홈">
          <Image src="/vibeguard_logo_1.png" alt="Vibe Guard" width={452} height={170} priority />
        </Link>
        <span className="login-page-github" aria-hidden="true"><Image src="/github-mark.png" alt="" width={560} height={560} /></span>
        <h1 id="login-page-title">GitHub 계정 연결</h1>
        <p>Vibe Guard가 저장소를 점검하고 보안 패치 PR을 만들 수 있도록 GitHub 로그인을 진행합니다.</p>
        <a className="login-page-oauth" href={`${API_BASE}/oauth2/authorization/github`}>GitHub로 로그인</a>
        <Link className="login-page-back" href="/">홈으로 돌아가기</Link>
      </section>
    </main>
  );
}
