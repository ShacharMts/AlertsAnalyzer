"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface DebugEntry {
  id: number;
  timestamp: string;
  method: string;
  url: string;
  status?: number;
  responseBody?: string;
  error?: string;
  duration?: number;
  refreshInfo?: string;
  orefUrl?: string;
  refreshMetaJson?: string;
}

let entryId = 0;

export default function DebugPanel() {
  const [entries, setEntries] = useState<DebugEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleExpand = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async function (...args: Parameters<typeof fetch>) {
      const [input, init] = args;
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;

      // Only intercept our API calls
      if (!url.includes("/api/alerts")) {
        return originalFetch.apply(this, args);
      }

      const method = init?.method?.toUpperCase() || "GET";
      const id = ++entryId;
      const startTime = performance.now();

      const entry: DebugEntry = {
        id,
        timestamp: new Date().toLocaleTimeString(),
        method,
        url: url.startsWith("/") ? `${window.location.origin}${url}` : url,
      };

      // Add the "pending" entry
      setEntries((prev) => [entry, ...prev].slice(0, 50));

      try {
        const response = await originalFetch.apply(this, args);
        const duration = Math.round(performance.now() - startTime);

        // Clone response to read body without consuming it
        const clone = response.clone();
        let body = "";
        let refreshInfo: string | undefined;
        try {
          const json = await clone.json();
          body = JSON.stringify(json, null, 2);
          // Extract refreshMeta for prominent display
          if (json.refreshMeta) {
            const m = json.refreshMeta;
            if (m.orefCalled) {
              refreshInfo = `✓ oref.org.il → ${m.freshRecords} records fetched (cached: ${m.cachedRecords}, total: ${m.totalRecords})`;
            } else {
              refreshInfo = `⚡ Served from ${m.source} (${m.totalRecords} records)`;
            }
          }
        } catch {
          body = await clone.text();
        }

        let parsedMeta: { orefUrl?: string; refreshMetaJson?: string } = {};
        try {
          const parsed = JSON.parse(body);
          if (parsed.refreshMeta) {
            parsedMeta.orefUrl = parsed.refreshMeta.orefUrl;
            parsedMeta.refreshMetaJson = JSON.stringify(parsed.refreshMeta, null, 2);
          }
        } catch { /* ignore */ }

        const updatedEntry: DebugEntry = {
          ...entry,
          status: response.status,
          responseBody: body,
          duration,
          refreshInfo,
          ...parsedMeta,
        };

        setEntries((prev) =>
          prev.map((e) => (e.id === id ? updatedEntry : e))
        );

        return response;
      } catch (err) {
        const duration = Math.round(performance.now() - startTime);
        const updatedEntry: DebugEntry = {
          ...entry,
          error: String(err),
          duration,
        };

        setEntries((prev) =>
          prev.map((e) => (e.id === id ? updatedEntry : e))
        );

        throw err;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const clearEntries = useCallback(() => {
    setEntries([]);
    setExpanded(new Set());
  }, []);

  if (entries.length === 0) {
    return (
      <div className="mt-4 rounded-lg border-2 border-dashed border-yellow-400 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-200">
        <div className="flex items-center gap-2 font-bold">
          <span>🐛</span> Debug Mode Active
        </div>
        <p className="mt-1 text-xs">Waiting for API calls... Navigate or click refresh to see requests.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-yellow-700 dark:text-yellow-300">
          <span>🐛</span> Debug Panel — {entries.length} request{entries.length !== 1 ? "s" : ""}
        </div>
        <button
          onClick={clearEntries}
          className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:hover:bg-yellow-900/60"
        >
          Clear
        </button>
      </div>

      {entries.map((entry) => {
        const isExpanded = expanded.has(entry.id);
        const statusColor =
          entry.error ? "text-red-600 dark:text-red-400" :
          entry.status && entry.status >= 400 ? "text-red-600 dark:text-red-400" :
          entry.status ? "text-green-600 dark:text-green-400" :
          "text-yellow-600 dark:text-yellow-400 animate-pulse";

        return (
          <div
            key={entry.id}
            className="overflow-hidden rounded-lg border border-gray-300 bg-white text-xs dark:border-gray-700 dark:bg-gray-900"
          >
            {/* Header row */}
            <button
              onClick={() => toggleExpand(entry.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <span className={`font-mono font-bold ${
                entry.method === "POST" ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"
              }`}>
                {entry.method}
              </span>
              <span className={`font-mono font-bold ${statusColor}`}>
                {entry.status || (entry.error ? "ERR" : "...")}
              </span>
              <span className="flex-1 truncate font-mono text-gray-700 dark:text-gray-300">
                {entry.url}
              </span>
              {entry.duration !== undefined && (
                <span className="shrink-0 text-gray-400">{entry.duration}ms</span>
              )}
              <span className="shrink-0 text-gray-400">{entry.timestamp}</span>
              <span className="shrink-0 text-gray-400">{isExpanded ? "▼" : "▶"}</span>
            </button>

            {/* Refresh info banner */}
            {entry.refreshInfo && (
              <div className="border-t border-green-200 bg-green-50 px-3 py-1.5 dark:border-green-800 dark:bg-green-900/30">
                <div className="text-xs font-bold text-green-700 dark:text-green-300">
                  {entry.refreshInfo}
                </div>
                {entry.orefUrl && (
                  <div className="mt-1 font-mono text-[11px] text-green-600 dark:text-green-400 break-all">
                    URL: {entry.orefUrl}
                  </div>
                )}
                {entry.refreshMetaJson && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11px] font-bold text-green-600 dark:text-green-400">refreshMeta JSON</summary>
                    <pre className="mt-1 rounded bg-green-100 dark:bg-green-900/50 px-2 py-1 font-mono text-[11px] text-green-800 dark:text-green-200 whitespace-pre-wrap">
{entry.refreshMetaJson}</pre>
                  </details>
                )}
              </div>
            )}

            {/* Expanded response */}
            {isExpanded && (
              <div className="border-t border-gray-200 dark:border-gray-700">
                <div className="px-3 py-1 text-[10px] font-bold uppercase text-gray-400">
                  {entry.error ? "Error" : "Response"}
                </div>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words bg-gray-50 px-3 py-2 font-mono text-[11px] text-gray-800 dark:bg-gray-950 dark:text-gray-200">
                  {entry.error || entry.responseBody || "Loading..."}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
