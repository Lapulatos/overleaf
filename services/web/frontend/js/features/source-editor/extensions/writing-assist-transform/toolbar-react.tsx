import React, { useState, useCallback, useRef, useEffect } from "react";
import type { TransformAction, SupportedLanguage } from "./types";
import { ACTION_META, SUPPORTED_LANGUAGES } from "./types";
import { requestTransformEffect, lockTransformToolbarEffect } from "./effects";
import type { EditorView } from "@codemirror/view";

// ── Inline SVG icons (no font dependency) ──

const ICONS: Record<string, React.ReactElement> = {
  sparkle: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
      <path d="M18 14l.7 2.8L21.5 17.5l-2.8.7L18 21l-.7-2.8-2.8-.7 2.8-.7L18 14z" />
      <path d="M7 17l.5 1.5L9 19l-1.5.5L7 21l-.5-1.5L5 19l1.5-.5L7 17z" />
    </svg>
  ),
  translate: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 8l6 6" />
      <path d="M4 14l6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2v3" />
      <path d="M14 14l3 5 3-5" />
      <path d="M15 19h4" />
    </svg>
  ),
  swap: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 16l-4-4 4-4" />
      <path d="M17 8l4 4-4 4" />
      <path d="M3 12h18" />
    </svg>
  ),
  editNote: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  tune: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="8" cy="6" r="2" fill="currentColor" />
      <circle cx="16" cy="12" r="2" fill="currentColor" />
      <circle cx="10" cy="18" r="2" fill="currentColor" />
    </svg>
  ),
  unfoldMore: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14" />
      <path d="M7 9l5-5 5 5" />
      <path d="M7 15l5 5 5-5" />
    </svg>
  ),
  unfoldLess: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 4l5 5 5-5" />
      <path d="M7 20l5-5 5 5" />
    </svg>
  ),
  close: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  chevronDown: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  chevronUp: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 15l6-6 6 6" />
    </svg>
  ),
  send: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" />
    </svg>
  ),
};

/** Actions that appear as card buttons (excluding 'custom'). */
const CARD_ACTIONS = (Object.keys(ACTION_META) as TransformAction[]).filter(
  (a) => a !== "custom",
);

interface ToolbarProps {
  view: EditorView;
}

/**
 * Selection-triggered AI icon + vertical dropdown menu.
 *
 * Layout:
 * 1. Top row: close button
 * 2. Custom instruction input and send button
 * 3. Separator
 * 4. Actions with optional language or adjustment controls
 *
 * The lock effect (lockTransformToolbarEffect) pins the toolbar open while
 * the user is interacting with the custom-input or language dropdown,
 * preventing it from vanishing on selection changes.
 */
