"use client";

import { CSSProperties, ReactNode, useEffect } from "react";

interface SereniusModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  footerLeft?: ReactNode;
  headerActions?: ReactNode;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  contentPadding?: number | string;
  contentStyle?: CSSProperties;
  maxWidth?: number;
}

export default function SereniusModal({
  title,
  description,
  onClose,
  children,
  footer,
  footerLeft,
  headerActions,
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  contentPadding = 28,
  contentStyle,
  maxWidth = 820,
}: SereniusModalProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    if (!closeOnEscape) return;

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeOnEscape, onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 50,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        overflowY: "auto",
        padding: "60px 24px",
      }}
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          background: "white",
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100vh - 120px)",
        }}
      >
        <div
          style={{
            padding: "22px 28px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#111827",
                lineHeight: 1.25,
              }}
            >
              {title}
            </h2>

            {description && (
              <p
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                {description}
              </p>
            )}
          </div>

          {(headerActions || showCloseButton) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {headerActions}

              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close modal"
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "#6b7280",
                    cursor: "pointer",
                    padding: 4,
                    lineHeight: 1,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M2 2l12 12M14 2L2 14" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            padding: contentPadding,
            overflowY: "auto",
            flex: 1,
            ...contentStyle,
          }}
        >
          {children}
        </div>

        {(footer || footerLeft) && (
          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              padding: "16px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: footerLeft ? "space-between" : "flex-end",
              gap: 16,
            }}
          >
            {footerLeft && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {footerLeft}
              </div>
            )}

            {footer && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {footer}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
