import { sql, ensureAnalyticsEventsTable, ensureAnalyticsDailySummaryTable } from "~/db";

// ── Types ──

export interface AnalyticsEvent {
  renderJobId: string;
  userId: string;
  eventType: "view" | "completion" | "click" | "share" | "sms_delivered" | "sms_link_click";
  channel: "instagram" | "tiktok" | "youtube" | "facebook" | "linkedin" | "x" | "sms" | "direct";
  viewerId?: string;
  watchDurationSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface VideoAnalytics {
  jobId: string;
  projectName: string;
  totalViews: number;
  uniqueViewers: number;
  completionRate: number;
  avgWatchTime: number;
  clicks: number;
  shares: number;
  channelBreakdown: { channel: string; views: number; percentage: number }[];
}

export interface DashboardAnalytics {
  totalViews: number;
  totalCompletions: number;
  completionRate: number;
  totalClicks: number;
  totalShares: number;
  videosPublished: number;
  topVideos: {
    jobId: string;
    projectName: string;
    views: number;
    completionRate: number;
    clicks: number;
    createdAt: string;
  }[];
}

export interface ChannelBreakdown {
  channel: string;
  views: number;
  percentage: number;
}

export interface TrendDataPoint {
  date: string;
  views: number;
  completions: number;
}

// ── Tracking ──

export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  await ensureAnalyticsEventsTable();
  await ensureAnalyticsDailySummaryTable();
  const db = sql();

  // Insert the raw event
  await db`
    INSERT INTO analytics_events (render_job_id, user_id, event_type, channel, viewer_id, watch_duration_seconds, metadata)
    VALUES (${event.renderJobId}, ${event.userId}, ${event.eventType}, ${event.channel},
            ${event.viewerId ?? null}, ${event.watchDurationSeconds ?? null},
            ${JSON.stringify(event.metadata ?? {})}::jsonb)
  `;

  // Upsert daily summary
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const viewIncrement = event.eventType === "view" ? 1 : 0;
  const completionIncrement = event.eventType === "completion" ? 1 : 0;
  const clickIncrement = event.eventType === "click" ? 1 : 0;
  const shareIncrement = event.eventType === "share" ? 1 : 0;
  const watchSeconds = event.watchDurationSeconds ?? 0;

  // Count unique viewers: only increment if this viewer hasn't been seen today for this job+channel
  let uniqueIncrement = 0;
  if (event.eventType === "view" && event.viewerId) {
    const existingViewer = await db`
      SELECT id FROM analytics_events
      WHERE render_job_id = ${event.renderJobId}
        AND channel = ${event.channel}
        AND viewer_id = ${event.viewerId}
        AND event_type = 'view'
        AND DATE(created_at) = ${today}::date
      LIMIT 1
    `;
    // If this is the first event from this viewer today, it's unique
    // We check if there's exactly one row (the one we just inserted)
    if (existingViewer.length <= 1) {
      uniqueIncrement = 1;
    }
  }

  await db`
    INSERT INTO analytics_daily_summary
      (render_job_id, user_id, date, channel, views, unique_viewers, completions, clicks, shares, total_watch_seconds)
    VALUES
      (${event.renderJobId}, ${event.userId}, ${today}::date, ${event.channel},
       ${viewIncrement}, ${uniqueIncrement}, ${completionIncrement}, ${clickIncrement}, ${shareIncrement}, ${watchSeconds})
    ON CONFLICT (render_job_id, date, channel) DO UPDATE SET
      views = analytics_daily_summary.views + ${viewIncrement},
      unique_viewers = analytics_daily_summary.unique_viewers + ${uniqueIncrement},
      completions = analytics_daily_summary.completions + ${completionIncrement},
      clicks = analytics_daily_summary.clicks + ${clickIncrement},
      shares = analytics_daily_summary.shares + ${shareIncrement},
      total_watch_seconds = analytics_daily_summary.total_watch_seconds + ${watchSeconds}
  `;
}

