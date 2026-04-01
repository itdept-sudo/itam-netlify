export default async function handler(req, res) {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      employeeName,
      employeeNumber,
      department,
      requestType,
      requestedDoors,
      token,
      puestoEncargado,
      requesterName
    } = req.body;

    // Hardcode target to IT config, but let override if necessary
    const to = process.env.IT_EMAIL || "itdept@prosper-mfg.com";
    const resendKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || "ITAM Desk <noreply@prosper-mfg.com>";
    
    // Fallbacks for URLs depending on env
    const siteUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.URL 
        ? process.env.URL 
        : "http://localhost:5173";

    if (!employeeName || !token || !requestType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const subject = `🚪 Solicitud de ${requestType} de Acceso: ${employeeName}`;
    const approveUrl = `${siteUrl}/approve-access?token=${token}&action=approve`;
    const denyUrl = `${siteUrl}/approve-access?token=${token}&action=deny`;
    
    const doorsListHtml = requestedDoors 
      ? requestedDoors.map(d => `<li style="margin-bottom:4px;">${d}</li>`).join('') 
      : 'N/A';

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
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
        <tr>
          <td style="padding:4px 0;width:140px;font-weight:600;">Empleado:</td>
          <td style="padding:4px 0;color:#F1F5F9;">${employeeName} (#${employeeNumber})</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-weight:600;">Departamento:</td>
          <td style="padding:4px 0;color:#F1F5F9;">${department}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-weight:600;">Tipo de Solicitud:</td>
          <td style="padding:4px 0;color:#3B82F6;font-weight:600;">${requestType}</td>
        </tr>
        ${puestoEncargado ? `
        <tr>
          <td style="padding:4px 0;font-weight:600;">Puesto Encargado:</td>
          <td style="padding:4px 0;color:#F1F5F9;">${puestoEncargado}</td>
        </tr>` : ''}
      </table>

      ${requestType !== 'Baja' ? `
      <div style="margin-top:16px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#94A3B8;">Puertas Solicitadas:</p>
        <ul style="margin:0;padding-left:20px;color:#F1F5F9;font-size:13px;">
          ${doorsListHtml}
        </ul>
      </div>
      ` : ''}
    </div>

    <div style="display:flex;gap:16px;justify-content:center;margin-top:24px;">
      <a href="${approveUrl}" style="display:inline-block;flex:1;text-align:center;background:#10B981;color:white;padding:14px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;border:1px solid #059669;">
        ✅ Autorizar
      </a>
      <a href="${denyUrl}" style="display:inline-block;flex:1;text-align:center;background:#EF4444;color:white;padding:14px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;border:1px solid #DC2626;">
        ❌ Denegar
      </a>
    </div>
    
    <p style="margin:24px 0 0;font-size:11px;color:#64748B;text-align:center;line-height:1.5;">
      Al Autorizar, se modificará el estado en el sistema y se generará automáticamente<br>un Ticket de IT para configurar el acceso en el sistema de puertas.
    </p>

  </div>
  <div style="padding:16px 24px;border-top:1px solid #1E2533;text-align:center;">
    <p style="margin:0;font-size:11px;color:#475569;">Prosper Manufacturing · Autogenerado por ITAM Desk</p>
  </div>
</div>
</body>
</html>`;

    if (resendKey) {
      const resApi = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: emailFrom, to: [to], subject, html }),
      });
      const result = await resApi.json();
      if (!resApi.ok) {
        console.error("Resend error:", result);
        return res.status(500).json({ error: "Email failed", details: result });
      }
      return res.status(200).json({ success: true, provider: "resend", id: result.id });
    }

    console.log(`ACCESS NOTIFICATION (${requestType}):`, { to, subject, doors: requestedDoors });
    return res.status(200).json({ success: true, provider: "logged", note: "Set RESEND_API_KEY for delivery", approveUrl });

  } catch (err) {
    console.error("send-access-email error:", err);
    return res.status(500).json({ error: err.message });
  }
}
