/**
 * Delbare PnL-kort i børs-stil, med tier-basert figur og branding etter
 * gevinstens størrelse. Alt tegnes som vektorgrafikk på canvas — ingen
 * eksterne bilder.
 */

export type PnlTier = {
  key: string;
  title: string;
  tagline: string;
  accent: string;
  accentSoft: string;
  bgFrom: string;
  bgTo: string;
  figure: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => void;
};

const ribbon = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  amp: number,
  color: string,
  alpha: number,
) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + w * 0.25, y - amp, x + w * 0.5, y + amp, x + w, y - amp * 0.4);
  ctx.lineTo(x + w, y + 26);
  ctx.bezierCurveTo(x + w * 0.6, y + amp + 26, x + w * 0.3, y - amp + 26, x, y + 26);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const figures = {
  waves: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
    ribbon(ctx, x - s * 0.55, y + s * 0.05, s * 1.1, s * 0.16, "#fb7185", 0.5);
    ribbon(ctx, x - s * 0.55, y + s * 0.22, s * 1.1, s * 0.13, "#f43f5e", 0.35);
    ribbon(ctx, x - s * 0.55, y + s * 0.38, s * 1.1, s * 0.1, "#e11d48", 0.25);
  },
  sprout: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
    ctx.save();
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = s * 0.045;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.42);
    ctx.quadraticCurveTo(x + s * 0.03, y + s * 0.1, x, y - s * 0.14);
    ctx.stroke();
    ctx.fillStyle = "#4ade80";
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, y + (dir === -1 ? 0.02 : 0.14) * s);
      ctx.quadraticCurveTo(
        x + dir * s * 0.3,
        y + (dir === -1 ? -0.12 : 0.02) * s,
        x + dir * s * 0.34,
        y + (dir === -1 ? -0.3 : -0.16) * s,
      );
      ctx.quadraticCurveTo(
        x + dir * s * 0.12,
        y + (dir === -1 ? -0.26 : -0.1) * s,
        x,
        y + (dir === -1 ? 0.02 : 0.14) * s,
      );
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.arc(x, y + s * 0.46, s * 0.28, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
    ctx.restore();
  },
  sailboat: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
    ctx.save();
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.04, y - s * 0.42);
    ctx.lineTo(x - s * 0.04, y + s * 0.1);
    ctx.lineTo(x - s * 0.42, y + s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#7dd3fc";
    ctx.beginPath();
    ctx.moveTo(x + 4, y - s * 0.48);
    ctx.lineTo(x + 4, y + s * 0.1);
    ctx.lineTo(x + s * 0.36, y + s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#0ea5e9";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y + s * 0.16);
    ctx.lineTo(x + s * 0.5, y + s * 0.16);
    ctx.lineTo(x + s * 0.34, y + s * 0.34);
    ctx.lineTo(x - s * 0.34, y + s * 0.34);
    ctx.closePath();
    ctx.fill();
    ribbon(ctx, x - s * 0.6, y + s * 0.42, s * 1.2, s * 0.06, "#38bdf8", 0.4);
    ctx.restore();
  },
  mountain: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
    ctx.save();
    ctx.fillStyle = "#a78bfa";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.55, y + s * 0.42);
    ctx.lineTo(x - s * 0.1, y - s * 0.3);
    ctx.lineTo(x + s * 0.22, y + s * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c4b5fd";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.05, y + s * 0.42);
    ctx.lineTo(x + s * 0.3, y - s * 0.46);
    ctx.lineTo(x + s * 0.62, y + s * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(x + s * 0.3, y - s * 0.46);
    ctx.lineTo(x + s * 0.4, y - s * 0.2);
    ctx.lineTo(x + s * 0.2, y - s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.3, y - s * 0.46);
    ctx.lineTo(x + s * 0.3, y - s * 0.62);
    ctx.stroke();
    ctx.fillStyle = "#f472b6";
    ctx.beginPath();
    ctx.moveTo(x + s * 0.3, y - s * 0.62);
    ctx.lineTo(x + s * 0.46, y - s * 0.56);
    ctx.lineTo(x + s * 0.3, y - s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  aurora: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
    const grad = ctx.createLinearGradient(x - s * 0.5, y, x + s * 0.5, y);
    grad.addColorStop(0, "#2dd4bf");
    grad.addColorStop(1, "#a78bfa");
    ctx.save();
    ctx.strokeStyle = grad;
    ctx.lineCap = "round";
    for (const [offset, width, alpha] of [
      [-0.22, 0.09, 0.9],
      [0, 0.07, 0.6],
      [0.2, 0.05, 0.35],
    ] as const) {
      ctx.globalAlpha = alpha;
      ctx.lineWidth = s * width;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.52, y + s * (0.3 + offset));
      ctx.bezierCurveTo(
        x - s * 0.2,
        y + s * (offset - 0.35),
        x + s * 0.2,
        y + s * (offset + 0.45),
        x + s * 0.52,
        y + s * (offset - 0.25),
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    for (const [sx, sy, r] of [
      [-0.35, -0.4, 0.02],
      [0.1, -0.5, 0.015],
      [0.4, -0.35, 0.02],
      [-0.1, -0.25, 0.012],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x + s * sx, y + s * sy, s * r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
  crown: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
    ctx.save();
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.45, y + s * 0.25);
    ctx.lineTo(x - s * 0.45, y - s * 0.15);
    ctx.lineTo(x - s * 0.2, y + s * 0.05);
    ctx.lineTo(x, y - s * 0.4);
    ctx.lineTo(x + s * 0.2, y + s * 0.05);
    ctx.lineTo(x + s * 0.45, y - s * 0.15);
    ctx.lineTo(x + s * 0.45, y + s * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fde68a";
    ctx.fillRect(x - s * 0.45, y + s * 0.25, s * 0.9, s * 0.12);
    ctx.fillStyle = "#f472b6";
    for (const sx of [-0.28, 0, 0.28]) {
      ctx.beginPath();
      ctx.arc(x + s * sx, y + s * 0.31, s * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
  trophy: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
    ctx.save();
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.3, y - s * 0.42);
    ctx.lineTo(x + s * 0.3, y - s * 0.42);
    ctx.quadraticCurveTo(x + s * 0.3, y + s * 0.05, x, y + s * 0.12);
    ctx.quadraticCurveTo(x - s * 0.3, y + s * 0.05, x - s * 0.3, y - s * 0.42);
    ctx.fill();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = s * 0.05;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + dir * s * 0.38, y - s * 0.26, s * 0.13, dir === -1 ? Math.PI * 0.5 : Math.PI * 1.5, dir === -1 ? Math.PI * 1.5 : Math.PI * 0.5, dir === -1);
      ctx.stroke();
    }
    ctx.fillRect(x - s * 0.06, y + s * 0.1, s * 0.12, s * 0.14);
    ctx.fillRect(x - s * 0.22, y + s * 0.24, s * 0.44, s * 0.08);
    ctx.fillStyle = "#78350f";
    ctx.font = `800 ${s * 0.22}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("1M", x, y - s * 0.12);
    ctx.restore();
  },
};

export function resolveTier(pnl: number): PnlTier {
  if (pnl < 0)
    return { key: "storm", title: "Rødt hav", tagline: "Hodet kaldt — markedet svinger.", accent: "#fb7185", accentSoft: "rgba(251,113,133,0.16)", bgFrom: "#20070d", bgTo: "#0d0307", figure: figures.waves };
  if (pnl < 10_000)
    return { key: "spire", title: "Spiren", tagline: "Sakte, men sikkert.", accent: "#4ade80", accentSoft: "rgba(74,222,128,0.16)", bgFrom: "#07200f", bgTo: "#02130a", figure: figures.sprout };
  if (pnl < 50_000)
    return { key: "seilas", title: "På kurs", tagline: "Vinden er med deg.", accent: "#38bdf8", accentSoft: "rgba(56,189,248,0.16)", bgFrom: "#061a26", bgTo: "#020d14", figure: figures.sailboat };
  if (pnl < 100_000)
    return { key: "fjell", title: "I høyden", tagline: "Solid klatring.", accent: "#a78bfa", accentSoft: "rgba(167,139,250,0.16)", bgFrom: "#150f2b", bgTo: "#0a0718", figure: figures.mountain };
  if (pnl < 250_000)
    return { key: "tinde", title: "Tindebestiger", tagline: "Ny personlig høyde.", accent: "#c4b5fd", accentSoft: "rgba(196,181,253,0.16)", bgFrom: "#1a1233", bgTo: "#0c081c", figure: figures.mountain };
  if (pnl < 500_000)
    return { key: "nordlys", title: "Nordlys", tagline: "Det lyser over porteføljen.", accent: "#2dd4bf", accentSoft: "rgba(45,212,191,0.16)", bgFrom: "#04201f", bgTo: "#020f12", figure: figures.aurora };
  if (pnl < 1_000_000)
    return { key: "krone", title: "Kronejegeren", tagline: "Halvveis til millionen — og vel så det.", accent: "#fbbf24", accentSoft: "rgba(251,191,36,0.16)", bgFrom: "#221604", bgTo: "#120b02", figure: figures.crown };
  return { key: "million", title: "Millionklubben", tagline: "Velkommen i klubben.", accent: "#fbbf24", accentSoft: "rgba(251,191,36,0.18)", bgFrom: "#231803", bgTo: "#100a01", figure: figures.trophy };
}

export function drawPnlCard(
  canvas: HTMLCanvasElement,
  options: {
    pnl: number | null;
    percentText: string | null;
    amountText: string;
    periodLabel: string;
    note: string;
  },
) {
  const W = 1200;
  const H = 675;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const tier = resolveTier(options.pnl ?? 0);

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, tier.bgFrom);
  bg.addColorStop(1, tier.bgTo);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.78, H * 0.32, 30, W * 0.78, H * 0.32, 520);
  glow.addColorStop(0, tier.accentSoft);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let gx = 80; gx < W; gx += 80) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, H);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  // Figur
  tier.figure(ctx, W * 0.78, H * 0.36, 300);

  // Brand + tier-badge
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 34px 'Inter Variable', Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Min Sparing", 72, 96);
  ctx.font = "700 26px 'Inter Variable', Inter, sans-serif";
  const badge = `${tier.title.toUpperCase()}`;
  const badgeWidth = ctx.measureText(badge).width + 44;
  ctx.fillStyle = tier.accentSoft;
  ctx.beginPath();
  ctx.roundRect(72, 128, badgeWidth, 52, 26);
  ctx.fill();
  ctx.fillStyle = tier.accent;
  ctx.fillText(badge, 94, 163);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 27px 'Inter Variable', Inter, sans-serif";
  ctx.fillText(options.periodLabel, 74, 258);

  ctx.fillStyle = tier.accent;
  ctx.font = "800 108px 'Inter Variable', Inter, sans-serif";
  ctx.fillText(options.amountText, 68, 372);

  if (options.percentText) {
    ctx.font = "700 44px 'Inter Variable', Inter, sans-serif";
    const pw = ctx.measureText(options.percentText).width + 56;
    ctx.fillStyle = tier.accentSoft;
    ctx.beginPath();
    ctx.roundRect(72, 412, pw, 84, 20);
    ctx.fill();
    ctx.fillStyle = tier.accent;
    ctx.fillText(options.percentText, 100, 469);
  }

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 30px 'Inter Variable', Inter, sans-serif";
  ctx.fillText(tier.tagline, 74, 560);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "500 24px 'Inter Variable', Inter, sans-serif";
  ctx.fillText(options.note, 74, 600);
  ctx.fillText("minsparing.vercel.app", 74, 636);
}
