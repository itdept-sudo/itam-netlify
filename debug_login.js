import puppeteer from 'puppeteer';

const debugFotos = async () => {
  const browser = await puppeteer.launch({ 
    headless: "new",
    defaultViewport: { width: 1440, height: 900 }
  });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  await page.type('input[type="email"]', 'avinajuradoav@gmail.com');
  await page.type('input[type="password"]', 'Tjgnetmgr');
  
  const submitButton = await page.$('button[type="submit"]');
  await submitButton.click();
  
  await new Promise(r => setTimeout(r, 2000));
  
  const errorText = await page.evaluate(() => {
    const errorDiv = document.querySelector('.bg-red-500\\/10');
    return errorDiv ? errorDiv.textContent : 'No error found';
  });
  
  console.log('Login Error Text:', errorText);
  await browser.close();
};

debugFotos();
