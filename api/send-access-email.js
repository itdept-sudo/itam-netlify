import nodemailer from "nodemailer";

// Google SMTP IPs as a fallback for getaddrinfo EBUSY errors
const GMAIL_IPS = ["74.125.136.108", "64.233.184.108", "173.194.77.108"];

async function createTransporter(hostOverride = null) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = hostOverride || process.env.SMTP_HOST || "smtp.gmail.com";

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
        tls: {
          rejectUnauthorized: hostOverride ? false : true 
        }
      });
      await transporter.verify();
      return transporter;
    } catch (e) {
      console.warn(`SMTP ${config.port} failed (Access Host: ${smtpHost}):`, e.message);
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
      employeeName, employeeNumber, department,
      requestType, requestedDoors, token,
      puestoEncargado, requesterName
    } = req.body;

    if (!employeeName || !token || !requestType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const smtpUser  = process.env.SMTP_USER;
    const smtpPass  = process.env.SMTP_PASS;
    const emailFrom = process.env.EMAIL_FROM || `"ITAM Desk" <${smtpUser}>`;
    const itEmail   = process.env.IT_EMAIL || "itdept@prosper-mfg.com";
    const siteUrl   = (process.env.SITE_URL || "https://itam-netlify.vercel.app").replace(/\/$/, "");

    if (!smtpUser || !smtpPass) return res.status(200).json({ success: true, provider: "logged" });

    // Construcción de URLs (formatos de ruta robustos)
    const approveUrl = `${siteUrl}/approve-access/approve/${token || "MISSING"}`;
    const denyUrl    = `${siteUrl}/approve-access/deny/${token || "MISSING"}`;

    const doorsListHtml = requestedDoors
      ? requestedDoors.map(d => `<li style="margin-bottom:4px;">${d}</li>`).join("")
      : "N/A";

    const subject = `🚪 Solicitud de ${requestType} de Acceso: ${employeeName}`;
    const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0B0E14;color:#E2E8F0;padding:40px 20px;">
<div style="max-width:540px;margin:0 auto;background:#151A24;border-radius:16px;border:1px solid #1E2533;overflow:hidden;padding:24px;">
  <h1 style="color:white;text-align:center;">Control de Acceso | ITAMdesk</h1>
  <p>Hola Equipo IT,</p>
  <p><strong>${requesterName}</strong> ha solicitado una <strong>${requestType}</strong> de accesos.</p>
  <div style="background:#0B0E14;border-radius:12px;padding:20px;border:1px solid #1E2533;">
    <p>Empleado: ${employeeName} (#${employeeNumber})</p>
    <p>Departamento: ${department}</p>
    <p>Puertas: <ul>${doorsListHtml}</ul></p>
  </div>
  <div style="display:flex;gap:16px;margin-top:24px;">
    <a href="${approveUrl}" style="background:#10B981;color:white;padding:12px;border-radius:8px;text-decoration:none;">Autorizar</a>
    <a href="${denyUrl}" style="background:#EF4444;color:white;padding:12px;border-radius:8px;text-decoration:none;">Denegar</a>
  </div>
</div></body></html>`;

    // MAX ROBUSTEZ: 5 intentos con fallback a IP directa de Gmail
    let lastErr;
    for (let i = 0; i < 5; i++) {
        try {
            let hostToTry = null;
            if (i >= 2) hostToTry = GMAIL_IPS[i - 2]; 

            const transporter = await createTransporter(hostToTry);
            if (!transporter) throw new Error("No se pudo iniciar el servicio de correo (Transporter Null)");

            await transporter.sendMail({ from: emailFrom, to: itEmail, subject, html });
            return res.status(200).json({ success: true, provider: "smtp", host: hostToTry || "smtp.gmail.com" });
        } catch (err) {
            lastErr = err;
            console.error(`[Retry Access] Intento ${i + 1} falló:`, err.message);
            if (err.message.includes("auth") || err.message.includes("Invalid login")) throw err;
            await new Promise(r => setTimeout(r, 1500 * (i + 1))); 
        }
    }
    
    return res.status(500).json({ error: lastErr.message, stack: lastErr.stack });

  } catch (err) {
    console.error("send-access-email error final:", err.message);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
