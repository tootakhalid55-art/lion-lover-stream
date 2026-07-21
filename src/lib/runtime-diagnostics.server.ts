import { getRequestUrl } from "@tanstack/react-start/server";

import { logRuntimeDiagnostic, type RuntimeDiagnosticInput } from "./runtime-diagnostics";

function currentRequestUrl(): string {
  try {
    return getRequestUrl().toString();
  } catch {
    return "unknown";
  }
}

export function logServerDiagnostic(input: Omit<RuntimeDiagnosticInput, "requestUrl"> & { requestUrl?: string }) {
  return logRuntimeDiagnostic({
    ...input,
    requestUrl: input.requestUrl ?? currentRequestUrl(),
  });
}