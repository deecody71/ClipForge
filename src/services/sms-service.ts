import { sql, ensureContactListsTable, ensureContactsTable, ensureSmsCampaignsTable, ensureSmsMessagesTable } from "~/db";

export interface ContactList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  contact_count: number;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  list_id: string;
  phone_number: string;
  name: string | null;
  consent: boolean;
  consent_date: string | null;
  opted_out: boolean;
  opted_out_date: string | null;
  created_at: string;
}

export interface SmsCampaign {
  id: string;
  user_id: string;
  list_id: string;
  render_job_id: string | null;
  name: string;
  message_template: string | null;
  status: "draft" | "sending" | "completed" | "failed";
  sent_count: number;
  delivered_count: number;
  created_at: string;
  updated_at: string;
}

export interface SmsMessage {
  id: string;
  campaign_id: string;
  contact_id: string;
  status: "queued" | "sent" | "delivered" | "failed" | "opted_out";
  sent_at: string | null;
  delivered_at: string | null;
  error_message: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Contact Lists ────────────────────────────────────────────────

export async function createContactList(
  userId: string,
  name: string,
  description?: string,
): Promise<ContactList> {
  await ensureContactListsTable();
  const db = sql();
  const rows = await db`
    INSERT INTO contact_lists (user_id, name, description, contact_count)
    VALUES (${userId}, ${name}, ${description || null}, 0)
    RETURNING id, user_id, name, description, contact_count, created_at, updated_at
  `;
  return rowToList(rows[0]);
}

export async function getUserContactLists(userId: string): Promise<ContactList[]> {
  await ensureContactListsTable();
  const db = sql();
  const rows = await db`
    SELECT id, user_id, name, description, contact_count, created_at, updated_at
    FROM contact_lists
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows.map(rowToList);
}

export async function getContactList(listId: string, userId: string): Promise<ContactList | null> {
  await ensureContactListsTable();
  const db = sql();
  const rows = await db`
    SELECT id, user_id, name, description, contact_count, created_at, updated_at
    FROM contact_lists
    WHERE id = ${listId} AND user_id = ${userId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rowToList(rows[0]);
}

export async function deleteContactList(listId: string, userId: string): Promise<boolean> {
  await ensureContactListsTable();
  const db = sql();
  const result = await db`
    DELETE FROM contact_lists
    WHERE id = ${listId} AND user_id = ${userId}
  `;
  return result.count > 0;
}

// ─── Contacts ─────────────────────────────────────────────────────

export async function addContact(
  listId: string,
  userId: string,
  phoneNumber: string,
  name?: string,
  consent = false,
): Promise<Contact & { skipped?: boolean; reason?: string }> {
  await ensureContactListsTable();
  await ensureContactsTable();
  const db = sql();

  // Verify list ownership
  const list = await getContactList(listId, userId);
  if (!list) throw new Error("Contact list not found");

  // Enforce consent
  if (!consent) {
    return {
      id: "",
      list_id: listId,
      phone_number: phoneNumber,
      name: name || null,
      consent: false,
      consent_date: null,
      opted_out: false,
      opted_out_date: null,
      created_at: "",
      skipped: true,
      reason: "Consent not provided — contact must have consent to be added",
    };
  }

  // Upsert: if phone exists in this list, update; otherwise insert
  const rows = await db`
    INSERT INTO contacts (list_id, phone_number, name, consent, consent_date)
    VALUES (${listId}, ${phoneNumber}, ${name || null}, true, now())
    ON CONFLICT (list_id, phone_number)
    DO UPDATE SET name = COALESCE(${name || null}, contacts.name),
                  consent = true,
                  consent_date = now()
    RETURNING id, list_id, phone_number, name, consent, consent_date, opted_out, opted_out_date, created_at
  `;

  // Update contact count
  await db`
    UPDATE contact_lists
    SET contact_count = (SELECT COUNT(*) FROM contacts WHERE list_id = ${listId}),
        updated_at = now()
    WHERE id = ${listId}
  `;

  return rowToContact(rows[0]);
}

export async function getContactsInList(listId: string, userId: string): Promise<Contact[]> {
  await ensureContactListsTable();
  await ensureContactsTable();
  const db = sql();

  // Verify ownership
  const list = await getContactList(listId, userId);
  if (!list) return [];

  const rows = await db`
    SELECT id, list_id, phone_number, name, consent, consent_date, opted_out, opted_out_date, created_at
    FROM contacts
    WHERE list_id = ${listId}
    ORDER BY created_at DESC
  `;
  return rows.map(rowToContact);
}

export async function deleteContact(contactId: string, listId: string, userId: string): Promise<boolean> {
  await ensureContactListsTable();
  await ensureContactsTable();
  const db = sql();

  // Verify ownership
  const list = await getContactList(listId, userId);
  if (!list) return false;

  await db`
    DELETE FROM contacts
    WHERE id = ${contactId} AND list_id = ${listId}
  `;

  // Update contact count
  await db`
    UPDATE contact_lists
    SET contact_count = (SELECT COUNT(*) FROM contacts WHERE list_id = ${listId}),
        updated_at = now()
    WHERE id = ${listId}
  `;

  return true;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  reasons: string[];
}

export async function importContactsCsv(
  listId: string,
  userId: string,
  csvText: string,
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, reasons: [] };

  // Verify list ownership
  const list = await getContactList(listId, userId);
  if (!list) {
    result.reasons.push("Contact list not found");
    return result;
  }

  // Parse CSV (simple parser: header + lines, supports quoted fields)
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) {
    result.reasons.push("CSV must have a header row and at least one data row");
    return result;
  }

