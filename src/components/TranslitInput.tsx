"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onLangChange?: (lang: string) => void;
  language: string;
  placeholder?: string;
  className?: string;
}

interface Suggestion {
  original: string;
  options: string[];
}

const TRANSLIT_LANGS: Record<string, string> = {
  hindi: "hi",
  tamil: "ta",
  telugu: "te",
  bengali: "bn",
  kannada: "kn",
  malayalam: "ml",
  gujarati: "gu",
  marathi: "mr",
  punjabi: "pa",
  urdu: "ur",
};

async function fetchTransliteration(text: string, langCode: string): Promise<string[]> {
  try {
    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(text)}&itc=${langCode}-t-i0-und&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8`;
    const res = await fetch(url);
    const data = await res.json();
    if (data[0] === "SUCCESS" && data[1]?.[0]?.[1]) {
      return data[1][0][1] as string[];
    }
  } catch {
    // silently fail
  }
  return [];
}

export default function TranslitInput({ value, onChange, onLangChange, language, placeholder, className }: Props) {
  const langCode = TRANSLIT_LANGS[language.toLowerCase()];
  const hasTranslit = !!langCode;

  const [translitOn, setTranslitOn] = useState(hasTranslit);
  const [buffer, setBuffer] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const commitSuggestion = useCallback((text: string) => {
    const prefix = value.endsWith(buffer) && buffer
      ? value.slice(0, value.length - buffer.length)
      : value;
    onChange((prefix ? prefix + " " : "") + text);
    setBuffer("");
    setSuggestions(null);
    setShowSuggestions(false);
    setSelectedIdx(0);
  }, [value, buffer, onChange]);

  const fetchSuggestions = useCallback(async (word: string) => {
    if (!langCode || !word || word.length < 1) {
      setSuggestions(null);
      setShowSuggestions(false);
      return;
    }
    const options = await fetchTransliteration(word, langCode);
    if (options.length > 0) {
      setSuggestions({ original: word, options });
      setSelectedIdx(0);
      setShowSuggestions(true);
    } else {
      setSuggestions(null);
      setShowSuggestions(false);
    }
  }, [langCode]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newVal = e.target.value;

    if (!translitOn) {
      onChange(newVal);
      return;
    }

    const lastSpace = newVal.lastIndexOf(" ");
    const currentWord = newVal.slice(lastSpace + 1);

    onChange(newVal);
    setBuffer(currentWord);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (currentWord) {
      debounceRef.current = setTimeout(() => fetchSuggestions(currentWord), 150);
    } else {
      setSuggestions(null);
      setShowSuggestions(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || !suggestions) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, suggestions.options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      commitSuggestion(suggestions.options[selectedIdx]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    } else if (e.key === " ") {
      e.preventDefault();
      commitSuggestion(suggestions.options[selectedIdx]);
    }
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const langLabel = translitOn ? langCode?.toUpperCase() : "EN";

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        className={className || "w-full px-3 py-2 pr-16 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent)]"}
        placeholder={placeholder}
      />
      {hasTranslit && (
        <button
          type="button"
          onClick={() => {
            const next = !translitOn;
            setTranslitOn(next);
            setSuggestions(null);
            setShowSuggestions(false);
            setBuffer("");
            onLangChange?.(next ? langCode! : "en");
            inputRef.current?.focus();
          }}
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-[10px] font-medium transition ${
            translitOn
              ? "bg-[var(--accent)]/15 text-[var(--accent)]"
              : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          title={translitOn ? `Transliteration ON (${langCode?.toUpperCase()}) — click for English` : `English mode — click for ${langCode?.toUpperCase()}`}
        >
          {langLabel}
        </button>
      )}
      {showSuggestions && suggestions && suggestions.options.length > 0 && (
        <div className="absolute left-0 top-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg z-50 min-w-[200px] overflow-hidden">
          <div className="px-2 py-1 text-[10px] text-[var(--text-secondary)] border-b border-[var(--border)]">
            Transliterating: {suggestions.original}
          </div>
          {suggestions.options.map((opt, i) => (
            <button
              key={i}
              onMouseDown={(e) => {
                e.preventDefault();
                commitSuggestion(opt);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm transition ${
                i === selectedIdx
                  ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
              }`}
            >
              {opt}
              {i === 0 && (
                <span className="ml-2 text-[10px] text-[var(--text-secondary)]">Tab/Space</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
