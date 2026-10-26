// Run from repository root. PLAYWRIGHT_PATH can point to an installed package.
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const names = process.argv.length > 2 ? process.argv.slice(2) : ['course-evidence','course-screen-v2','course-handoff','course-pipeline','course-scope'];
(async () => {
  const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'msedge', headless:true});
  const report = {rendered:[], textOutsideCanvas:[]};
  try {
    const page = await browser.newPage({viewport:{width:1280,height:980},deviceScaleFactor:1});
    for (const name of names) {
      await page.goto(pathToFileURL(path.resolve(`docs/assets/diagrams/${name}.svg`)).href);
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => {
        const v = document.querySelector('svg').viewBox.baseVal;
        return [...document.querySelectorAll('text')].filter(e => {
          const b = e.getBBox();
          return b.x < 0 || b.y < 0 || b.x+b.width > v.width || b.y+b.height > v.height;
        }).map(e => e.textContent);
      });
      report.textOutsideCanvas.push(...overflow.map(text => ({name,text})));
      await page.locator('svg').screenshot({path:`docs/assets/images/${name}.png`});
      report.rendered.push(name);
    }
    fs.mkdirSync('outputs/course-research',{recursive:true});
    fs.writeFileSync(process.argv.length > 2 ? 'outputs/course-research/candidate-render.json' : 'outputs/course-research/render.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
    if(report.textOutsideCanvas.length) process.exitCode=1;
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