  const header = parseCsvLine(lines[0]);
  const phoneIdx = header.findIndex((h) => h.toLowerCase().trim() === "phone");
  const nameIdx = header.findIndex((h) => h.toLowerCase().trim() === "name");
  const consentIdx = header.findIndex((h) => h.toLowerCase().trim() === "consent");

  if (phoneIdx === -1) {
    result.reasons.push("CSV must have a 'phone' column");
    return result;
  }

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length === 0) continue; // skip empty lines

    const phone = row[phoneIdx]?.trim();
    const name = nameIdx !== -1 ? row[nameIdx]?.trim() : undefined;
    const consentRaw = consentIdx !== -1 ? row[consentIdx]?.trim().toLowerCase() : "false";

    // Validate phone number (basic E.164-ish: at least 10 chars of digits/+/spaces)
    if (!phone || phone.replace(/[\s\-\(\)]/g, "").replace(/[^\d+]/g, "").length < 10) {
      result.skipped++;
      result.reasons.push(`Row ${i}: Invalid phone number "${phone}"`);
      continue;
    }

    const cleanedPhone = phone.replace(/[\s\-\(\)]/g, "");

    // Consent check
    if (consentRaw !== "true" && consentRaw !== "yes") {
      result.skipped++;
      result.reasons.push(`Row ${i}: No consent for ${cleanedPhone}`);
      continue;
    }

    try {
      await addContact(listId, userId, cleanedPhone, name || undefined, true);
      result.imported++;
    } catch (err) {
      result.skipped++;
      result.reasons.push(`Row ${i}: ${(err as Error).message}`);
    }
  }

  return result;
}

// ─── SMS Campaigns ────────────────────────────────────────────────

export async function createCampaign(
  userId: string,
  listId: string,
  renderJobId: string,
  name: string,
  messageTemplate?: string,
): Promise<SmsCampaign> {
  await ensureSmsCampaignsTable();
  const db = sql();
  const rows = await db`
    INSERT INTO sms_campaigns (user_id, list_id, render_job_id, name, message_template, status)
    VALUES (${userId}, ${listId}, ${renderJobId || null}, ${name}, ${messageTemplate || null}, 'draft')
    RETURNING id, user_id, list_id, render_job_id, name, message_template, status, sent_count, delivered_count, created_at, updated_at
  `;
  return rowToCampaign(rows[0]);
}

