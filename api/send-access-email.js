import nodemailer from "nodemailer";

async function createTransporter() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";

  // Intenta puerto 587 (TLS) primero y luego 465 (SSL)
  for (const config of [
    { host: smtpHost, port: 587, secure: false },
    { host: smtpHost, port: 465, secure: true },
  ]) {
    try {
      const t = nodemailer.createTransport({
        ...config,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
      });
      await t.verify();
      return t;
    } catch (e) {
      console.warn(`SMTP ${config.port} failed for access:`, e.message);
    }
  }
  throw new Error("Could not connect to SMTP for access after trying ports 587 and 465");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      employeeName, employeeNumber, department,
      requestType, requestedDoors, token,
      puestoEncargado, requesterName
    } = req.body;

    if (!employeeName || !token || !requestType) {
      console.error("ERROR: Faltan campos obligatorios", { employeeName, token, requestType });
      return res.status(400).json({ error: "Missing required fields" });
    }

    const smtpUser  = process.env.SMTP_USER;
    const smtpPass  = process.env.SMTP_PASS;
    const emailFrom = process.env.EMAIL_FROM || `"ITAM Desk" <${smtpUser}>`;
    const itEmail   = process.env.IT_EMAIL || "itdept@prosper-mfg.com";
    const siteUrl   = (process.env.SITE_URL || "https://itam-netlify.vercel.app").replace(/\/$/, "");

    if (!smtpUser || !smtpPass) {
      console.log(`ACCESS NOTIFICATION (Dry Run):`, { to: itEmail, employeeName });
      return res.status(200).json({ success: true, provider: "logged" });
    }

    // Construcción de URLs (formatos de ruta robustos)
    const approveUrl = `${siteUrl}/approve-access/approve/${token || "MISSING"}`;
    const denyUrl    = `${siteUrl}/approve-access/deny/${token || "MISSING"}`;

    const doorsListHtml = requestedDoors
      ? requestedDoors.map(d => `<li style="margin-bottom:4px;">${d}</li>`).join("")
      : "N/A";

    const subject = `🚪 Solicitud de ${requestType} de Acceso: ${employeeName}`;
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0B0E14;color:#E2E8F0;padding:40px 20px;">
<div style="max-width:540px;margin:0 auto;background:#151A24;border-radius:16px;border:1px solid #1E2533;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#3B82F6,#2DD4BF);padding:24px;text-align:center;">
    <h1 style="margin:0;font-size:20px;color:white;">Control de Acceso | ITAM<span style="opacity:0.8">desk</span></h1>
  </div>
  <div style="padding:32px 24px;">
    <p style="margin:0 0 16px;font-size:14px;color:#94A3B8;">Hola Equipo IT,</p>
    <p style="margin:0 0 24px;font-size:14px;color:#E2E8F0;line-height:1.6;">
      <strong>${requesterName}</strong> ha solicitado una <strong>${requestType}</strong> de accesos físicos.
    </p>
    <div style="background:#0B0E14;border-radius:12px;padding:20px;margin-bottom:32px;border:1px solid #1E2533;">
      <h3 style="margin:0 0 16px;font-size:15px;color:#F1F5F9;border-bottom:1px solid #1E2533;padding-bottom:8px;">Detalles de la Solicitud</h3>
      <table style="width:100%;font-size:13px;color:#94A3B8;border-collapse:collapse;">
        <tr><td style="padding:4px 0;width:140px;font-weight:600;">Empleado:</td><td style="padding:4px 0;color:#F1F5F9;">${employeeName} (#${employeeNumber})</td></tr>
        <tr><td style="padding:4px 0;font-weight:600;">Departamento:</td><td style="padding:4px 0;color:#F1F5F9;">${department}</td></tr>
        <tr><td style="padding:4px 0;font-weight:600;">Tipo:</td><td style="padding:4px 0;color:#3B82F6;font-weight:600;">${requestType}</td></tr>
        ${puestoEncargado ? `<tr><td style="padding:4px 0;font-weight:600;">Puesto:</td><td style="padding:4px 0;color:#F1F5F9;">${puestoEncargado}</td></tr>` : ""}
      </table>
      ${requestType !== "Baja" ? `
      <div style="margin-top:16px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#94A3B8;">Puertas Solicitadas:</p>
        <ul style="margin:0;padding-left:20px;color:#F1F5F9;font-size:13px;">${doorsListHtml}</ul>
      </div>` : ""}
    </div>
    <div style="display:flex;gap:16px;">
      <a href="${approveUrl}" style="display:inline-block;flex:1;text-align:center;background:#10B981;color:white;padding:14px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Autorizar Acceso</a>
      <a href="${denyUrl}" style="display:inline-block;flex:1;text-align:center;background:#EF4444;color:white;padding:14px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Denegar Acceso</a>
    </div>
  </div>
  <div style="padding:16px 24px;border-top:1px solid #1E2533;text-align:center;">
    <p style="margin:0;font-size:11px;color:#475569;">Prosper Manufacturing · ITAM Desk</p>
  </div>
</div>
</body></html>`;

    // MAX ROBUSTEZ: 5 reintentos para cualquier error de red/DNS en el envío
    let lastErr;
    for (let i = 0; i < 5; i++) {
        try {
            const transporter = await createTransporter();
            await transporter.sendMail({ from: emailFrom, to: itEmail, subject, html });
            return res.status(200).json({ success: true, provider: "smtp" });
        } catch (err) {
            lastErr = err;
            console.error(`[Retry Access] Intento ${i + 1} falló:`, err.message);
            // Salta reintentos si es un error de credenciales permanentes
            if (err.message.includes("Invalid login") || err.message.includes("auth")) throw err;
            await new Promise(r => setTimeout(r, 1000 * (i + 1))); 
        }
    }
    throw lastErr;

  } catch (err) {
    console.error("send-access-email error final:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
