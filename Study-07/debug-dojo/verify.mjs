// 디버깅 도장 확인 스크립트 (Claude가 클라우드에서 돌림 — 사용자는 실행할 필요 없음)
//
// 하는 일
//   1. 문제마다: 버그 코드는 테스트를 1개 이상 틀리고, 정답 코드는 테스트를 모두 통과하는지
//      (페이지 안의 진짜 실행기 window.dojo.check를 그대로 씀 → 워커 · 시간 초과 보호까지 같이 확인)
//   2. 화면: 예상 칸을 비워 두면 실행이 막히는지, 정답을 넣고 실행하면 "해결" + 도감에 들어가는지
//   3. 390px 폭에서 옆으로 밀리는 스크롤이 없는지, 보이는 버튼이 44px 이상인지
//   4. 스크린샷: 390x844, 밝은 화면 + 어두운 화면
//
// 실행: NODE_PATH=/opt/node22/lib/node_modules node Study-07/debug-dojo/verify.mjs [스크린샷 폴더]
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const pageUrl = pathToFileURL(path.join(here, 'index.html')).href;
const shotDir = process.argv[2] || path.join(here, 'shots');
fs.mkdirSync(shotDir, { recursive: true });

let failures = 0;
const fail = msg => { failures++; console.log('  ✗ ' + msg); };
const ok = msg => console.log('  ✓ ' + msg);

const browser = await chromium.launch();
const pageErrors = [];

async function newPage(scheme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  const page = await ctx.newPage();
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(pageUrl);
  await page.waitForFunction(() => window.dojo);
  return { ctx, page };
}

// ---------- 1. 문제마다 버그 ✗ / 정답 ✓ ----------
console.log('1. 문제마다 버그 코드 ✗ · 정답 코드 ✓');
{
  const { ctx, page } = await newPage('light');
  const list = await page.evaluate(() => window.dojo.exercises.map(e => ({ id: e.id, no: e.no, level: e.level, cat: e.cat, tests: e.tests.length, lines: e.bug.split('\n').length })));
  console.log(`  문제 ${list.length}개`);
  if (list.length < 20 || list.length > 25) fail(`문제 수 ${list.length} (20~25개여야 함)`);
  const levels = list.map(e => e.level);
  if (levels.some((lv, i) => i && lv < levels[i - 1])) fail('난이도가 쉬운 것 → 어려운 것 순서가 아님');
  for (const e of list) {
    const bug = await page.evaluate(id => window.dojo.check(id, 'bug'), e.id);
    const fix = await page.evaluate(id => window.dojo.check(id, 'fix'), e.id);
    const bl = await page.evaluate(id => window.dojo.bugLines(id), e.id);
    const bugFails = bug.results.filter(r => !r.pass).length;
    const label = `${String(e.no).padStart(2)}. ${e.id.padEnd(16)} ★${e.level} 버그 ${bugFails}/${e.tests}개 틀림 · 정답 ${fix.results.filter(r => r.pass).length}/${e.tests}개 통과 · 고칠 줄 ${bl.lines.join(',')}${bl.insertOnly ? '(추가)' : ''}${bug.results.some(r => r.timeout) ? ' · ⏱시간초과 확인' : ''} [${bug.mode}]`;
    if (bugFails >= 1 && fix.allPass) ok(label);
    else {
      fail(label);
      fix.results.forEach((r, i) => { if (!r.pass) console.log(`      정답 테스트 ${i + 1}: ${r.error || r.actual}`); });
    }
    if (e.level === 1 && e.no <= 5) {
      const changed = bl.lines.length;
      if (changed !== 1) fail(`${e.id}: 처음 5문제는 한 줄 고치기여야 하는데 ${changed}줄`);
    }
  }
  const mode = await page.evaluate(() => window.dojo.mode);
  if (mode !== 'worker') fail(`실행 방식이 worker가 아님 (${mode}) — file://에서 워커가 막혔을 수 있음`);
  else ok('file:// 에서도 워커(시간 초과 보호)로 실행됨');
  await ctx.close();
}