export async function getUserCampaigns(userId: string): Promise<SmsCampaign[]> {
  await ensureSmsCampaignsTable();
  const db = sql();
  const rows = await db`
    SELECT id, user_id, list_id, render_job_id, name, message_template, status, sent_count, delivered_count, created_at, updated_at
    FROM sms_campaigns
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows.map(rowToCampaign);
}

export async function getCampaign(campaignId: string, userId: string): Promise<SmsCampaign | null> {
  await ensureSmsCampaignsTable();
  const db = sql();
  const rows = await db`
    SELECT id, user_id, list_id, render_job_id, name, message_template, status, sent_count, delivered_count, created_at, updated_at
    FROM sms_campaigns
    WHERE id = ${campaignId} AND user_id = ${userId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rowToCampaign(rows[0]);
}

export async function getCampaignMessages(campaignId: string, userId: string): Promise<SmsMessage[]> {
  await ensureSmsMessagesTable();
  const db = sql();
  // Verify ownership
  const campaign = await getCampaign(campaignId, userId);
  if (!campaign) return [];

  const rows = await db`
    SELECT id, campaign_id, contact_id, status, sent_at, delivered_at, error_message
    FROM sms_messages
    WHERE campaign_id = ${campaignId}
    ORDER BY status, sent_at DESC
  `;
  return rows.map(rowToMessage);
}

// ─── SMS Sending (simulated) ─────────────────────────────────────

/**
 * Send an SMS campaign. Only sends to consented, non-opted-out contacts.
 * For MVP, sending is simulated — logs to console and marks as delivered.
 */
export async function sendCampaign(campaignId: string, userId: string): Promise<{ sent: number; skipped: number }> {
  await ensureSmsCampaignsTable();
  await ensureSmsMessagesTable();
  await ensureContactsTable();
  const db = sql();

  // Verify ownership
  const campaign = await getCampaign(campaignId, userId);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "draft") throw new Error("Campaign can only be sent when in draft status");

  // Mark as sending
  await db`
    UPDATE sms_campaigns SET status = 'sending', updated_at = now() WHERE id = ${campaignId}
  `;

  // Get all contacts in the list that have consent and haven't opted out
  const contacts = await db`
    SELECT id, phone_number, name, consent, opted_out
    FROM contacts
    WHERE list_id = ${campaign.list_id}
  `;

  let sent = 0;
  let skipped = 0;

  for (const contact of contacts) {
    // CONSENT CHECK: skip if consent is false OR opted_out is true
    if (!contact.consent || contact.opted_out) {
      skipped++;
      // Create a record showing skipped due to consent/opt-out
      await db`
        INSERT INTO sms_messages (campaign_id, contact_id, status, error_message)
        VALUES (${campaignId}, ${contact.id}, 'opted_out', 'Contact not consented or has opted out')
      `;
      console.log(`[sms] AUDIT: Skipping ${contact.phone_number} — consent=${contact.consent}, opted_out=${contact.opted_out}`);
      continue;
    }

    // Create message record
    const msgRows = await db`
      INSERT INTO sms_messages (campaign_id, contact_id, status)
      VALUES (${campaignId}, ${contact.id}, 'queued')
      RETURNING id
    `;
    const messageId = msgRows[0].id;

    // Simulate sending
    const videoUrl = `https://clipforge.app/v/${campaign.render_job_id || "demo"}`;
    const body = (campaign.message_template || "Check out our new video: {{link}}")
      .replace("{{link}}", videoUrl)
      .replace("{{name}}", contact.name || "there");

    console.log(`[sms] AUDIT: Sending SMS to ${contact.phone_number}: "${body}" (msg_id=${messageId})`);

    // Mark as sent
    await db`
      UPDATE sms_messages SET status = 'sent', sent_at = now() WHERE id = ${messageId}
    `;

    // Simulate delivery delay
    await sleep(100);

    // Mark as delivered
    await db`
      UPDATE sms_messages SET status = 'delivered', delivered_at = now() WHERE id = ${messageId}
    `;
    sent++;
    console.log(`[sms] AUDIT: Delivered SMS to ${contact.phone_number} (msg_id=${messageId})`);
  }

  // Update campaign counts and status
  await db`
    UPDATE sms_campaigns
    SET status = 'completed', sent_count = ${sent}, delivered_count = ${sent}, updated_at = now()
    WHERE id = ${campaignId}
  `;

  console.log(`[sms] Campaign ${campaignId}: sent=${sent}, skipped=${skipped}`);
  return { sent, skipped };
}

