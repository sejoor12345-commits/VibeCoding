// AI 기술 트렌드 1페이지 요약 슬라이드를 만드는 스크립트 (pptxgenjs)
// 필요한 패키지: pptxgenjs, react, react-dom, react-icons, sharp
// 실행: node make_slide.js [저장할 파일 경로]
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const { FaRobot, FaCode, FaBrain, FaLayerGroup, FaPlug, FaShieldAlt, FaLightbulb } = require("react-icons/fa");

const OUT = process.argv[2] || path.join(__dirname, "ai-trends-summary.pptx");

// 색 (# 없이 6자리)
const BG = "17132B";      // 짙은 보라 (배경, 가장 넓게)
const CARD = "251E45";    // 카드
const MINT = "6EF0C2";    // 강조색 하나
const WHITE = "FFFFFF";
const MUTED = "CFC8EC";   // 본문 글자
const FONT = "Malgun Gothic"; // 윈도우 기본 한글 글꼴

async function iconPng(Icon, color) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Icon, { color: "#" + color, size: 256 }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

const TRENDS = [
  { icon: FaRobot, title: "AI 에이전트", body: "질문에 답하는 데서 그치지 않고, 스스로 계획을 세우고 도구를 써서 여러 단계의 일을 끝까지 해낸다." },
  { icon: FaCode, title: "코딩 에이전트 · 바이브코딩", body: "말로 설명하면 AI가 코드 작성, 테스트, 수정까지. 개발자는 설명하고 검토하는 역할로 바뀌는 중." },
  { icon: FaBrain, title: "생각하는(추론) 모델", body: "답하기 전에 단계별로 따져 보는 모델이 늘면서 수학, 코딩, 분석 문제의 정확도가 크게 올랐다." },
  { icon: FaLayerGroup, title: "멀티모달", body: "글, 이미지, 음성, 영상을 한 모델이 함께 이해하고 만든다. 화면을 보고 컴퓨터를 조작하기도 한다." },
  { icon: FaPlug, title: "도구 연결 표준 (MCP)", body: "AI를 브라우저, 문서, 업무 앱에 꽂아 쓰는 공통 규격이 퍼지며 AI가 할 수 있는 일이 넓어지고 있다." },
  { icon: FaShieldAlt, title: "책임 있는 AI", body: "각국 규제가 시행되면서 개인정보, 저작권, 안전성 검증이 AI 서비스를 만들 때 기본 조건이 됐다." },
];

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625 인치
  pres.title = "AI 기술 트렌드 1페이지 요약";
  const slide = pres.addSlide();
  slide.background = { color: BG };

  // 제목 영역
  slide.addText("AI 기술 트렌드 · 1페이지 요약", {
    x: 0.5, y: 0.3, w: 9, h: 0.3, margin: 0, isTextBox: true,
    fontFace: FONT, fontSize: 11, bold: true, color: MINT,
  });
  slide.addText("AI는 '대답하는 도구'에서 '일하는 동료'로", {
    x: 0.5, y: 0.6, w: 9, h: 0.55, margin: 0, isTextBox: true,
    fontFace: FONT, fontSize: 26, bold: true, color: WHITE,
  });
  slide.addText("지금 눈여겨볼 6가지 흐름", {
    x: 0.5, y: 1.13, w: 9, h: 0.3, margin: 0, isTextBox: true,
    fontFace: FONT, fontSize: 12, color: MUTED,
  });

  // 3 x 2 카드
  const cardW = 2.85, cardH = 1.4, gapX = 0.225, gapY = 0.2, top = 1.6;
  for (let i = 0; i < TRENDS.length; i++) {
    const t = TRENDS[i];
    const x = 0.5 + (i % 3) * (cardW + gapX);
    const y = top + Math.floor(i / 3) * (cardH + gapY);
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cardW, h: cardH, rectRadius: 0.08, fill: { color: CARD }, line: { color: CARD } });
    slide.addShape(pres.shapes.OVAL, { x: x + 0.18, y: y + 0.17, w: 0.42, h: 0.42, fill: { color: MINT }, line: { color: MINT } });
    slide.addImage({ data: await iconPng(t.icon, BG), x: x + 0.28, y: y + 0.27, w: 0.22, h: 0.22 });
    slide.addText(t.title, {
      x: x + 0.72, y: y + 0.17, w: cardW - 0.87, h: 0.42, margin: 0, valign: "middle", isTextBox: true,
      fontFace: FONT, fontSize: 12.5, bold: true, color: WHITE,
    });
    slide.addText(t.body, {
      x: x + 0.18, y: y + 0.68, w: cardW - 0.36, h: cardH - 0.8, margin: 0, valign: "top", isTextBox: true,
      fontFace: FONT, fontSize: 9.5, color: MUTED, lineSpacingMultiple: 1.1,
    });
  }

  // 아래 한 줄 정리
  const by = top + 2 * cardH + gapY + 0.2; // 4.8
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: by, w: 9, h: 0.5, rectRadius: 0.08, fill: { color: MINT, transparency: 88 }, line: { color: MINT, width: 0.75 } });
  slide.addImage({ data: await iconPng(FaLightbulb, MINT), x: 0.68, y: by + 0.14, w: 0.22, h: 0.22 });
  slide.addText([
    { text: "나에게 주는 의미  ", options: { bold: true, color: MINT } },
    { text: "코드를 외우는 힘보다, AI에게 일을 잘 설명하고 결과를 리뷰·테스트로 검증하는 힘이 중요해진다.", options: { color: WHITE } },
  ], { x: 1.02, y: by, w: 8.35, h: 0.5, margin: 0, valign: "middle", isTextBox: true, fontFace: FONT, fontSize: 11 });

  slide.addNotes("2026년 기준 AI 기술의 큰 흐름 6가지를 한 장에 정리했다. 에이전트와 코딩 에이전트는 이 공부(바이브코딩)와 직접 이어지고, MCP는 Study-06에서 Playwright를 연결할 때 쓴 바로 그 방식이다. 세부 수치나 최신 소식은 발표 전에 다시 확인할 것.");

  await pres.writeFile({ fileName: OUT });
  console.log("saved", OUT);
})();
