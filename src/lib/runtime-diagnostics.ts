export interface RuntimeDiagnosticInput {
  filename: string;
  functionName: string;
  lineNumber?: number;
  error: unknown;
  requestUrl?: string;
  httpStatus?: number;
}

export interface RuntimeDiagnostic {
  filename: string;
  functionName: string;
  lineNumber: number | null;
  message: string;
  stack: string | null;
  requestUrl: string;
  httpStatus: number | null;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function errorStack(error: unknown): string | null {
  return error instanceof Error && error.stack ? error.stack : null;
}

export function httpStatusFromError(error: unknown): number | null {
  if (error != null && typeof error === "object") {
    const maybeStatus = (error as { status?: unknown; statusCode?: unknown }).status ??
      (error as { statusCode?: unknown }).statusCode;
    if (typeof maybeStatus === "number" && Number.isFinite(maybeStatus)) return maybeStatus;
  }
  const match = errorMessage(error).match(/(?:HTTP|status|returned)\s+(\d{3})/i);
  return match ? Number(match[1]) : null;
}

export function buildRuntimeDiagnostic(input: RuntimeDiagnosticInput): RuntimeDiagnostic {
  return {
    filename: input.filename,
    functionName: input.functionName,
    lineNumber: input.lineNumber ?? null,
    message: errorMessage(input.error),
    stack: errorStack(input.error),
    requestUrl:
      input.requestUrl ??
      (typeof window !== "undefined" ? window.location.href : "unknown"),
    httpStatus: input.httpStatus ?? httpStatusFromError(input.error),
  };
}

export function logRuntimeDiagnostic(input: RuntimeDiagnosticInput) {
  const diagnostic = buildRuntimeDiagnostic(input);
  console.error("[runtime:exception]", diagnostic);
  return diagnostic;
}