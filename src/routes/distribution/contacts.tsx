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

const fetchLists = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(TOKEN_COOKIE);
  if (!token || !verifyToken(token)) return [];
  const payload = verifyToken(token)!;
  const { getUserContactLists } = await import("~/services/sms-service");
  return getUserContactLists(payload.userId);
});

const fetchContacts = createServerFn({ method: "GET" })
  .validator((d: unknown) => (d as { listId: string }).listId)
  .handler(async ({ data }) => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(TOKEN_COOKIE);
    if (!token || !verifyToken(token)) return [];
    const payload = verifyToken(token)!;
    const { getContactsInList } = await import("~/services/sms-service");
    return getContactsInList(data.listId, payload.userId);
  });

const createList = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { name: string; description?: string })
  .handler(async ({ data }) => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(TOKEN_COOKIE);
    if (!token || !verifyToken(token)) throw new Error("Unauthorized");
    const payload = verifyToken(token)!;
    const { createContactList } = await import("~/services/sms-service");
    return createContactList(payload.userId, data.name, data.description);
  });

const addContactFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { listId: string; phone: string; name?: string; consent: boolean })
  .handler(async ({ data }) => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(TOKEN_COOKIE);
    if (!token || !verifyToken(token)) throw new Error("Unauthorized");
    const payload = verifyToken(token)!;
    const { addContact } = await import("~/services/sms-service");
    return addContact(data.listId, payload.userId, data.phone, data.name, data.consent);
  });

const deleteListFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { listId: string })
  .handler(async ({ data }) => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(TOKEN_COOKIE);
    if (!token || !verifyToken(token)) throw new Error("Unauthorized");
    const payload = verifyToken(token)!;
    const { deleteContactList } = await import("~/services/sms-service");
    return deleteContactList(data.listId, payload.userId);
  });

const importCsvFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { listId: string; csv: string })
  .handler(async ({ data }) => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(TOKEN_COOKIE);
    if (!token || !verifyToken(token)) throw new Error("Unauthorized");
    const payload = verifyToken(token)!;
    const { importContactsCsv } = await import("~/services/sms-service");
    return importContactsCsv(data.listId, payload.userId, data.csv);
  });

export const Route = createFileRoute("/distribution/contacts")({
  loader: () => getCurrentUser(),
  component: ContactsPage,
});

