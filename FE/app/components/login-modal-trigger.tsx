"use client";

import { Info, LockKeyhole, X } from "lucide-react";
import Image from "next/image";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { useFocusTrap } from "./use-focus-trap";

type LoginModalTriggerProps = {
  variant?: "header" | "primary";
  label?: string;
};

const LoginModalContext = createContext<(() => void) | null>(null);

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.body.classList.add("login-modal-open");
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("login-modal-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <LoginModalContext.Provider value={() => setOpen(true)}>
      {children}

      {open && (
        <div className="login-modal-overlay" onMouseDown={() => setOpen(false)}>
          <section
            className="login-dialog"
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
            aria-describedby="login-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="login-dialog-header">
              <Image src="/vibeguard_logo_1.png" alt="Vibe Guard" width={452} height={170} priority />
              <button type="button" className="login-dialog-close" onClick={() => setOpen(false)} aria-label="로그인 창 닫기"><X size={24} /></button>
            </header>

            <div className="login-dialog-content">
              <span className="login-github-mark" aria-hidden="true"><Image className="login-github-logo" src="/github-mark.png" alt="" width={560} height={560} /></span>
              <h1 id="login-title">GitHub로 로그인</h1>
              <p id="login-description">저장소 접근 권한을 확인하고 PR 생성까지 진행하려면<br />GitHub 계정 연결이 필요합니다.</p>
              <span className="login-security-badge"><LockKeyhole size={16} /> 안전한 OAuth 연결</span>
            </div>

            <div className="login-dialog-actions">
              <a className="login-oauth-button" href={`${process.env.NEXT_PUBLIC_API_URL}/oauth2/authorization/github`}>연결하기</a>
              <button type="button" className="login-cancel-button" onClick={() => setOpen(false)}>취소</button>
            </div>

            <p className="login-dialog-note"><Info size={16} /> 연결 후 저장소 목록, PR 생성 권한을 요청할 수 있습니다.</p>
          </section>
        </div>
      )}
    </LoginModalContext.Provider>
  );
}

export default function LoginModalTrigger({ variant = "header", label = "GitHub로 시작하기" }: LoginModalTriggerProps) {
  const openLoginModal = useContext(LoginModalContext);
  const triggerClassName = variant === "primary" ? "button button-primary" : "header-cta";

  if (!openLoginModal) throw new Error("LoginModalTrigger must be used inside LoginModalProvider");

  return <button type="button" className={triggerClassName} onClick={openLoginModal}>{label}</button>;
}
