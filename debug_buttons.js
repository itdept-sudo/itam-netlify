import puppeteer from 'puppeteer';

const debugButtons = async () => {
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: ['--lang=es,en']
  });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  
  await page.type('input[type="email"]', 'avinajuradoav@gmail.com');
  await page.type('input[type="password"]', 'Tjgnetmgr');
  await page.keyboard.press('Enter');
  
  await new Promise(r => setTimeout(r, 6000));
  
  const html = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.textContent);
  });
  
  console.log('Available buttons:', html);
  
  await browser.close();
};

debugButtons();