export function TransformToolbar({ view }: ToolbarProps): React.ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState<string | null>(null); // action key where lang dropdown is open
  const [customText, setCustomText] = useState("");
  const [settingsAction, setSettingsAction] = useState<TransformAction | null>(
    null,
  );
  const [expandRatio, setExpandRatio] = useState(0.5);
  const [condenseRatio, setCondenseRatio] = useState(-0.3);
  const [rewriteFidelity, setRewriteFidelity] = useState(0.5);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleCloseMenu = useCallback(() => {
    setMenuOpen(false);
    setLangOpen(null);
    setSettingsAction(null);
    setCustomText("");
  }, []);

  useEffect(() => {
    if (menuOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [menuOpen]);

  // Close menu on outside clicks
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleCloseMenu();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuRef.current?.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
        handleCloseMenu();
        view.focus();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler, true);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler, true);
    };
  }, [menuOpen, handleCloseMenu, view]);

  const dispatchLock = useCallback(() => {
    view.dispatch({ effects: lockTransformToolbarEffect.of(null) });
  }, [view]);

  const dispatchAction = useCallback(
    (
      action: TransformAction,
      targetLanguage?: SupportedLanguage,
      customInstruction?: string,
      lengthRatio?: number,
      rewriteFidelity?: number,
    ) => {
      const sel = view.state.selection.main;
      view.dispatch({
        effects: [
          requestTransformEffect.of({
            from: sel.from,
            to: sel.to,
            action,
            targetLanguage,
            customInstruction,
            lengthRatio,
            rewriteFidelity,
          }),
        ],
      });
      setMenuOpen(false);
      setLangOpen(null);
      setCustomText("");
    },
    [view],
  );

  const handleOpenMenu = useCallback(() => {
    setMenuOpen(true);
    setLangOpen(null);
  }, []);

  const handleCustomSubmit = useCallback(() => {
    if (customText.trim()) {
      dispatchAction("custom", undefined, customText.trim());
    }
  }, [customText, dispatchAction]);

  return (
    <div className="wa-transform-trigger" ref={menuRef}>
      {!menuOpen ? (
        <button
          className="wa-transform-icon-btn"
          onClick={handleOpenMenu}
          title="AI 写作助手"
        >
          <span className="wa-transform-sparkle">{ICONS.sparkle}</span>
        </button>
      ) : (
        <div
          className="wa-transform-menu"
          role="dialog"
          aria-label="选区写作助手"
        >
          <div className="wa-transform-menu-header">
            <span>编辑选中文字</span>
            <button
              type="button"
              className="wa-transform-dismiss"
              aria-label="关闭选区助手"
              onClick={handleCloseMenu}
            >
              {ICONS.close}
            </button>
          </div>
          {/* Card 1: Custom input group */}
          <div className="wa-transform-card">
            <div className="wa-transform-custom-top-row">
              <input
                ref={inputRef}
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCustomSubmit();
                  if (e.key === "Escape") handleCloseMenu();
                  e.stopPropagation();
                }}
                placeholder="告诉助手如何修改…"
                aria-label="选区修改要求"
                className="wa-transform-custom-input"
              />
              <button
                className="wa-transform-custom-submit"
                aria-label="发送选区修改要求"
                onClick={handleCustomSubmit}
                disabled={!customText.trim()}
              >
                {ICONS.send}
              </button>
            </div>
          </div>

          {/* Card 2: Action buttons group */}
          <div className="wa-transform-card">
            {CARD_ACTIONS.map((action) => {
              const meta = ACTION_META[action];
              if (action === "translate") {
                return (
                  <div key={action}>
                    <button
                      className="wa-transform-menu-item"
                      aria-expanded={langOpen === "translate"}
                      onClick={
                        langOpen === "translate"
                          ? () => {
                              setLangOpen(null);
                              dispatchLock();
                            }
                          : () => {
                              setLangOpen("translate");
                              setSettingsAction(null);
                              dispatchLock();
                            }
                      }
                    >
                      <span className="wa-transform-item-icon">
                        {ICONS[meta.icon]}
                      </span>
                      <span className="wa-transform-item-label">
                        {meta.label}
                      </span>
                      <span className="wa-transform-item-arrow">
                        {langOpen === "translate"
                          ? ICONS.chevronUp
                          : ICONS.chevronDown}
                      </span>
                    </button>
                    {langOpen === "translate" && (
                      <div className="wa-transform-lang-list">
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <button
                            key={lang.code}
                            className="wa-transform-lang-item"
                            onClick={() =>
                              dispatchAction(
                                "translate",
                                lang.code as SupportedLanguage,
                              )
                            }
                          >
                            {lang.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              if (
                action === "expand" ||
                action === "condense" ||
                action === "rewrite"
              ) {
                const open = settingsAction === action;
                const value =
                  action === "rewrite"
                    ? rewriteFidelity
                    : action === "expand"
                      ? expandRatio
                      : condenseRatio;
                const label =
                  action === "rewrite"
                    ? "保留原文程度"
                    : action === "expand"
                      ? "增加篇幅"
                      : "减少篇幅";
                const display =
                  action === "rewrite"
                    ? `${Math.round(value * 100)}%`
                    : `${Math.round(Math.abs(value) * 100)}%`;
                return (
                  <div key={action}>
                    <button
                      className="wa-transform-menu-item"
                      aria-expanded={open}
                      onClick={() => {
                        setSettingsAction(open ? null : action);
                        setLangOpen(null);
                        dispatchLock();
                      }}
                    >
                      <span className="wa-transform-item-icon">
                        {ICONS[meta.icon]}
                      </span>
                      <span className="wa-transform-item-label">
                        {meta.label}
                      </span>
                      <span className="wa-transform-item-arrow">
                        {open ? ICONS.chevronUp : ICONS.chevronDown}
                      </span>
                    </button>
                    {open && (
                      <div className="wa-transform-settings">
                        <div className="wa-transform-setting-caption">
                          <label htmlFor={`wa-transform-${action}`}>
                            {label}
                          </label>
                          <output>{display}</output>
                        </div>
                        <div className="wa-transform-setting-controls">
                          <input
                            id={`wa-transform-${action}`}
                            type="range"
                            min={
                              action === "rewrite"
                                ? 0
                                : action === "expand"
                                  ? 0.1
                                  : -0.8
                            }
                            max={
                              action === "rewrite"
                                ? 0.9
                                : action === "expand"
                                  ? 5
                                  : -0.1
                            }
                            step={0.1}
                            value={value}
                            aria-valuetext={display}
                            onChange={(e) => {
                              const next = Number(e.target.value);
                              if (action === "rewrite")
                                setRewriteFidelity(next);
                              else if (action === "expand")
                                setExpandRatio(next);
                              else setCondenseRatio(next);
                              dispatchLock();
                            }}
                          />
                          <button
                            className="wa-transform-setting-apply"
                            onClick={() =>
                              dispatchAction(
                                action,
                                undefined,
                                undefined,
                                action === "rewrite" ? undefined : value,
                                action === "rewrite" ? value : undefined,
                              )
                            }
                          >
                            开始{meta.label}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <button
                  key={action}
                  className="wa-transform-menu-item"
                  onClick={() => dispatchAction(action as TransformAction)}
                >
                  <span className="wa-transform-item-icon">
                    {ICONS[meta.icon]}
                  </span>
                  <span className="wa-transform-item-label">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