export async function trackView(
  renderJobId: string,
  userId: string,
  channel: string,
  viewerId?: string,
  watchDuration?: number,
): Promise<void> {
  await trackEvent({
    renderJobId,
    userId,
    eventType: "view",
    channel: channel as AnalyticsEvent["channel"],
    viewerId,
    watchDurationSeconds: watchDuration,
  });
}

export async function trackCompletion(
  renderJobId: string,
  userId: string,
  channel: string,
  viewerId?: string,
): Promise<void> {
  await trackEvent({
    renderJobId,
    userId,
    eventType: "completion",
    channel: channel as AnalyticsEvent["channel"],
    viewerId,
  });
}

export async function trackClick(
  renderJobId: string,
  userId: string,
  channel: string,
): Promise<void> {
  await trackEvent({
    renderJobId,
    userId,
    eventType: "click",
    channel: channel as AnalyticsEvent["channel"],
  });
}

// ── Aggregation ──

export async function getVideoAnalytics(
  renderJobId: string,
  userId: string,
): Promise<VideoAnalytics | null> {
  await ensureAnalyticsDailySummaryTable();
  const db = sql();

  const jobRows = await db`
    SELECT project_name FROM render_jobs WHERE id = ${renderJobId} AND user_id = ${userId} LIMIT 1
  `;
  if (jobRows.length === 0) return null;

  const summaryRows = await db`
    SELECT
      channel,
      SUM(views)::int AS views,
      SUM(unique_viewers)::int AS unique_viewers,
      SUM(completions)::int AS completions,
      SUM(clicks)::int AS clicks,
      SUM(shares)::int AS shares,
      SUM(total_watch_seconds)::int AS total_watch_seconds
    FROM analytics_daily_summary
    WHERE render_job_id = ${renderJobId} AND user_id = ${userId}
    GROUP BY channel
  `;

  const totalViews = summaryRows.reduce((s: number, r: { views: number }) => s + r.views, 0);
  const totalCompletions = summaryRows.reduce((s: number, r: { completions: number }) => s + r.completions, 0);
  const totalWatchSeconds = summaryRows.reduce((s: number, r: { total_watch_seconds: number }) => s + r.total_watch_seconds, 0);
  const uniqueViewers = summaryRows.reduce((s: number, r: { unique_viewers: number }) => s + r.unique_viewers, 0);
  const totalClicks = summaryRows.reduce((s: number, r: { clicks: number }) => s + r.clicks, 0);
  const totalShares = summaryRows.reduce((s: number, r: { shares: number }) => s + r.shares, 0);

  const completionRate = totalViews > 0 ? Math.round((totalCompletions / totalViews) * 100) : 0;
  const avgWatchTime = totalViews > 0 ? Math.round(totalWatchSeconds / totalViews) : 0;

  const channelBreakdown = summaryRows.map((r: { channel: string; views: number }) => ({
    channel: r.channel,
    views: r.views,
    percentage: totalViews > 0 ? Math.round((r.views / totalViews) * 100) : 0,
  }));

  return {
    jobId: renderJobId,
    projectName: jobRows[0].project_name,
    totalViews,
    uniqueViewers,
    completionRate,
    avgWatchTime,
    clicks: totalClicks,
    shares: totalShares,
    channelBreakdown,
  };
}

