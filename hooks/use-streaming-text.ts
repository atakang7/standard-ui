"use client";

import { useEffect, useRef, useState } from "react";
import { clamp } from "../lib/utils";

const RATE_MULTIPLIER_DEFAULT = 0.985;
const MIN_CHARS_PER_SEC = 28;
const DEFAULT_TOKENS_PER_SEC = 18;
const DEFAULT_CHARS_PER_TOKEN = 3.8;
const EMA_ALPHA = 0.22;
const SMOOTHING_MS = 150;

type Options = {
  content: string;
  isLive: boolean;
  pace: number;
  completionTokens?: number;
  tokensPerSecond?: number;
};

/**
 * Smoothly reveals streaming text at a human-readable pace.
 * Returns the slice of `content` that should be rendered right now.
 */
export function useStreamingText({ content, isLive, pace, completionTokens, tokensPerSecond }: Options) {
  const [displayedCount, setDisplayedCount] = useState(content.length);

  const floatRef = useRef(content.length);
  const intRef = useRef(content.length);
  const incomingCpsRef = useRef(0);
  const lastSampleRef = useRef<{ at: number; length: number } | null>(null);
  const targetRef = useRef(content.length);
  const completionTokensRef = useRef(completionTokens);
  const throughputRef = useRef(tokensPerSecond);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);

  // Reset on message identity change (caller must pass a stable content ref per message).
  // We detect identity reset by checking if the new content is shorter than displayed.
  useEffect(() => {
    if (content.length < intRef.current) {
      incomingCpsRef.current = 0;
      lastSampleRef.current = null;
      floatRef.current = content.length;
      intRef.current = content.length;
      setDisplayedCount(content.length);
    }
  }, [content]);

  useEffect(() => {
    const targetLength = content.length;
    targetRef.current = targetLength;
    completionTokensRef.current = completionTokens;
    throughputRef.current = tokensPerSecond;

    if (!isLive) {
      floatRef.current = targetLength;
      intRef.current = targetLength;
      setDisplayedCount(targetLength);
      return;
    }

    const now = performance.now();
    const prev = lastSampleRef.current;
    if (prev && targetLength > prev.length && now > prev.at) {
      const instantCps = ((targetLength - prev.length) * 1000) / Math.max(1, now - prev.at);
      if (Number.isFinite(instantCps) && instantCps > 0) {
        const avg = incomingCpsRef.current;
        incomingCpsRef.current =
          avg > 0 ? avg * (1 - EMA_ALPHA) + instantCps * EMA_ALPHA : instantCps;
      }
    }
    lastSampleRef.current = { at: now, length: targetLength };

    if (floatRef.current > targetLength) {
      floatRef.current = targetLength;
      const clamped = Math.floor(targetLength);
      intRef.current = clamped;
      setDisplayedCount(clamped);
    }
  }, [content.length, completionTokens, tokensPerSecond, isLive]);

  useEffect(() => {
    if (!isLive) {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastFrameRef.current = null;
      return;
    }

    const tick = (frameAt: number) => {
      const prev = lastFrameRef.current ?? frameAt;
      lastFrameRef.current = frameAt;
      const deltaMs = clamp(frameAt - prev, 8, 64);

      const target = targetRef.current;
      const current = floatRef.current;

      if (current < target) {
        const tokens = completionTokensRef.current;
        const charsPerToken =
          typeof tokens === "number" && tokens > 0
            ? clamp(target / tokens, 2.4, 5.4)
            : DEFAULT_CHARS_PER_TOKEN;
        const throughputCps =
          typeof throughputRef.current === "number" && throughputRef.current > 0
            ? throughputRef.current * charsPerToken
            : 0;
        const incomingCps =
          incomingCpsRef.current > 0
            ? incomingCpsRef.current
            : throughputCps > 0
              ? throughputCps
              : DEFAULT_TOKENS_PER_SEC * charsPerToken;

        const configuredPace = clamp(Number.isFinite(pace) ? pace : RATE_MULTIPLIER_DEFAULT, 0.45, 1.1);
        const effectivePace = configuredPace < 1 ? Math.pow(configuredPace, 2.2) : configuredPace;
        const minCps = Math.max(6, MIN_CHARS_PER_SEC * effectivePace);
        const slowedCps = Math.max(minCps, incomingCps * effectivePace);

        const backlog = target - current;
        const base = (slowedCps * deltaMs) / 1000;
        const easing = 1 - Math.exp(-deltaMs / SMOOTHING_MS);
        const eased = Math.min(backlog * easing, base * 0.35);
        const advance = Math.min(backlog, base + eased);
        const next = current + advance;

        floatRef.current = next;
        const nextInt = Math.floor(next);
        if (nextInt !== intRef.current) {
          intRef.current = nextInt;
          setDisplayedCount(nextInt);
        }
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastFrameRef.current = null;
    };
  }, [isLive, pace]);

  return isLive ? content.slice(0, Math.max(0, displayedCount)) : content;
}
