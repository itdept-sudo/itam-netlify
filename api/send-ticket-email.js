import nodemailer from "nodemailer";

// Google SMTP IPs as a fallback for getaddrinfo EBUSY errors
const GMAIL_IPS = ["74.125.136.108", "64.233.184.108", "173.194.77.108"];

async function createTransporter(hostOverride = null) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = hostOverride || process.env.SMTP_HOST || "smtp.gmail.com";

  // If using an IP address for Gmail, we MUST use port 465 (SSL) or it might reject the certificate name mismatch
  // or we need to disable certain security checks, but let's try standard ports first.
  for (const config of [
    { host: smtpHost, port: 587, secure: false }, // TLS
    { host: smtpHost, port: 465, secure: true },  // SSL
  ]) {
    try {
      const transporter = nodemailer.createTransport({
        ...config,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        // If we use an IP, we might get certificate mismatch, so we allow it for Gmail specifically
        tls: {
          rejectUnauthorized: hostOverride ? false : true 
        }
      });
      await transporter.verify();
      return transporter;
    } catch (e) {
      console.warn(`SMTP ${config.port} failed (Host: ${smtpHost}):`, e.message);
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { 
      to, 
      userName, 
      ticketTitle, 
      oldStatus, 
      newStatus, 
      commentText, 
      type = "status",
      ticketNumber,
      ticketId
    } = req.body;

    if (!to || !ticketTitle) return res.status(400).json({ error: "Missing fields" });

    const smtpUser     = process.env.SMTP_USER;
    const smtpPass     = process.env.SMTP_PASS;
    const emailFrom    = process.env.EMAIL_FROM || `"ITAM Desk" <${smtpUser}>`;
    const siteUrl      = process.env.SITE_URL || "https://itam-netlify.vercel.app";

    if (!smtpUser || !smtpPass) return res.status(200).json({ success: true, provider: "logged" });

    let subject;
    let contentHtml;
    let greeting = `Hola ${userName || "Usuario"},`;
    let mainText = `Tu ticket <strong>${ticketTitle}</strong> ha sido actualizado.`;
    let buttonText = "Ver Ticket";

    if (type === "new_ticket") {
      subject = `🆕 Nuevo Ticket: TK-${ticketNumber} - ${ticketTitle}`;
      greeting = `Hola Equipo de TI,`;
      mainText = `Se ha registrado una nueva solicitud en el sistema.`;
      buttonText = "Atender Ticket";
      contentHtml = `
        <div style="background:#0B0E14;border-radius:12px;padding:16px;margin-bottom:24px;border-left:4px solid #3B82F6;">
          <p style="margin:0 0 12px;font-size:13px;color:#64748B;">Detalles del reporte:</p>
          <div style="margin-bottom:8px;">
            <span style="font-size:12px;color:#94A3B8;display:block;">Título</span>
            <span style="font-size:14px;color:#E2E8F0;font-weight:600;">${ticketTitle}</span>
          </div>
          <div style="margin-bottom:8px;">
            <span style="font-size:12px;color:#94A3B8;display:block;">Levantado por</span>
            <span style="font-size:14px;color:#E2E8F0;">${userName}</span>
          </div>
          <div>
            <span style="font-size:12px;color:#94A3B8;display:block;">Folio</span>
            <span style="font-size:12px;font-weight:700;color:#3B82F6;background:rgba(59,130,246,0.1);padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px;">TK-${ticketNumber}</span>
          </div>
        </div>`;
    } else if (type === "status") {
      subject = `📋 Ticket actualizado: ${ticketTitle}`;
      const statusColors = {
        Abierto: { color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
        Proceso:  { color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
        Cerrado:  { color: "#10B981", bg: "rgba(16,185,129,0.1)" },
      };
      const sNew = statusColors[newStatus] || { color: "#3B82F6", bg: "rgba(59,130,246,0.1)" };
      const sOld = statusColors[oldStatus] || { color: "#64748B", bg: "rgba(100,116,139,0.1)" };

      contentHtml = `
        <div style="background:#0B0E14;border-radius:12px;padding:16px;margin-bottom:24px;">
          <p style="margin:0 0 12px;font-size:13px;color:#64748B;">El estado de tu ticket ha cambiado</p>
          <div style="display:flex;gap:12px;align-items:center;">
            <div style="flex:1;text-align:center;padding:8px;background:${sOld.bg};border-radius:8px;">
              <p style="margin:0;font-size:11px;color:#94A3B8;">Anterior</p>
              <p style="margin:4px 0 0;font-size:13px;color:${sOld.color};font-weight:600;">${oldStatus || "—"}</p>
            </div>
            <span style="color:#475569;font-size:18px;">→</span>
            <div style="flex:1;text-align:center;padding:8px;background:${sNew.bg};border-radius:8px;">
              <p style="margin:0;font-size:11px;color:#94A3B8;">Nuevo</p>
              <p style="margin:4px 0 0;font-size:13px;color:${sNew.color};font-weight:600;">${newStatus}</p>
            </div>
          </div>
        </div>`;
    } else {
      subject = `💬 Nueva respuesta en: ${ticketTitle}`;
      contentHtml = `
        <div style="background:#0B0E14;border-radius:12px;padding:16px;margin-bottom:24px;border-left:4px solid #3B82F6;">
          <p style="margin:0 0 12px;font-size:13px;color:#64748B;">Soporte IT ha respondido:</p>
          <p style="margin:0;font-size:14px;color:#E2E8F0;line-height:1.6;font-style:italic;">"${commentText}"</p>
        </div>`;
    }

    const viewUrl = ticketId ? `${siteUrl}/?ticket=${ticketId}` : siteUrl;

    const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0B0E14;color:#E2E8F0;padding:40px 20px;">
<div style="max-width:480px;margin:0 auto;background:#151A24;border-radius:16px;border:1px solid #1E2533;overflow:hidden;padding:24px;">
  <h1 style="color:white;text-align:center;font-size:24px;margin-bottom:24px;">ITAMdesk</h1>
  <p style="font-size:16px;margin-bottom:8px;">${greeting}</p>
  <p style="font-size:14px;color:#94A3B8;margin-bottom:24px;">${mainText}</p>
  ${contentHtml}
  <a href="${viewUrl}" style="display:block;text-align:center;background:#3B82F6;color:white;padding:12px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">${buttonText}</a>
</div></body></html>`;

    // MAX ROBUSTEZ: 5 intentos con fallback a IPs de Google si el hostname falla
    let lastErr;
    for (let i = 0; i < 5; i++) {
        try {
            // En los intentos 3, 4 y 5, intentamos IP directa si vemos errores de DNS
            let hostToTry = null;
            if (i >= 2) hostToTry = GMAIL_IPS[i - 2]; 

            const transporter = await createTransporter(hostToTry);
            if (!transporter) throw new Error("No se pudo iniciar el servicio de correo (Transporter Null)");

            await transporter.sendMail({ from: emailFrom, to, subject, html });
            return res.status(200).json({ success: true, provider: "smtp", host: hostToTry || "smtp.gmail.com" });
        } catch (err) {
            lastErr = err;
            console.error(`[Retry Ticket] Intento ${i + 1} falló:`, err.message);
            if (err.message.includes("auth") || err.message.includes("Invalid login")) throw err;
            await new Promise(r => setTimeout(r, 1500 * (i + 1))); 
        }
    }
    
    // Si falla todo, devolvemos el error completo para diagnóstico
    return res.status(500).json({ 
        error: lastErr.message, 
        code: lastErr.code, 
        stack: lastErr.stack 
    });

  } catch (err) {
    console.error("send-ticket-email error final:", err.message);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