export async function getDashboardAnalytics(userId: string): Promise<DashboardAnalytics> {
  await ensureAnalyticsDailySummaryTable();
  const db = sql();

  const summaryRows = await db`
    SELECT
      ads.render_job_id,
      rj.project_name,
      rj.created_at,
      SUM(ads.views)::int AS views,
      SUM(ads.completions)::int AS completions,
      SUM(ads.clicks)::int AS clicks,
      SUM(ads.shares)::int AS shares
    FROM analytics_daily_summary ads
    LEFT JOIN render_jobs rj ON ads.render_job_id = rj.id
    WHERE ads.user_id = ${userId}
    GROUP BY ads.render_job_id, rj.project_name, rj.created_at
    ORDER BY views DESC
  `;

  const totalViews = summaryRows.reduce((s: number, r: { views: number }) => s + r.views, 0);
  const totalCompletions = summaryRows.reduce((s: number, r: { completions: number }) => s + r.completions, 0);
  const totalClicks = summaryRows.reduce((s: number, r: { clicks: number }) => s + r.clicks, 0);
  const totalShares = summaryRows.reduce((s: number, r: { shares: number }) => s + r.shares, 0);
  const completionRate = totalViews > 0 ? Math.round((totalCompletions / totalViews) * 100) : 0;

  // Also count all render jobs (even those without analytics)
  const jobCountRow = await db`
    SELECT COUNT(*)::int AS count FROM render_jobs WHERE user_id = ${userId}
  `;

  const topVideos = summaryRows.slice(0, 5).map((r: {
    render_job_id: string;
    project_name: string;
    views: number;
    completions: number;
    clicks: number;
    created_at: string;
  }) => ({
    jobId: r.render_job_id,
    projectName: r.project_name,
    views: r.views,
    completionRate: r.views > 0 ? Math.round((r.completions / r.views) * 100) : 0,
    clicks: r.clicks,
    createdAt: String(r.created_at),
  }));

  return {
    totalViews,
    totalCompletions,
    completionRate,
    totalClicks,
    totalShares,
    videosPublished: jobCountRow[0]?.count ?? 0,
    topVideos,
  };
}

export async function getChannelBreakdown(userId: string): Promise<ChannelBreakdown[]> {
  await ensureAnalyticsDailySummaryTable();
  const db = sql();

  const rows = await db`
    SELECT
      channel,
      SUM(views)::int AS views
    FROM analytics_daily_summary
    WHERE user_id = ${userId}
    GROUP BY channel
    ORDER BY views DESC
  `;

  const totalViews = rows.reduce((s: number, r: { views: number }) => s + r.views, 0);

  return rows.map((r: { channel: string; views: number }) => ({
    channel: r.channel,
    views: r.views,
    percentage: totalViews > 0 ? Math.round((r.views / totalViews) * 100) : 0,
  }));
}

export async function getTrendData(
  userId: string,
  days = 30,
): Promise<TrendDataPoint[]> {
  await ensureAnalyticsDailySummaryTable();
  const db = sql();

  const rows = await db`
    SELECT
      date::text AS date,
      SUM(views)::int AS views,
      SUM(completions)::int AS completions
    FROM analytics_daily_summary
    WHERE user_id = ${userId}
      AND date >= (CURRENT_DATE - ${days}::int * '1 day'::interval)
    GROUP BY date
    ORDER BY date ASC
  `;

  // Fill in missing dates with zeros
  const result: TrendDataPoint[] = [];
  const dataMap = new Map<string, { views: number; completions: number }>();
  for (const r of rows) {
    dataMap.set(r.date, { views: r.views, completions: r.completions });
  }

  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const data = dataMap.get(dateStr);
    result.push({
      date: dateStr,
      views: data?.views ?? 0,
      completions: data?.completions ?? 0,
    });
  }

  return result;
}

export async function getVideoTrendData(
  renderJobId: string,
  userId: string,
  days = 30,
): Promise<TrendDataPoint[]> {
  await ensureAnalyticsDailySummaryTable();
  const db = sql();

  const rows = await db`
    SELECT
      date::text AS date,
      SUM(views)::int AS views,
      SUM(completions)::int AS completions
    FROM analytics_daily_summary
    WHERE render_job_id = ${renderJobId}
      AND user_id = ${userId}
      AND date >= (CURRENT_DATE - ${days}::int * '1 day'::interval)
    GROUP BY date
    ORDER BY date ASC
  `;

  const result: TrendDataPoint[] = [];
  const dataMap = new Map<string, { views: number; completions: number }>();
  for (const r of rows) {
    dataMap.set(r.date, { views: r.views, completions: r.completions });
  }

  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const data = dataMap.get(dateStr);
    result.push({
      date: dateStr,
      views: data?.views ?? 0,
      completions: data?.completions ?? 0,
    });
  }

  return result;
}