function ContactsPage() {
  const user = Route.useLoaderData();
  const navigate = useNavigate();
  const [lists, setLists] = useState<Array<{ id: string; name: string; description: string | null; contact_count: number; created_at: string }>>([]);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Array<{ id: string; phone_number: string; name: string | null; consent: boolean; opted_out: boolean; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [newConsent, setNewConsent] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; reasons: string[] } | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => { if (!user) { navigate({ to: "/login" }); return; } loadLists(); }, [user, navigate]);

  async function loadLists() {
    setLoading(true);
    const l = await fetchLists();
    setLists(l);
    setLoading(false);
    if (selectedList) {
      const sl = l.find((x) => x.id === selectedList);
      if (!sl) setSelectedList(null);
    }
  }

  async function loadContacts(listId: string) {
    setSelectedList(listId);
    const c = await fetchContacts({ listId });
    setContacts(c);
  }

  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim()) return;
    await createList({ name: newListName.trim(), description: newListDesc.trim() || undefined });
    setNewListName("");
    setNewListDesc("");
    setShowCreateModal(false);
    await loadLists();
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedList || !newPhone.trim()) return;
    if (!newConsent) { setMessage("Consent is required to add a contact."); return; }
    const result = await addContactFn({ listId: selectedList, phone: newPhone.trim(), name: newName.trim() || undefined, consent: newConsent });
    if ((result as { skipped?: boolean }).skipped) {
      setMessage("Contact requires consent to be added.");
    } else {
      setNewPhone("");
      setNewName("");
      setNewConsent(false);
      setShowAddModal(false);
      setMessage("");
      await loadContacts(selectedList);
      await loadLists();
    }
  }

  async function handleDeleteList(listId: string) {
    if (!confirm("Delete this list and all its contacts?")) return;
    await deleteListFn({ listId });
    if (selectedList === listId) { setSelectedList(null); setContacts([]); }
    await loadLists();
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedList || !csvText.trim()) return;
    const result = await importCsvFn({ listId: selectedList, csv: csvText });
    setImportResult(result);
    setShowImportModal(false);
    setCsvText("");
    await loadContacts(selectedList);
    await loadLists();
  }

  if (!user) return null;

  return (
    <div className="min-h-[calc(100dvh-65px)] bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/distribution" className="text-sm text-indigo-600 hover:underline mb-1 inline-block">&larr; Distribution</Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contacts</h1>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            + New List
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Lists sidebar */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Your Lists</h2>
              {loading ? <p className="text-sm text-gray-500">Loading...</p> :
                lists.length === 0 ? <p className="text-sm text-gray-500">No lists yet.</p> :
                <div className="space-y-1">
                  {lists.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => loadContacts(l.id)}
                      className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                        selectedList === l.id
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                          : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium truncate">{l.name}</span>
                        <span className="text-xs text-gray-400 ml-2">{l.contact_count}</span>
                      </div>
                    </button>
                  ))}
                </div>
              }
            </div>
          </div>

          {/* Contacts detail */}
          <div className="lg:col-span-2">
            {!selectedList ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-600 dark:bg-gray-800/50">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Select a list to view contacts</p>
                <p className="mt-1 text-xs text-gray-500">Or create a new list to get started.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    {lists.find((l) => l.id === selectedList)?.name} Contacts
                    <span className="ml-2 text-sm font-normal text-gray-500">({contacts.length})</span>
                  </h2>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddModal(true)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">+ Add</button>
                    <button onClick={() => { setShowImportModal(true); setImportResult(null); }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Import CSV</button>
                    <button onClick={() => handleDeleteList(selectedList)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50">Delete</button>
                  </div>
                </div>

                {message && (
                  <div className="px-4 pt-4">
                    <p className="text-sm text-red-600">{message}</p>
                  </div>
                )}

                <div className="p-4">
                  {contacts.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">No contacts in this list. Add one or import a CSV.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 dark:text-gray-400">
                            <th className="pb-2 font-medium">Phone</th>
                            <th className="pb-2 font-medium">Name</th>
                            <th className="pb-2 font-medium">Consent</th>
                            <th className="pb-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contacts.map((c) => (
                            <tr key={c.id} className="border-t border-gray-100 dark:border-gray-700">
                              <td className="py-2 text-gray-900 dark:text-white">{c.phone_number}</td>
                              <td className="py-2 text-gray-700 dark:text-gray-300">{c.name || "—"}</td>
                              <td className="py-2">{c.consent ? <span className="text-green-600 text-xs font-medium">Yes</span> : <span className="text-red-600 text-xs font-medium">No</span>}</td>
                              <td className="py-2">{c.opted_out ? <span className="text-xs text-red-500 font-medium">Opted out</span> : <span className="text-xs text-green-500">Active</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create List Modal */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)} title="Create Contact List">
          <form onSubmit={handleCreateList} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">List Name</label>
              <input required value={newListName} onChange={(e) => setNewListName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" placeholder="Spring Customers" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description (optional)</label>
              <input value={newListDesc} onChange={(e) => setNewListDesc(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Create</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)} title="Add Contact">
          <form onSubmit={handleAddContact} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label>
              <input required value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" placeholder="+15551234567" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name (optional)</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" placeholder="Jane Smith" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="add-consent" checked={newConsent} onChange={(e) => setNewConsent(e.target.checked)} className="rounded" />
              <label htmlFor="add-consent" className="text-sm text-gray-700 dark:text-gray-300">
                I have consent to contact this person via SMS <span className="text-red-500">*</span>
              </label>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Add</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <Modal onClose={() => setShowImportModal(false)} title="Import CSV">
          <form onSubmit={handleImport} className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">CSV must have columns: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">phone</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">name</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">consent</code> (true/yes). Only consenting contacts are imported.</p>
            <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={6} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-800 dark:text-white" placeholder={`phone,name,consent\n+15551234567,Jane Smith,true\n+15559876543,Bob Jones,yes`} />
            {importResult && (
              <div className="rounded-lg bg-gray-100 p-3 text-sm dark:bg-gray-800">
                <p>Imported: <strong>{importResult.imported}</strong> | Skipped: <strong>{importResult.skipped}</strong></p>
                {importResult.reasons.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-xs text-gray-500">
                    {importResult.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowImportModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Import</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}
