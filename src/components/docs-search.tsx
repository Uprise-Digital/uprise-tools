"use client";

import { FileText, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface SearchableDoc {
  title: string;
  description: string;
  category: string;
  slug: string;
  plainText: string;
}

interface DocsSearchProps {
  docs: SearchableDoc[];
}

export function DocsSearch({ docs }: DocsSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchableDoc[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Handle hotkeys (Ctrl+K or Cmd+K) to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isOpen]);

  // Perform search locally
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const cleanQuery = query.toLowerCase();
    const filtered = docs.filter(
      (doc) =>
        doc.title.toLowerCase().includes(cleanQuery) ||
        doc.description.toLowerCase().includes(cleanQuery) ||
        doc.plainText.toLowerCase().includes(cleanQuery),
    );
    setResults(filtered.slice(0, 5));
    setSelectedIndex(0);
  }, [query, docs]);

  // Close modal when clicking outside
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = results[selectedIndex];
      if (selected) {
        router.push(`/docs/${selected.category}/${selected.slug}`);
        setIsOpen(false);
      }
    }
  };

  return (
    <>
      {/* Search Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 w-full max-w-sm text-left bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-400 hover:text-slate-600 rounded-xl text-xs transition-colors cursor-pointer"
      >
        <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span className="flex-1 font-medium">Search documentation...</span>
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-bold bg-white border border-slate-300 rounded text-slate-500 font-mono shadow-sm">
          Ctrl K
        </kbd>
      </button>

      {/* Search Modal Overlay */}
      {isOpen && (
        <div
          onClick={handleOverlayClick}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-[15vh]"
        >
          <div
            ref={modalRef}
            className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-800"
          >
            {/* Input Bar */}
            <div className="flex items-center border-b border-slate-150 p-4 gap-3 bg-slate-50/50">
              <Search className="h-4 w-4 text-indigo-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search by title, category, or keywords..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent border-none text-sm outline-none text-slate-800 placeholder-slate-400"
              />
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Results List */}
            <div className="p-2 max-h-80 overflow-y-auto">
              {results.length > 0 ? (
                <ul className="space-y-1">
                  {results.map((doc, idx) => (
                    <li key={`${doc.category}-${doc.slug}`}>
                      <Link
                        href={`/docs/${doc.category}/${doc.slug}`}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
                          idx === selectedIndex
                            ? "bg-indigo-50 text-indigo-950 border border-indigo-100 shadow-sm"
                            : "hover:bg-slate-50 border border-transparent"
                        }`}
                      >
                        <FileText
                          className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${
                            idx === selectedIndex
                              ? "text-indigo-600"
                              : "text-slate-400"
                          }`}
                        />
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-slate-800">
                            {doc.title}
                          </p>
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {doc.description}
                          </p>
                          <span className="inline-block text-[9px] uppercase tracking-wider font-bold text-indigo-600/80 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/50 mt-1">
                            {doc.category.replace("-", " ")}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : query.trim() ? (
                <div className="p-6 text-center text-xs text-slate-400 font-semibold italic">
                  No matching documentation found.
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400 font-semibold leading-relaxed">
                  Type a search query or press{" "}
                  <kbd className="px-1 py-0.5 font-bold bg-slate-50 border border-slate-200 rounded font-mono shadow-sm">
                    Esc
                  </kbd>{" "}
                  to close.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