// ---------- 2. 화면 흐름 ----------
console.log('2. 화면 흐름 (예상 → 실행 → 비교 → 도감)');
{
  const { ctx, page } = await newPage('light');
  await page.goto(pageUrl + '#ex/next-weight');
  await page.click('#run');
  if (await page.isVisible('#pred-need')) ok('예상을 비워 두면 실행 대신 안내가 나옴'); else fail('예상 없이 실행됨');
  await page.fill('#pred-text', '테스트 1이 85로 나올 것 같다');
  await page.fill('#pred-line', '8');
  await page.click('#run');
  await page.waitForSelector('#summary.bad');
  const failCount = await page.locator('#tests li.fail').count();
  if (failCount >= 1) ok(`버그 코드 실행 → ❌ ${failCount}개 표시`); else fail('버그 코드인데 실패 표시가 없음');
  await page.click('#next-hint');
  if (await page.locator('.hint').count() === 1) ok('힌트 1 열림'); else fail('힌트 1이 안 열림');
  // 정답처럼 한 줄 고치기 (사람처럼 편집기를 고침)
  const code = await page.inputValue('#code');
  await page.fill('#code', code.replace('Math.min(...reps) > high)', 'Math.min(...reps) >= high)'));
  await page.click('#run');
  await page.waitForSelector('#summary.ok');
  ok('고친 코드 실행 → 모두 통과');
  const cmp = await page.textContent('#compare-body');
  if (cmp.includes('8번째 줄') && cmp.includes('✅')) ok('③ 비교에 고칠 줄 예상 결과(✅) 표시'); else fail('③ 비교의 줄 예상 표시 이상: ' + cmp.slice(0, 120));
  await page.fill('#note', '경계값 8에서 > 와 >= 가 갈림');
  await page.goto(pageUrl + '#dex');
  const dex = await page.inputValue('textarea[data-note="next-weight"]');
  if (dex.includes('경계값')) ok('도감에 내 메모가 저장됨'); else fail('도감 메모 없음');
  await page.reload();
  await page.waitForFunction(() => window.dojo);
  const stats = await page.evaluate(() => JSON.parse(localStorage.getItem('debug-dojo-v1')));
  if (stats.solved['next-weight'] && stats.score > 0 && stats.streak.count === 1) ok(`새로 고침 뒤에도 기록 유지 (점수 ${stats.score}, 연속 ${stats.streak.count}일)`);
  else fail('localStorage 기록 이상');
  // Tab 키 = 공백 2칸
  await page.goto(pageUrl + '#ex/streak');
  await page.click('#code');
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('Tab');
  const tabbed = await page.inputValue('#code');
  if (tabbed.startsWith('  //')) ok('편집기에서 Tab = 공백 2칸'); else fail('Tab 키가 공백을 넣지 않음');
  // 오늘의 1문제
  await page.goto(pageUrl + '#today');
  if ((await page.textContent('.banner')).includes('오늘의 1문제')) ok('오늘의 1문제 화면'); else fail('오늘의 1문제 배너 없음');
  // 저장이 막힌 브라우저
  const blocked = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await blocked.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('막힘'); } });
  });
  const bp = await blocked.newPage();
  bp.on('pageerror', e => pageErrors.push('(저장 막힘) ' + e.message));
  await bp.goto(pageUrl + '#ex/config-comma');
  await bp.fill('#pred-text', 'SyntaxError');
  await bp.click('#run');
  await bp.waitForSelector('#summary.bad');
  if (await bp.isVisible('.notice')) ok('localStorage가 막혀도 동작 + 안내 표시'); else fail('저장 막힘 안내 없음');
  await blocked.close();
  await ctx.close();
}

// ---------- 3 · 4. 390px 배치 + 스크린샷 ----------
console.log('3. 390px 배치 · 버튼 크기 · 스크린샷');
for (const scheme of ['light', 'dark']) {
  const { ctx, page } = await newPage(scheme);
  const views = [
    ['home', '#home'], ['exercise', '#ex/meal-sync'], ['exercise-run', '#ex/superset-loop'], ['steps', '#steps'], ['dex', '#dex'],
  ];
  for (const [name, hash] of views) {
    await page.goto(pageUrl + hash);
    await page.waitForFunction(() => window.dojo);
    if (name === 'exercise-run') {
      await page.fill('#pred-text', '두 번째 테스트에서 멈출 것 같다');
      await page.click('#run');
      await page.waitForSelector('#summary.bad', { timeout: 10000 });
      await page.click('#next-hint'); await page.click('#next-hint'); await page.click('#next-hint');
    }
    if (name === 'dex') {
      // 도감에 하나 넣고 찍기
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('debug-dojo-v1') || '{}');
        s.solved = { 'config-comma': { at: '2026-11-01', points: 10 }, 'tone-yo': { at: '2026-11-01', points: 17 } };
        s.notes = { 'config-comma': '화면이 하얘지면 F12 콘솔부터. 목록 칸 사이 쉼표.' };
        localStorage.setItem('debug-dojo-v1', JSON.stringify(s));
      });
      await page.reload(); await page.waitForFunction(() => window.dojo);
    }
    const layout = await page.evaluate(() => {
      const sw = document.documentElement.scrollWidth;
      const small = [...document.querySelectorAll('button, .btn, nav.tabs a')]
        .filter(b => b.offsetParent !== null)
        .map(b => ({ t: (b.textContent || '').trim().slice(0, 20), h: b.getBoundingClientRect().height }))
        .filter(b => b.h < 44);
      return { sw, small };
    });
    if (layout.sw <= 390) ok(`${scheme} ${name}: 가로 넘침 없음 (scrollWidth ${layout.sw})`); else fail(`${scheme} ${name}: 가로 넘침 ${layout.sw}px`);
    if (layout.small.length) fail(`${scheme} ${name}: 44px보다 작은 버튼 ${JSON.stringify(layout.small)}`);
    await page.screenshot({ path: path.join(shotDir, `${name}-${scheme}.png`), fullPage: name !== 'steps' && name !== 'exercise' ? true : false });
    if (name === 'exercise' || name === 'steps') await page.screenshot({ path: path.join(shotDir, `${name}-${scheme}-full.png`), fullPage: true });
  }
  await ctx.close();
}

await browser.close();
if (pageErrors.length) { fail('페이지 에러: ' + pageErrors.join(' | ')); }
console.log(failures ? `\n실패 ${failures}개` : '\n모두 통과');
console.log('스크린샷: ' + shotDir);
process.exit(failures ? 1 : 0);
