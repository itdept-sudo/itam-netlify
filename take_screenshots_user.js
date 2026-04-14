import puppeteer from 'puppeteer';
import fs from 'fs';

const outDir = './screenshots';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

const takePhotos = async () => {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--lang=es-ES,es'],
    defaultViewport: { width: 1440, height: 900 }
  });
  const page = await browser.newPage();
  
  // Set language forcefully
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'es-ES,es'
  });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "language", {
      get: function() { return "es-ES"; }
    });
    Object.defineProperty(navigator, "languages", {
      get: function() { return ["es-ES", "es"]; }
    });
  });

  const basePath = 'http://localhost:5173';

  console.log('Navigating to login...');
  await page.goto(basePath, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  console.log('Logging in NORMAL USER (Mocked as Admin)...');
  await page.type('input[type="email"]', 'itdept@prosper-mfg.com');
  await page.type('input[type="password"]', 'Prosper2024!');
  
  const submitButton2 = await page.$('button[type="submit"]');
  if (submitButton2) {
    await submitButton2.click();
  } else {
    await page.keyboard.press('Enter');
  }

  await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
  
  console.log('Waiting 8s for user portal data...');
  await new Promise(r => setTimeout(r, 8000));
  await page.screenshot({ path: `${outDir}/user_dashboard.png` });
  console.log('Dashboard taken');
  
  // Open new ticket modal
  const clickedNew = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const reportBtn = btns.find(b => b.textContent.includes('Reportar') || b.textContent.includes('Report Incident') || b.textContent.includes('Incidencia'));
    if (reportBtn) {
      reportBtn.click();
      return true;
    }
    return false;
  });

  if (clickedNew) {
    await new Promise(r => setTimeout(r, 1500));
    
    // Fill the form so we can submit it
    const inputs = await page.$$('input[type="text"]');
    if (inputs.length > 0) {
      await inputs[inputs.length - 1].type("Problema con mi teclado");
    }
    
    const textareas = await page.$$('textarea');
    if (textareas.length > 0) {
      await textareas[0].type("El teclado a veces no registra las teclas en la esquina izquierda. Ya lo desconecté y volví a conectar.");
    }
    
    await page.screenshot({ path: `${outDir}/user_new_ticket.png` });
    console.log('New ticket taken');
    
    // Submit ticket (find button "Enviar Ticket" or "Send Ticket")
    const submitted = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const sendBtn = btns.find(b => b.textContent.includes('Enviar') || b.textContent.includes('Send'));
      if (sendBtn) {
        sendBtn.click();
        return true;
      }
      return false;
    });
    
    if (submitted) {
      console.log("Ticket submitted. Waiting for response...");
      await new Promise(r => setTimeout(r, 4000));
    } else {
      // close modal if submit failed
      await page.keyboard.press('Escape');
      await new Promise(r => setTimeout(r, 1000));
    }
  } else {
    console.log('Reportar Incidencia button not found = ' + (await page.evaluate(() => document.body.innerHTML)).substring(0, 50));
  }

  // Click on the first ticket row
  const ticketsClicked = await page.evaluate(() => {
    const rows = document.querySelectorAll('button.w-full.flex.items-center.text-left');
    if (rows.length > 0) {
      rows[0].click();
      return true;
    }
    return false;
  });

  if (ticketsClicked) {
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: `${outDir}/user_ticket_detail.png` });
    console.log('Ticket detail taken');
  } else {
    console.log('No tickets found in the list');
  }

  console.log('All screenshots completed.');
  await browser.close();
};

takePhotos();
