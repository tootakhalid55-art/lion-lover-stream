import { Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { buildRuntimeDiagnostic, logRuntimeDiagnostic } from "@/lib/runtime-diagnostics";

export function RouteError({
  error,
  reset,
  filename,
  functionName = "route-render",
  lineNumber,
}: {
  error: Error;
  reset?: () => void;
  filename: string;
  functionName?: string;
  lineNumber?: number;
}) {
  const router = useRouter();
  const diagnostic = buildRuntimeDiagnostic({ filename, functionName, lineNumber, error });

  useEffect(() => {
    logRuntimeDiagnostic({ filename, functionName, lineNumber, error });
  }, [error, filename, functionName, lineNumber]);

  return (
    <div className="min-h-dvh bg-background px-4 py-10 text-foreground">
      <main className="mx-auto max-w-3xl rounded-2xl bg-red-500/10 p-5 ring-1 ring-red-400/30">
        <p className="text-xs font-bold uppercase tracking-wide text-red-200">Runtime exception</p>
        <h1 className="mt-2 text-xl font-black text-red-100">{diagnostic.message}</h1>
        <dl className="mt-4 grid gap-2 text-xs text-red-100/80 sm:grid-cols-2">
          <div><dt className="font-bold text-red-100">File</dt><dd>{diagnostic.filename}</dd></div>
          <div><dt className="font-bold text-red-100">Function</dt><dd>{diagnostic.functionName}</dd></div>
          <div><dt className="font-bold text-red-100">Line</dt><dd>{diagnostic.lineNumber ?? "unknown"}</dd></div>
          <div><dt className="font-bold text-red-100">HTTP status</dt><dd>{diagnostic.httpStatus ?? "n/a"}</dd></div>
          <div className="sm:col-span-2"><dt className="font-bold text-red-100">Request URL</dt><dd className="break-all">{diagnostic.requestUrl}</dd></div>
        </dl>
        {diagnostic.stack && (
          <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-3 text-left text-[11px] leading-relaxed text-red-50" dir="ltr">
            {diagnostic.stack}
          </pre>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void router.invalidate();
              reset?.();
            }}
            className="rounded-full bg-red-200 px-4 py-2 text-sm font-bold text-red-950"
          >
            Try again
          </button>
          <Link to="/" className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-foreground ring-1 ring-white/15">
            Go home
          </Link>
        </div>
      </main>
    </div>
  );
}