import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listJobsFn, runJobNowFn, toggleJobFn } from "@/lib/jobs.functions";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

export const Route = createFileRoute("/admin/jobs")({
  component: JobsPage,
  head: () => ({
    meta: [
      { title: "Job Dashboard — Nova TV Admin" },
      { name: "description", content: "Monitor scheduled billing, dunning, webhook, and reconciliation jobs." },
    ],
  }),
});

function JobsPage() {
  const list = useServerFn(listJobsFn);
  const runNow = useServerFn(runJobNowFn);
  const toggle = useServerFn(toggleJobFn);
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin", "jobs"], queryFn: () => list(), refetchInterval: 15_000 });
  const mRun = useMutation({ mutationFn: (code: string) => runNow({ data: { code } }), onSettled: () => q.refetch() });
  const mToggle = useMutation({
    mutationFn: (v: { code: string; enabled: boolean }) => toggle({ data: v }),
    onSettled: () => q.refetch(),
  });

  if (!q.data) return <div className="p-6 text-white/70">Loading jobs…</div>;
  const { definitions, runs } = q.data;
  const runsByJob = new Map<string, typeof runs>();
  for (const r of runs) {
    const arr = runsByJob.get(r.job_id) ?? [];
    arr.push(r);
    runsByJob.set(r.job_id, arr);
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Job Dashboard</h1>
        <p className="text-white/60 text-sm">Scheduled billing, dunning, webhook and reconciliation workers.</p>
      </header>
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full text-sm text-white/90">
          <thead className="bg-white/5 text-white/60 text-xs uppercase">
            <tr>
              <th className="p-3 text-start">Job</th>
              <th className="p-3 text-start">Schedule</th>
              <th className="p-3 text-start">Status</th>
              <th className="p-3 text-start">Last Success</th>
              <th className="p-3 text-start">Last Failure</th>
              <th className="p-3 text-start">Avg Runtime</th>
              <th className="p-3 text-start">Actions</th>
            </tr>
          </thead>
          <tbody>
            {definitions.map((d) => {
              const last = (runsByJob.get(d.id) ?? [])[0];
              return (
                <tr key={d.id} className="border-t border-white/5">
                  <td className="p-3">
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-white/50">{d.code}</div>
                  </td>
                  <td className="p-3 font-mono text-xs">{d.schedule}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${d.is_enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/60"}`}>
                      {d.is_enabled ? "enabled" : "paused"}
                    </span>
                    {last && (
                      <span className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs ${last.status === "success" ? "bg-emerald-500/10 text-emerald-300" : last.status === "failure" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>
                        {last.status}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-white/60">{d.last_success_at ? formatDistanceToNow(new Date(d.last_success_at), { addSuffix: true }) : "—"}</td>
                  <td className="p-3 text-xs text-white/60">{d.last_failure_at ? formatDistanceToNow(new Date(d.last_failure_at), { addSuffix: true }) : "—"}</td>
                  <td className="p-3 text-xs text-white/60">{d.avg_runtime_ms ? `${d.avg_runtime_ms} ms` : "—"}</td>
                  <td className="p-3 space-x-2">
                    <button
                      disabled={busy === d.code}
                      onClick={async () => { setBusy(d.code); await mRun.mutateAsync(d.code); setBusy(null); }}
                      className="rounded-lg bg-primary/20 px-3 py-1 text-xs text-primary hover:bg-primary/30"
                    >Run Now</button>
                    <button
                      onClick={() => mToggle.mutate({ code: d.code, enabled: !d.is_enabled })}
                      className="rounded-lg bg-white/10 px-3 py-1 text-xs text-white/80 hover:bg-white/20"
                    >{d.is_enabled ? "Pause" : "Resume"}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-white mb-2">Recent Runs</h2>
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
          <table className="w-full text-xs text-white/80">
            <thead className="text-white/50 uppercase">
              <tr>
                <th className="p-2 text-start">Started</th>
                <th className="p-2 text-start">Status</th>
                <th className="p-2 text-start">Duration</th>
                <th className="p-2 text-start">Trigger</th>
                <th className="p-2 text-start">Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 40).map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="p-2">{new Date(r.started_at).toLocaleString()}</td>
                  <td className={`p-2 ${r.status === "failure" ? "text-rose-300" : r.status === "success" ? "text-emerald-300" : "text-amber-300"}`}>{r.status}</td>
                  <td className="p-2">{r.duration_ms ? `${r.duration_ms} ms` : "—"}</td>
                  <td className="p-2">{r.triggered_by}</td>
                  <td className="p-2 text-rose-300/80 truncate max-w-[400px]">{r.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
