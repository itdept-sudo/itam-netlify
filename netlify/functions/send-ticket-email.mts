import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { to, userName, ticketId, ticketTitle, oldStatus, newStatus } = await req.json();

    if (!to || !ticketTitle || !newStatus) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    const siteUrl = Netlify.env.get("URL") || Netlify.env.get("SITE_URL") || "https://itam-desk-prosper.netlify.app";
    const resendKey = Netlify.env.get("RESEND_API_KEY");
    const emailFrom = Netlify.env.get("EMAIL_FROM") || "ITAM Desk <noreply@prosper-mfg.com>";

    const statusEmoji: Record<string, string> = { Abierto: "🔴", Proceso: "🟡", Cerrado: "🟢" };
    const statusColor: Record<string, string> = { Abierto: "#F87171", Proceso: "#FBBF24", Cerrado: "#34D399" };
    const statusBg: Record<string, string> = { Abierto: "rgba(239,68,68,0.1)", Proceso: "rgba(245,158,11,0.1)", Cerrado: "rgba(16,185,129,0.1)" };

    const subject = `${statusEmoji[newStatus] || "📋"} Ticket actualizado: ${ticketTitle}`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0B0E14;color:#E2E8F0;padding:40px 20px;">
<div style="max-width:480px;margin:0 auto;background:#151A24;border-radius:16px;border:1px solid #1E2533;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#3B82F6,#8B5CF6);padding:24px;text-align:center;">
    <h1 style="margin:0;font-size:20px;color:white;">ITAM<span style="opacity:0.8">desk</span></h1>
  </div>
  <div style="padding:32px 24px;">
    <p style="margin:0 0 8px;font-size:14px;color:#94A3B8;">Hola, ${userName || "Usuario"}</p>
    <h2 style="margin:0 0 24px;font-size:18px;color:#F1F5F9;">Tu ticket ha sido actualizado</h2>
    <div style="background:#0B0E14;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:13px;color:#64748B;">Ticket</p>
      <p style="margin:0 0 16px;font-size:15px;color:#E2E8F0;font-weight:600;">${ticketTitle}</p>
      <div style="display:flex;gap:12px;align-items:center;">
        <div style="flex:1;text-align:center;padding:8px;background:${statusBg[oldStatus] || statusBg.Abierto};border-radius:8px;">
          <p style="margin:0;font-size:11px;color:#94A3B8;">Anterior</p>
          <p style="margin:4px 0 0;font-size:13px;color:${statusColor[oldStatus] || "#F87171"};font-weight:600;">${oldStatus || "—"}</p>
        </div>
        <span style="color:#475569;font-size:18px;">→</span>
        <div style="flex:1;text-align:center;padding:8px;background:${statusBg[newStatus]};border-radius:8px;">
          <p style="margin:0;font-size:11px;color:#94A3B8;">Nuevo</p>
          <p style="margin:4px 0 0;font-size:13px;color:${statusColor[newStatus]};font-weight:600;">${newStatus}</p>
        </div>
      </div>
    </div>
    <a href="${siteUrl}" style="display:block;text-align:center;background:#3B82F6;color:white;padding:12px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Ver mi ticket</a>
  </div>
  <div style="padding:16px 24px;border-top:1px solid #1E2533;text-align:center;">
    <p style="margin:0;font-size:11px;color:#475569;">Prosper Manufacturing · IT Department</p>
  </div>
</div>
</body></html>`;

    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: emailFrom, to: [to], subject, html }),
      });
      const result = await res.json();
      if (!res.ok) {
        console.error("Resend error:", result);
        return new Response(JSON.stringify({ error: "Email failed", details: result }), { status: 500 });
      }
      return new Response(JSON.stringify({ success: true, provider: "resend", id: result.id }));
    }

    console.log("EMAIL NOTIFICATION (no RESEND_API_KEY):", { to, subject });
    return new Response(JSON.stringify({ success: true, provider: "logged", note: "Set RESEND_API_KEY for delivery" }));

  } catch (err: any) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const config: Config = {
  path: "/api/send-ticket-email",
};
