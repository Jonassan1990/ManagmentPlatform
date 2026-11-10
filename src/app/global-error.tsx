"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global.error]", {
      name: error.name,
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
          background: "#fff",
          color: "#0b1220",
        }}
      >
        <main
          style={{
            maxWidth: 480,
            margin: "4rem auto",
            padding: "1.5rem",
            border: "1px solid #d7dde5",
            borderRadius: 8,
          }}
        >
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#5b6777", marginTop: 8 }}>
            The application hit an unexpected error. Try again.
          </p>
          {error.digest ? (
            <p style={{ color: "#5b6777", fontSize: 12 }}>
              ERROR {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 16,
              background: "#041e42",
              color: "#fff",
              border: 0,
              borderRadius: 4,
              padding: "0.6rem 1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
