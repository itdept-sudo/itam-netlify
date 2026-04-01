import puppeteer from 'puppeteer';
import fs from 'fs';

const outDir = './screenshots';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

const takePhotos = async () => {
  const browser = await puppeteer.launch({ 
    headless: "new",
    defaultViewport: { width: 1440, height: 900 }
  });
  const page = await browser.newPage();
  const basePath = 'http://localhost:5173';

  // --- ADMIN SCREENSHOTS ---
  console.log('Navigating to login (ADMIN)...');
  await page.goto(basePath, { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 2000));
  // await page.screenshot({ path: `${outDir}/login.png` }); // Already have an ok login, but let's take it again

  console.log('Logging in ADMIN...');
  await page.type('input[type="email"]', 'itdept@prosper-mfg.com');
  await page.type('input[type="password"]', 'Prosper2024!');
  const submitButton = await page.$('button[type="submit"]');
  if (submitButton) {
    await submitButton.click();
  } else {
    await page.keyboard.press('Enter');
  }

  await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
  console.log('Waiting 8s for dashboard data...');
  await new Promise(r => setTimeout(r, 8000));
  await page.screenshot({ path: `${outDir}/dashboard.png` });

  console.log('Navigating to inventory...');
  await page.goto(`${basePath}/inventory`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 8000));
  await page.screenshot({ path: `${outDir}/inventory.png` });

  console.log('Navigating to tickets...');
  await page.goto(`${basePath}/tickets`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 8000));
  await page.screenshot({ path: `${outDir}/tickets.png` });

  // --- LOGOUT ---
  console.log('Logging out...');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.goto(basePath, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  // --- NORMAL USER SCREENSHOTS ---
  console.log('Logging in NORMAL USER...');
  await page.type('input[type="email"]', 'avinajuradoav@gmail.com');
  await page.type('input[type="password"]', 'Tjgnetmgr');
  
  const submitButton2 = await page.$('button[type="submit"]');
  if (submitButton2) {
    await submitButton2.click();
  } else {
    await page.keyboard.press('Enter');
  }

  await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
  console.log('Waiting 8s for user portal data...');
  await new Promise(r => setTimeout(r, 8000));
  await page.screenshot({ path: `${outDir}/user_portal.png` });
  
  console.log('All screenshots completed.');
  await browser.close();
};

takePhotos();
