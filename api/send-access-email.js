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
      employeeName, employeeNumber, cardNumber, department,
      requestType, requestedDoors, itRequirements, token,
      puestoEncargado, requesterName, to
    } = req.body;

    if (!employeeName || !token || !requestType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const smtpUser  = process.env.SMTP_USER;
    const smtpPass  = process.env.SMTP_PASS;
    const emailFrom = process.env.EMAIL_FROM || `"ITAM Desk" <${smtpUser}>`;
    const itEmail   = to || process.env.IT_EMAIL || "itdept@prosper-mfg.com";
    const siteUrl   = (process.env.SITE_URL || "https://itam-netlify.vercel.app").replace(/\/$/, "");

    if (!smtpUser || !smtpPass) return res.status(200).json({ success: true, provider: "logged" });

    // Construcción de URLs
    const approveUrl = `${siteUrl}/approve-access/approve/${token || "MISSING"}`;
    const denyUrl    = `${siteUrl}/approve-access/deny/${token || "MISSING"}`;
    const portalUrl  = `${siteUrl}/security_portal`;

    const doorsListHtml = requestedDoors
      ? requestedDoors.map(d => `<li style="margin-bottom:4px;">${d}</li>`).join("")
      : "N/A";

    const itReqHtml = itRequirements && itRequirements.length > 0
      ? `<p><strong>Requerimientos IT:</strong> <ul>${itRequirements.filter(req => !req.startsWith("TARJETA:")).map(req => `<li style="margin-bottom:4px;">${req}</li>`).join("")}</ul></p>`
      : "";

    const isToSecurity = to && to.length > 0;
    const greeting = isToSecurity ? "Hola Equipo de Seguridad," : "Hola Equipo IT,";
    const mainText = isToSecurity 
      ? `Se ha solicitado una <strong>${requestType}</strong> de accesos que requiere tu validación.`
      : `<strong>${requesterName}</strong> ha solicitado una <strong>${requestType}</strong> de accesos.`;

    const subject = `🚪 Solicitud de ${requestType} de Acceso: ${employeeName}`;
    const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0B0E14;color:#E2E8F0;padding:40px 20px;">
<div style="max-width:540px;margin:0 auto;background:#151A24;border-radius:16px;border:1px solid #1E2533;overflow:hidden;padding:24px;">
  <h1 style="color:white;text-align:center;font-size:24px;margin-bottom:24px;">ITAMdesk</h1>
  <p style="font-size:16px;margin-bottom:8px;">${greeting}</p>
  <p style="font-size:14px;color:#94A3B8;margin-bottom:24px;">${mainText}</p>
  
  <div style="background:#0B0E14;border-radius:12px;padding:20px;border:1px solid #1E2533;margin-bottom:24px;">
    <p style="margin:0 0 10px;font-size:15px;color:#E2E8F0;"><strong>Detalles del Empleado:</strong></p>
    <p style="margin:4px 0;font-size:14px;color:#94A3B8;">Nombre: <span style="color:#E2E8F0;">${employeeName}</span></p>
    <p style="margin:4px 0;font-size:14px;color:#94A3B8;">No. Empleado: <span style="color:#E2E8F0;">#${employeeNumber}</span></p>
    <p style="margin:4px 0;font-size:14px;color:#94A3B8;">Tarjeta: <span style="color:#E2E8F0;">${cardNumber || "N/A"}</span></p>
    <p style="margin:4px 0;font-size:14px;color:#94A3B8;">Departamento: <span style="color:#E2E8F0;">${department}</span></p>
    <p style="margin:16px 0 8px;font-size:14px;color:#94A3B8;"><strong>Puertas Solicitadas:</strong></p>
    <ul style="margin:0;padding-left:20px;font-size:14px;color:#E2E8F0;">${doorsListHtml}</ul>
    ${itReqHtml}
  </div>

  <div style="display:flex;gap:12px;margin-bottom:24px;">
    <a href="${approveUrl}" style="flex:1;text-align:center;background:#10B981;color:white;padding:12px;border-radius:8px;text-decoration:none;font-weight:600;">Autorizar</a>
    <a href="${denyUrl}" style="flex:1;text-align:center;background:#EF4444;color:white;padding:12px;border-radius:8px;text-decoration:none;font-weight:600;">Denegar</a>
  </div>

  <div style="text-align:center;border-top:1px solid #1E2533;pt:16px;">
    <p style="font-size:12px;color:#64748B;margin-bottom:12px;">También puedes gestionar todas las solicitudes desde el portal:</p>
    <a href="${portalUrl}" style="color:#3B82F6;text-decoration:none;font-size:13px;font-weight:500;">Ir al Portal de Seguridad →</a>
  </div>
</div></body></html>`;

    // MAX ROBUSTEZ: 5 intentos
    let lastErr;
    for (let i = 0; i < 5; i++) {
        try {
            let hostToTry = null;
            if (i >= 2) hostToTry = GMAIL_IPS[i - 2]; 

            const transporter = await createTransporter(hostToTry);
            if (!transporter) throw new Error("No se pudo iniciar el servicio de correo");

            await transporter.sendMail({ from: emailFrom, to: itEmail, subject, html });
            return res.status(200).json({ success: true, provider: "smtp", host: hostToTry || "smtp.gmail.com" });
        } catch (err) {
            lastErr = err;
            console.error(`[Retry Access] Intento ${i + 1} falló:`, err.message);
            if (err.message.includes("auth") || err.message.includes("Invalid login")) throw err;
            await new Promise(r => setTimeout(r, 1500 * (i + 1))); 
        }
    }
    
    return res.status(500).json({ error: lastErr.message });

  } catch (err) {
    console.error("send-access-email error final:", err.message);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
