import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { verifyToken, TOKEN_COOKIE } from "~/auth";

const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(TOKEN_COOKIE);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return { userId: payload.userId, email: payload.email, name: payload.name };
});

const fetchCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(TOKEN_COOKIE);
  if (!token || !verifyToken(token)) return [];
  const payload = verifyToken(token)!;
  const { getUserCampaigns } = await import("~/services/sms-service");
  return getUserCampaigns(payload.userId);
});

const fetchLists = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(TOKEN_COOKIE);
  if (!token || !verifyToken(token)) return [];
  const payload = verifyToken(token)!;
  const { getUserContactLists } = await import("~/services/sms-service");
  return getUserContactLists(payload.userId);
});

const fetchCompletedRenders = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(TOKEN_COOKIE);
  if (!token || !verifyToken(token)) return [];
  const payload = verifyToken(token)!;
  const { getUserJobs } = await import("~/services/render-queue");
  const jobs = await getUserJobs(payload.userId, 50);
  return jobs.filter((j) => j.status === "completed").map((j) => ({
    id: j.id,
    projectName: j.project_name,
    outputUrl: j.output_url,
  }));
});

const createCampaignFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { listId: string; renderJobId: string; name: string; messageTemplate?: string })
  .handler(async ({ data }) => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(TOKEN_COOKIE);
    if (!token || !verifyToken(token)) throw new Error("Unauthorized");
    const payload = verifyToken(token)!;
    const { createCampaign } = await import("~/services/sms-service");
    return createCampaign(payload.userId, data.listId, data.renderJobId, data.name, data.messageTemplate);
  });

const sendCampaignFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { campaignId: string })
  .handler(async ({ data }) => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(TOKEN_COOKIE);
    if (!token || !verifyToken(token)) throw new Error("Unauthorized");
    const payload = verifyToken(token)!;
    const { sendCampaign } = await import("~/services/sms-service");
    return sendCampaign(data.campaignId, payload.userId);
  });

const fetchCampaignMessages = createServerFn({ method: "GET" })
  .validator((d: unknown) => (d as { campaignId: string }).campaignId)
  .handler(async ({ data }) => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(TOKEN_COOKIE);
    if (!token || !verifyToken(token)) return [];
    const payload = verifyToken(token)!;
    const { getCampaignMessages } = await import("~/services/sms-service");
    return getCampaignMessages(data.campaignId, payload.userId);
  });

export const Route = createFileRoute("/distribution/campaigns")({
  loader: () => getCurrentUser(),
  component: CampaignsPage,
});

