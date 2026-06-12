import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Brand colours ─────────────────────────────────────────────────────────────
const BRAND_BLUE = "#3b82f6";
const BRAND_DARK = "#0f172a";

// ── Event metadata ────────────────────────────────────────────────────────────
const EVENT_LABELS: Record<string, string> = {
  template_added:             "Template Added",
  template_updated:           "Template Updated",
  template_deprecated:        "Template Deprecated",
  new_feedback:               "New Feedback Submitted",
  feedback_resolved:          "Feedback Resolved",
  new_driver_bug:             "New Driver Bug",
  driver_bug_status_changed:  "Driver Bug Status Changed",
  new_template_request:       "New Template Request",
  template_request_approved:  "Template Request Approved",
  executive_report_generated: "Executive Report Generated",
  weekly_executive_summary:   "Weekly Executive Summary",
};

// ── HTML email template ───────────────────────────────────────────────────────
function buildHtml(subject: string, bodyLines: string[], eventType: string): string {
  const eventLabel = EVENT_LABELS[eventType] || eventType;
  const rows = bodyLines.map(line =>
    line.startsWith("##")
      ? `<h2 style="margin:24px 0 8px;font-size:15px;font-weight:600;color:${BRAND_DARK}">${line.slice(2).trim()}</h2>`
      : line.startsWith("---")
      ? `<hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0"/>`
      : `<p style="margin:4px 0;font-size:14px;color:#334155;line-height:1.6">${line}</p>`
  ).join("\n");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Header -->
        <tr>
          <td style="background:${BRAND_DARK};border-radius:12px 12px 0 0;padding:24px 32px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="display:inline-block;background:${BRAND_BLUE};border-radius:8px;padding:6px 10px;margin-bottom:12px">
                    <span style="color:white;font-size:14px;font-weight:700">⚡ Template Echo</span>
                  </div>
                  <h1 style="margin:0;color:white;font-size:20px;font-weight:700;line-height:1.3">${subject}</h1>
                  <p style="margin:6px 0 0;color:#94a3b8;font-size:13px">${eventLabel}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:white;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
            ${rows}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f1f5f9;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:0;padding:20px 32px">
            <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center">
              You received this email because you have an active notification subscription on Template Echo.<br>
              To manage your preferences, visit the <strong>My Notifications</strong> page in the app.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Weekly executive summary builder ─────────────────────────────────────────
async function buildWeeklySummary(supabaseAdmin: ReturnType<typeof createClient>): Promise<{ subject: string; lines: string[] }> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [modelsRes, feedbackRes, bugsRes, trRes, ratingsRes] = await Promise.all([
    supabaseAdmin.from("relay_models").select("id, model_name, manufacturer, status, created_at, updated_at"),
    supabaseAdmin.from("feedback_entries").select("id, status, severity, created_at"),
    supabaseAdmin.from("driver_bugs").select("id, status, created_at"),
    supabaseAdmin.from("template_requests").select("id, title, relay_model, manufacturer, status, created_at"),
    supabaseAdmin.from("relay_model_ratings").select("id, created_at").eq("is_flagged", false),
  ]);

  const models = modelsRes.data || [];
  const feedback = feedbackRes.data || [];
  const bugs = bugsRes.data || [];
  const trs = trRes.data || [];
  const ratings = ratingsRes.data || [];

  const newModels = models.filter(m => m.created_at >= weekAgo);
  const updatedModels = models.filter(m => m.updated_at >= weekAgo && m.created_at < weekAgo);
  const openFeedback = feedback.filter(f => ["open", "in_progress"].includes(f.status));
  const resolvedFeedback = feedback.filter(f => ["resolved", "closed"].includes(f.status) && f.created_at >= weekAgo);
  const newBugs = bugs.filter(b => b.created_at >= weekAgo);
  const newTRs = trs.filter(t => t.created_at >= weekAgo);
  const approvedTRs = trs.filter(t => t.status === "Approved");
  const newRatings = ratings.filter(r => r.created_at >= weekAgo);

  // Top requested relay models this week
  const trModelMap = new Map<string, number>();
  trs.forEach(t => trModelMap.set(t.relay_model, (trModelMap.get(t.relay_model) || 0) + 1));
  const topModels = [...trModelMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const lines: string[] = [
    `Weekly activity summary for Template Echo — ${new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
    "---",
    "## Templates",
    `<strong>${newModels.length}</strong> templates added this week`,
    `<strong>${updatedModels.length}</strong> templates updated this week`,
    "---",
    "## Feedback & Issues",
    `<strong>${openFeedback.length}</strong> open issues currently`,
    `<strong>${resolvedFeedback.length}</strong> issues resolved this week`,
    `<strong>${newBugs.length}</strong> new driver bugs reported`,
    "---",
    "## Template Requests",
    `<strong>${newTRs.length}</strong> new template requests this week`,
    `<strong>${approvedTRs.length}</strong> total requests approved`,
  ];

  if (topModels.length > 0) {
    lines.push("---", "## Top Requested Relay Models");
    topModels.forEach(([model, count], i) => {
      lines.push(`${i + 1}. <strong>${model}</strong> — ${count} request${count !== 1 ? "s" : ""}`);
    });
  }

  lines.push("---", "## Community Activity", `<strong>${newRatings.length}</strong> community ratings submitted this week`);

  return {
    subject: `[Template Echo] Weekly Executive Summary — ${new Date().toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}`,
    lines,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey   = Deno.env.get("RESEND_API_KEY") || "";
    const fromEmail   = Deno.env.get("NOTIFY_FROM_EMAIL") || "notifications@templateecho.app";

    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json() as {
      event_type: string;
      event_id?: string;
      subject?: string;
      body_lines?: string[];
      triggered_by?: string;
    };

    const { event_type, event_id, triggered_by } = body;

    if (!event_type) {
      return new Response(JSON.stringify({ error: "event_type required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build content for weekly summary on-demand
    let subject = body.subject || `[Template Echo] ${EVENT_LABELS[event_type] || event_type}`;
    let bodyLines = body.body_lines || [`A ${EVENT_LABELS[event_type] || event_type} event occurred.`];

    if (event_type === "weekly_executive_summary") {
      const summary = await buildWeeklySummary(admin);
      subject = summary.subject;
      bodyLines = summary.lines;
    }

    // Find immediate subscribers for this event
    const { data: subs } = await admin
      .from("notification_subscriptions")
      .select("user_id, frequency")
      .eq("event_type", event_type)
      .eq("enabled", true);

    const immediateUserIds = (subs || [])
      .filter(s => s.frequency === "immediate")
      .map(s => s.user_id);

    // Get their emails
    let recipients: string[] = [];
    if (immediateUserIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("email")
        .in("id", immediateUserIds)
        .eq("active", true);
      recipients = (profiles || []).map(p => p.email).filter(Boolean);
    }

    const htmlBody = buildHtml(subject, bodyLines, event_type);
    let status = "pending";
    let errorMessage: string | null = null;
    let sentAt: string | null = null;

    // Send via Resend if API key is configured and there are recipients
    if (resendKey && recipients.length > 0) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: fromEmail,
            to: recipients,
            subject,
            html: htmlBody,
          }),
        });
        if (res.ok) {
          status = "sent";
          sentAt = new Date().toISOString();
        } else {
          const errBody = await res.text();
          status = "failed";
          errorMessage = `Resend API error ${res.status}: ${errBody}`;
        }
      } catch (e: any) {
        status = "failed";
        errorMessage = e.message || "Unknown send error";
      }
    } else if (!resendKey) {
      status = "skipped";
      errorMessage = "RESEND_API_KEY not configured";
    } else {
      status = "skipped";
      errorMessage = "No subscribers for this event";
    }

    // Log the notification
    await admin.from("notification_logs").insert({
      event_type,
      event_id: event_id || null,
      subject,
      body_html: htmlBody,
      recipients,
      status,
      error_message: errorMessage,
      triggered_by: triggered_by || null,
      sent_at: sentAt,
    });

    return new Response(
      JSON.stringify({ success: true, status, recipients_count: recipients.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
