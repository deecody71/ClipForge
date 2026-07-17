import { sql } from "~/db";
import { trackEvent } from "~/services/analytics-service";

const CHANNELS = ["instagram", "tiktok", "youtube", "facebook", "linkedin", "x", "sms", "direct"] as const;
const CHANNEL_WEIGHTS: Record<string, number> = {
  instagram: 30,
  tiktok: 28,
  youtube: 15,
  facebook: 12,
  linkedin: 5,
  x: 5,
  sms: 3,
  direct: 2,
};

function weightedRandomChannel(): string {
  const total = Object.values(CHANNEL_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [channel, weight] of Object.entries(CHANNEL_WEIGHTS)) {
    r -= weight;
    if (r <= 0) return channel;
  }
  return "direct";
}

function randomViewerId(): string {
  const chars = "abcdef0123456789";
  let id = "viewer_";
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Generate 30 days of plausible mock analytics data for all the user's completed render jobs.
 * Called on first visit to analytics if the user has completed jobs but no analytics data.
 */
export async function seedAnalyticsData(userId: string): Promise<{ seeded: number }> {
  const db = sql();

  // Find all completed render jobs for the user
  const jobs = await db`
    SELECT id FROM render_jobs
    WHERE user_id = ${userId} AND status = 'completed'
  `;

  if (jobs.length === 0) {
    return { seeded: 0 };
  }

  // Check if analytics data already exists for this user
  const existing = await db`
    SELECT COUNT(*)::int AS count FROM analytics_events WHERE user_id = ${userId}
  `;
  if (existing[0]?.count > 0) {
    return { seeded: 0 };
  }

  let totalEvents = 0;
  const now = new Date();

  for (const job of jobs) {
    // Each video gets a base view count that varies (200-2000 views over 30 days)
    const baseViews = Math.floor(Math.random() * 1800) + 200;

    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const eventDate = new Date(now);
      eventDate.setDate(eventDate.getDate() - (29 - dayOffset));

      // Views taper off over time (more views on recent days)
      const dayWeight = 0.5 + (dayOffset / 30) * 0.5; // 0.5 to 1.0, recent days get more
      const dayViews = Math.floor((baseViews / 30) * dayWeight * (0.5 + Math.random()));

      for (let v = 0; v < dayViews; v++) {
        const channel = weightedRandomChannel();
        const viewerId = randomViewerId();
        const watchDuration = Math.floor(Math.random() * 120) + 1; // 1-120 seconds

        // Override created_at with the simulated date
        const dbForEvent = sql();
        await dbForEvent`
          INSERT INTO analytics_events
            (render_job_id, user_id, event_type, channel, viewer_id, watch_duration_seconds, created_at)
          VALUES
            (${job.id}, ${userId}, 'view', ${channel}, ${viewerId}, ${watchDuration}, ${eventDate.toISOString()})
        `;
        totalEvents++;

        // ~40% completion rate
        if (Math.random() < 0.4) {
          await dbForEvent`
            INSERT INTO analytics_events
              (render_job_id, user_id, event_type, channel, viewer_id, created_at)
            VALUES
              (${job.id}, ${userId}, 'completion', ${channel}, ${viewerId}, ${eventDate.toISOString()})
          `;
          totalEvents++;
        }

        // ~8% click rate
        if (Math.random() < 0.08) {
          await dbForEvent`
            INSERT INTO analytics_events
              (render_job_id, user_id, event_type, channel, viewer_id, created_at)
            VALUES
              (${job.id}, ${userId}, 'click', ${channel}, null, ${eventDate.toISOString()})
          `;
          totalEvents++;
        }
      }

      // ~3% share rate of daily views
      const shares = Math.floor(dayViews * 0.03 * Math.random());
      for (let s = 0; s < shares; s++) {
        const channel = weightedRandomChannel();
        await sql()`
          INSERT INTO analytics_events
            (render_job_id, user_id, event_type, channel, created_at)
          VALUES
            (${job.id}, ${userId}, 'share', ${channel}, ${eventDate.toISOString()})
        `;
        totalEvents++;
      }
    }

    // Now populate the daily summary for this job by aggregating the raw events
    await db`
      INSERT INTO analytics_daily_summary (render_job_id, user_id, date, channel, views, unique_viewers, completions, clicks, shares, total_watch_seconds)
      SELECT
        render_job_id,
        user_id,
        DATE(created_at) AS date,
        channel,
        COUNT(*) FILTER (WHERE event_type = 'view')::int AS views,
        COUNT(DISTINCT viewer_id) FILTER (WHERE event_type = 'view')::int AS unique_viewers,
        COUNT(*) FILTER (WHERE event_type = 'completion')::int AS completions,
        COUNT(*) FILTER (WHERE event_type = 'click')::int AS clicks,
        COUNT(*) FILTER (WHERE event_type = 'share')::int AS shares,
        COALESCE(SUM(watch_duration_seconds) FILTER (WHERE event_type = 'view'), 0)::int AS total_watch_seconds
      FROM analytics_events
      WHERE render_job_id = ${job.id} AND user_id = ${userId}
      GROUP BY render_job_id, user_id, DATE(created_at), channel
      ON CONFLICT (render_job_id, date, channel) DO NOTHING
    `;
  }

  return { seeded: totalEvents };
}
