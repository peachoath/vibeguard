"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderGit2, History, LayoutDashboard, ListChecks, Search, Settings } from "lucide-react";
import { useFocusTrap } from "./use-focus-trap";
import { usePrefetch } from "@/lib/queries";

type Item = { label: string; hint: string; href: string; keywords: string; icon: React.ReactNode };

const ITEMS: Item[] = [
  { label: "대시보드", hint: "보안 현황", href: "/dashboard", keywords: "dashboard 보안 현황 통계 요약", icon: <LayoutDashboard size={17} /> },
  { label: "저장소", hint: "연결·스캔 시작", href: "/repositories", keywords: "repositories repo 저장소 스캔 시작 연결", icon: <FolderGit2 size={17} /> },
  { label: "분석 결과", hint: "Finding 목록", href: "/results", keywords: "results findings 취약점 분석 결과", icon: <ListChecks size={17} /> },
  { label: "검사 이력", hint: "스캔 타임라인", href: "/history", keywords: "history 이력 스캔 타임라인", icon: <History size={17} /> },
  { label: "설정", hint: "프로필·계정", href: "/settings", keywords: "settings 설정 프로필 계정 알림", icon: <Settings size={17} /> },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("vg:cmdk", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("vg:cmdk", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // 열릴 때마다 새로 마운트되어 검색어/커서가 자연 초기화된다.
  if (!open) return null;
  return <CommandPaletteDialog onClose={() => setOpen(false)} />;
}

function CommandPaletteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const prefetch = usePrefetch();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  const prefetchFor = (href: string) => {
    if (href === "/repositories") prefetch.repositories();
    else if (href === "/history") prefetch.history();
    else if (href === "/dashboard") prefetch.dashboard();
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? ITEMS.filter((i) => i.label.toLowerCase().includes(q) || i.keywords.includes(q))
    : ITEMS;

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div className="cmdk-overlay" onMouseDown={onClose}>
      <div
        className="cmdk"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="빠른 이동"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="cmdk-search">
          <Search size={16} aria-hidden="true" />
          <input
            data-autofocus
            placeholder="어디로 갈까요? (예: 저장소, 결과, 설정)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (filtered[active]) go(filtered[active].href);
              }
            }}
            aria-label="이동할 페이지 검색"
          />
          <kbd className="cmdk-kbd">ESC</kbd>
        </div>
        <ul className="cmdk-list" role="listbox" aria-label="이동 가능한 페이지">
          {filtered.map((item, idx) => (
            <li key={item.href} role="option" aria-selected={idx === active}>
              <button
                type="button"
                className={`cmdk-item${idx === active ? " active" : ""}`}
                onMouseEnter={() => {
                  setActive(idx);
                  prefetchFor(item.href);
                }}
                onClick={() => go(item.href)}
              >
                <span className="cmdk-item-icon">{item.icon}</span>
                <span className="cmdk-item-label">{item.label}</span>
                <span className="cmdk-item-hint">{item.hint}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="cmdk-empty">일치하는 페이지가 없습니다.</li>}
        </ul>
      </div>
    </div>
  );
}
