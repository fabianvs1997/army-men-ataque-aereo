// Development-only: requires Playwright and a Chromium executable.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.getByRole('button',{name:'Iniciar campaña'}).click();
 await page.waitForFunction(()=>document.getElementById('hud').style.display==='block');
 await page.keyboard.press('d');await page.keyboard.down('Space');await page.waitForTimeout(120);await page.keyboard.up('Space');
 await page.getByRole('button',{name:'Pausar partida'}).click();
 await page.getByRole('button',{name:'Cómo jugar'}).click();await page.getByRole('button',{name:'← Volver'}).click();
 await page.getByRole('button',{name:'Ajustes',exact:true}).click();await page.locator('#menuSound').click();await page.locator('#menuQuality').click();
 await page.getByRole('button',{name:'← Volver'}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await page.setViewportSize({width:844,height:390});
 for(const id of ['pause','sound','fu','mi']){const b=await page.locator('#'+id).boundingBox();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=845&&b.y+b.height<=391,id)}
 await page.keyboard.press('Escape');await page.locator('#menuExit').click();await page.locator('#back').click();await page.locator('#menuExit').click();await page.locator('#confirmExit').click();
 await page.getByRole('button',{name:'Iniciar campaña'}).waitFor({state:'visible'});
 await page.setViewportSize({width:390,height:844});
 if(process.env.SMOKE_SCREENSHOT)await page.screenshot({path:process.env.SMOKE_SCREENSHOT});
 assert.deepEqual(errors,[]);console.log('PASS browser: file:// entry, play/fire, pause/help/settings/resume, portrait/landscape, abandon/cancel/menu; no JS errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