function CampaignsPage() {
  const user = Route.useLoaderData();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string; list_id: string; render_job_id: string | null; message_template: string | null; status: string; sent_count: number; delivered_count: number; created_at: string }>>([]);
  const [lists, setLists] = useState<Array<{ id: string; name: string }>>([]);
  const [renders, setRenders] = useState<Array<{ id: string; projectName: string; outputUrl: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ id: string; contact_id: string; status: string; sent_at: string | null; delivered_at: string | null; error_message: string | null }>>([]);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; skipped: number } | null>(null);

  // Create form state
  const [formListId, setFormListId] = useState("");
  const [formRenderId, setFormRenderId] = useState("");
  const [formName, setFormName] = useState("");
  const [formTemplate, setFormTemplate] = useState("Check out our new video: {{link}}");

  useEffect(() => { if (!user) { navigate({ to: "/login" }); return; } loadData(); }, [user, navigate]);

  async function loadData() {
    setLoading(true);
    const [c, l, r] = await Promise.all([fetchCampaigns(), fetchLists(), fetchCompletedRenders()]);
    setCampaigns(c);
    setLists(l);
    setRenders(r);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formListId || !formRenderId || !formName.trim()) return;
    await createCampaignFn({ listId: formListId, renderJobId: formRenderId, name: formName.trim(), messageTemplate: formTemplate.trim() || undefined });
    setShowCreate(false);
    setFormListId("");
    setFormRenderId("");
    setFormName("");
    setFormTemplate("Check out our new video: {{link}}");
    await loadData();
  }

  async function handleSend(campaignId: string) {
    if (!confirm("Send this campaign? Only consented, non-opted-out contacts will receive it.")) return;
    setSending(true);
    setSendResult(null);
    try {
      const result = await sendCampaignFn({ campaignId });
      setSendResult(result);
      await loadData();
    } catch (err) {
      alert("Failed to send: " + (err as Error).message);
    }
    setSending(false);
  }

  async function viewMessages(campaignId: string) {
    setSelectedCampaign(campaignId === selectedCampaign ? null : campaignId);
    if (campaignId !== selectedCampaign) {
      const msgs = await fetchCampaignMessages({ campaignId });
      setMessages(msgs);
      setSendResult(null);
    }
  }

  if (!user) return null;

  const selectedRender = renders.find((r) => r.id === formRenderId);
  const previewText = formTemplate.replace("{{link}}", selectedRender?.outputUrl || "[video link]").replace("{{name}}", "Customer");

  return (
    <div className="min-h-[calc(100dvh-65px)] bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/distribution" className="text-sm text-indigo-600 hover:underline mb-1 inline-block">&larr; Distribution</Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SMS Campaigns</h1>
          </div>
          <button onClick={() => { setShowCreate(true); setSendResult(null); }} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            + New Campaign
          </button>
        </div>

        {sendResult && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              Campaign sent! {sendResult.sent} delivered, {sendResult.skipped} skipped (consent/opt-out).
            </p>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800/50">
            <p className="text-sm text-gray-500">Loading campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-600 dark:bg-gray-800/50">
            <div className="text-4xl mb-3">📱</div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No campaigns yet</p>
            <p className="mt-1 text-xs text-gray-500">Create a campaign to send your video ads via SMS.</p>
            <button onClick={() => setShowCreate(true)} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Create your first campaign</button>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((c) => (
              <div key={c.id} className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50 overflow-hidden">
                <div className="p-4 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{c.name}</p>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      List: {lists.find((l) => l.id === c.list_id)?.name || "Unknown"} &middot; {c.delivered_count}/{c.sent_count} delivered &middot; {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => viewMessages(c.id)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                      {selectedCampaign === c.id ? "Hide Details" : "View Details"}
                    </button>
                    {c.status === "draft" && (
                      <button onClick={() => handleSend(c.id)} disabled={sending} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                        {sending ? "Sending..." : "Send"}
                      </button>
                    )}
                  </div>
                </div>
                {selectedCampaign === c.id && (
                  <div className="border-t border-gray-100 p-4 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Message Status ({messages.length})</h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {messages.map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                          <span className="text-gray-600 dark:text-gray-400">Contact {m.contact_id.slice(0, 8)}...</span>
                          <span className={`font-medium ${
                            m.status === "delivered" ? "text-green-600" :
                            m.status === "failed" ? "text-red-600" :
                            m.status === "opted_out" ? "text-orange-600" :
                            "text-gray-500"
                          }`}>{m.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Campaign Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New SMS Campaign</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Campaign Name</label>
                <input required value={formName} onChange={(e) => setFormName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" placeholder="Spring Sale Blast" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contact List</label>
                <select required value={formListId} onChange={(e) => setFormListId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                  <option value="">Select a list...</option>
                  {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Video (Completed Renders)</label>
                <select required value={formRenderId} onChange={(e) => setFormRenderId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                  <option value="">Select a video...</option>
                  {renders.map((r) => <option key={r.id} value={r.id}>{r.projectName}</option>)}
                </select>
                {renders.length === 0 && <p className="text-xs text-orange-500 mt-1">No completed renders yet. Create one in the Studio first.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message Template</label>
                <textarea value={formTemplate} onChange={(e) => setFormTemplate(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                <p className="text-xs text-gray-500 mt-1">Use <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{`{{link}}`}</code> for the video URL and <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{`{{name}}`}</code> for the contact name.</p>
              </div>
              {/* Preview */}
              {formTemplate && (
                <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-800">
                  <p className="text-xs font-medium text-gray-500 mb-1">Preview:</p>
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 dark:bg-green-950/30 dark:border-green-800">
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{previewText}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
                <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Create Campaign</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    sending: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${colors[status] || colors.draft}`}>
      {status}
    </span>
  );
}
