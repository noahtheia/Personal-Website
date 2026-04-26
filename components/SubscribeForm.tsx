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
          ? "You're already on the list — thanks!"
          : "Subscribed. Check your inbox for the next post.",
      );
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
      <input
        type="email"
        required
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === "loading"}
        className="flex-1 rounded border border-[var(--border)] bg-white px-3 py-2 font-sans text-sm outline-none focus:border-[var(--accent)]"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded bg-[var(--fg)] px-4 py-2 font-sans text-sm font-semibold text-white disabled:opacity-60"
      >
        {status === "loading" ? "Subscribing…" : "Subscribe"}
      </button>
      {message ? (
        <p
          className={`mt-1 font-sans text-sm sm:basis-full ${
            status === "error" ? "text-red-700" : "text-[var(--muted)]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
