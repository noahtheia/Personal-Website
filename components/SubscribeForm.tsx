"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong.");
        return;
      }
      setStatus("success");
      setMessage(
        data.alreadySubscribed
          ? "You're already on the list — thanks."
          : "Subscribed. The next post will land in your inbox.",
      );
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-0">
        <input
          type="email"
          required
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "loading"}
          className="flex-1 rounded border border-rule-strong bg-surface px-4 py-3 font-sans text-sm text-fg outline-none transition-colors placeholder:text-muted focus:border-accent sm:rounded-r-none"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded bg-[var(--accent-warm)] px-5 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-warm-hover)] disabled:opacity-60 sm:rounded-l-none"
        >
          {status === "loading" ? "Subscribing…" : "Subscribe"}
        </button>
      </div>
      {message ? (
        <p
          className={`mt-3 font-sans text-sm ${
            status === "error" ? "text-red-700" : "text-muted"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