/**
 * Process opt-out for a phone number across ALL contact lists.
 * Immediately sets opted_out=true for all contacts with that number.
 */
export async function processOptOut(phoneNumber: string): Promise<number> {
  await ensureContactsTable();
  const db = sql();
  const cleaned = phoneNumber.trim().replace(/[\s\-\(\)]/g, "");

  const result = await db`
    UPDATE contacts
    SET opted_out = true, opted_out_date = now()
    WHERE phone_number = ${cleaned}
  `;

  console.log(`[sms] AUDIT: Opt-out processed for ${cleaned} — ${result.count} contact(s) updated`);
  return result.count;
}

// ─── Stats ────────────────────────────────────────────────────────

export async function getDistributionStats(userId: string) {
  await ensureContactListsTable();
  await ensureContactsTable();
  await ensureSmsCampaignsTable();
  await ensureSmsMessagesTable();
  const db = sql();

  const [listResult] = await db`
    SELECT COUNT(*)::int AS total_lists,
           COALESCE(SUM(contact_count), 0)::int AS total_contacts
    FROM contact_lists
    WHERE user_id = ${userId}
  `;

  const [campaignResult] = await db`
    SELECT COUNT(*)::int AS total_campaigns,
           COUNT(*) FILTER (WHERE status = 'sending')::int AS active_campaigns
    FROM sms_campaigns
    WHERE user_id = ${userId}
  `;

  const [msgResult] = await db`
    SELECT COUNT(*)::int AS messages_this_month
    FROM sms_messages m
    JOIN sms_campaigns c ON m.campaign_id = c.id
    WHERE c.user_id = ${userId}
      AND m.created_at >= date_trunc('month', now())
  `;

  return {
    totalLists: listResult?.total_lists ?? 0,
    totalContacts: listResult?.total_contacts ?? 0,
    totalCampaigns: campaignResult?.total_campaigns ?? 0,
    activeCampaigns: campaignResult?.active_campaigns ?? 0,
    messagesThisMonth: msgResult?.messages_this_month ?? 0,
  };
}

// ─── Row mappers ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToList(row: any): ContactList {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    contact_count: row.contact_count,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToContact(row: any): Contact {
  return {
    id: row.id,
    list_id: row.list_id,
    phone_number: row.phone_number,
    name: row.name,
    consent: row.consent,
    consent_date: row.consent_date ? String(row.consent_date) : null,
    opted_out: row.opted_out,
    opted_out_date: row.opted_out_date ? String(row.opted_out_date) : null,
    created_at: String(row.created_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCampaign(row: any): SmsCampaign {
  return {
    id: row.id,
    user_id: row.user_id,
    list_id: row.list_id,
    render_job_id: row.render_job_id,
    name: row.name,
    message_template: row.message_template,
    status: row.status,
    sent_count: row.sent_count,
    delivered_count: row.delivered_count,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMessage(row: any): SmsMessage {
  return {
    id: row.id,
    campaign_id: row.campaign_id,
    contact_id: row.contact_id,
    status: row.status,
    sent_at: row.sent_at ? String(row.sent_at) : null,
    delivered_at: row.delivered_at ? String(row.delivered_at) : null,
    error_message: row.error_message,
  };
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
