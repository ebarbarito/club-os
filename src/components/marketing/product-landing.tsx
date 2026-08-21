// Landing del producto (dominio raíz, sin tenant). HTML/CSS estático
// generado a partir del mockup de marketing — no usa componentes de la app.
const LANDING_CSS = `
:root{--ink:#0a0a0b;--deep:#0a0a0b;--deep-2:#141416;--surface:#141416;--paper:#0a0a0b;--paper-2:#101012;--line:rgba(255,255,255,.10);--line-2:rgba(255,255,255,.18);--line-dark:rgba(255,255,255,.10);--text:#f2f2f3;--soft:#a1a1a6;--mute:#6e6e75;--cream:#f2f2f3;--cream-soft:rgba(242,242,243,.68);--accent:#f2f2f3;--accent-lo:#fff;--sage:#8e8e96;--radius:12px;--maxw:1180px}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:var(--font-hanken),"Hanken Grotesk",system-ui,sans-serif;background:var(--paper);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased;text-wrap:pretty}
h1,h2,h3,h4,.num{font-family:var(--font-archivo),"Archivo",sans-serif;line-height:1.04;letter-spacing:-.022em}
img{display:block;max-width:100%}
a{color:var(--accent);text-decoration:none}
a:hover{color:var(--accent-lo)}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 22px}
.eyebrow{font-family:var(--font-archivo),"Archivo";font-weight:700;font-size:11.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--sage)}
.eyebrow.on-dark{color:var(--sage)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;font-family:var(--font-archivo),"Archivo";font-weight:700;font-size:14px;letter-spacing:.01em;padding:14px 24px;border-radius:9px;border:1px solid transparent;cursor:pointer;transition:.18s;white-space:nowrap}
.btn svg{width:16px;height:16px;flex:none}
.btn-pri{background:#f2f2f3;color:#0a0a0b}.btn-pri:hover{background:#fff;color:#0a0a0b}
.btn-dark{background:#f2f2f3;color:#0a0a0b}.btn-dark:hover{background:#fff;color:#0a0a0b}
.btn-out{background:transparent;color:var(--text);border-color:var(--line-2)}.btn-out:hover{border-color:#fff;color:#fff}
.btn-out-d{background:transparent;color:var(--cream);border-color:var(--line-dark)}.btn-out-d:hover{border-color:var(--sage);color:#fff}

.nav{position:sticky;top:0;z-index:60;background:rgba(10,10,11,.86);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.nav-in{display:flex;align-items:center;justify-content:space-between;height:64px;gap:20px}
.brand{display:flex;align-items:center;gap:10px}
.brand .bm{width:30px;height:30px;border-radius:8px;background:#f2f2f3;display:flex;align-items:center;justify-content:center;flex:none}
.brand .bm svg{width:17px;height:17px;color:#0a0a0b}
.brand b{font-family:var(--font-archivo),"Archivo";font-weight:800;font-size:16.5px;letter-spacing:-.02em}
.nav-links{display:none;gap:28px}
.nav-links a{color:var(--soft);font-size:14.5px;font-weight:600}
.nav-links a:hover{color:var(--text)}
.nav .btn{padding:11px 18px;font-size:13.5px}

.hero{background:var(--deep);color:var(--cream);position:relative;overflow:hidden}
.hero::after{content:"";position:absolute;inset:0;background:radial-gradient(110% 80% at 78% 0%,rgba(255,255,255,.07),transparent 62%);pointer-events:none}
.hero-in{position:relative;padding-top:64px}
.hero h1{font-size:clamp(36px,7.6vw,62px);font-weight:800;color:#fff;max-width:19ch;margin:20px 0 0}
.hero p.lead{font-size:17.5px;color:var(--cream-soft);max-width:52ch;margin-top:20px}
.hero-cta{display:flex;flex-direction:column;gap:11px;margin-top:30px}
.hero-note{display:flex;align-items:center;gap:9px;margin-top:24px;font-size:13px;color:var(--sage)}
.hero-note .dot{width:7px;height:7px;border-radius:50%;background:#4ade80;flex:none;box-shadow:0 0 0 3px rgba(74,222,128,.16)}
.hero-shot{margin-top:44px;border-radius:12px 12px 0 0;overflow:hidden;border:1px solid var(--line-dark);border-bottom:none;background:var(--deep-2);box-shadow:0 -6px 60px -20px rgba(0,0,0,.6)}
.hero-shot .bar{display:flex;align-items:center;gap:7px;padding:11px 14px;border-bottom:1px solid var(--line-dark)}
.hero-shot .bar i{width:9px;height:9px;border-radius:50%;background:rgba(238,242,237,.18)}
.hero-shot .bar span{margin-left:8px;font-size:11.5px;color:var(--sage);font-family:var(--font-archivo),"Archivo";font-weight:600;letter-spacing:.02em}
.hero-shot img,.hero-shot .mk{width:100%;max-height:340px;object-fit:cover;object-position:top}

section{padding:68px 0}
.sec-head{max-width:60ch;margin-bottom:38px}
.sec-head h2{font-size:clamp(27px,5.4vw,42px);font-weight:800;margin:14px 0 0}
.sec-head p{font-size:16.5px;color:var(--soft);margin-top:14px}
.on-dark{background:var(--deep);color:var(--cream)}
.on-dark .sec-head h2{color:#fff}
.on-dark .sec-head p{color:var(--cream-soft)}

.prob{background:var(--paper-2)}
.prob-grid{display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
.prob-i{background:var(--paper-2);padding:26px 22px}
.prob-i .pi{width:34px;height:34px;border-radius:9px;background:rgba(255,255,255,.07);color:var(--soft);display:flex;align-items:center;justify-content:center;margin-bottom:14px}
.prob-i .pi svg{width:18px;height:18px}
.prob-i h3{font-size:17px;font-weight:800;margin-bottom:7px}
.prob-i p{font-size:14.5px;color:var(--soft)}
.prob-after{margin-top:26px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:24px 22px;display:flex;flex-direction:column;gap:12px}
.prob-after .pa-l{font-family:var(--font-archivo),"Archivo";font-weight:800;font-size:11.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--sage)}
.prob-after p{font-size:17px;font-weight:600;max-width:56ch}

.sides{display:grid;gap:26px}
.side{border:1px solid var(--line-dark);border-radius:var(--radius);background:var(--deep-2);overflow:hidden;display:flex;flex-direction:column}
.side-h{padding:24px 22px 20px}
.side-h .tag{display:inline-flex;align-items:center;gap:7px;font-family:var(--font-archivo),"Archivo";font-weight:700;font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:5px 11px;border-radius:999px;background:rgba(255,255,255,.08);color:var(--soft);margin-bottom:13px}
.side-h h3{font-size:22px;font-weight:800;color:#fff}
.side-h p{font-size:14.5px;color:var(--cream-soft);margin-top:9px}
.side-h ul{list-style:none;display:flex;flex-direction:column;gap:8px;margin-top:16px}
.side-h li{display:flex;gap:9px;font-size:14.5px;color:var(--cream-soft);align-items:flex-start}
.side-h li svg{width:15px;height:15px;color:#4ade80;flex:none;margin-top:4px}
.side-shot{margin:0 22px 22px;border-radius:9px;overflow:hidden;border:1px solid var(--line-dark);background:#000}
.side-shot img,.side-shot .mk{width:100%;max-height:300px;object-fit:cover;object-position:top}
.side-shot .mkp{width:100%}

.feat-grid{display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
.feat{background:var(--surface);padding:26px 22px}
.feat .fi{width:36px;height:36px;border-radius:9px;background:rgba(255,255,255,.07);color:var(--soft);display:flex;align-items:center;justify-content:center;margin-bottom:15px}
.feat .fi svg{width:19px;height:19px}
.feat h3{font-size:17.5px;font-weight:800;margin-bottom:8px}
.feat p{font-size:14.5px;color:var(--soft)}
.feat .fmeta{margin-top:12px;font-size:12.5px;color:var(--mute);font-family:var(--font-archivo),"Archivo";font-weight:600;letter-spacing:.02em}
.feat-shots{display:grid;gap:16px;margin-top:26px}
.fshot{border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--surface)}
.fshot img,.fshot .mk{width:100%;max-height:250px;object-fit:cover;object-position:top}
.fshot .cap{padding:13px 16px;font-size:13px;color:var(--soft);border-top:1px solid var(--line)}
.fshot .cap b{color:var(--text);font-family:var(--font-archivo),"Archivo";font-weight:700}

.tenant{background:var(--paper-2)}
.ten-grid{display:grid;gap:20px}
.ten{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
.ten-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 18px;border-bottom:1px solid var(--line)}
.ten-url{display:flex;align-items:center;gap:9px;font-family:var(--font-archivo),"Archivo";font-weight:700;font-size:13.5px;letter-spacing:-.01em}
.ten-url .sw{width:11px;height:11px;border-radius:3px;flex:none}
.ten-top .live{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-family:var(--font-archivo),"Archivo";font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--soft)}
.ten-top .live .d{width:6px;height:6px;border-radius:50%;background:#4ade80}
.ten img{width:100%;max-height:330px;object-fit:cover;object-position:top;border-bottom:1px solid var(--line)}
.ten .mkp{width:100%;border-bottom:1px solid var(--line)}
.ten-foot{padding:15px 18px;font-size:13.5px;color:var(--soft)}
.ten-note{margin-top:22px;padding:20px 22px;border:1px dashed var(--line-2);border-radius:var(--radius);font-size:15px;color:var(--soft);background:var(--surface)}
.ten-note b{color:var(--text)}

.trust-grid{display:grid;gap:1px;background:var(--line-dark);border:1px solid var(--line-dark);border-radius:var(--radius);overflow:hidden}
.trust{background:var(--deep-2);padding:26px 22px}
.trust h3{font-size:17px;font-weight:800;color:#fff;margin-bottom:8px;display:flex;align-items:center;gap:9px}
.trust h3 svg{width:17px;height:17px;color:var(--soft);flex:none}
.trust p{font-size:14.5px;color:var(--cream-soft)}

.cta{background:var(--paper-2);text-align:center}
.cta h2{font-size:clamp(28px,6vw,44px);font-weight:800;max-width:24ch;margin:16px auto 0}
.cta p{font-size:17px;color:var(--soft);max-width:52ch;margin:16px auto 0}
.cta-btns{display:flex;flex-direction:column;gap:11px;margin-top:30px;max-width:340px;margin-left:auto;margin-right:auto}
.cta small{display:block;margin-top:20px;font-size:13px;color:var(--mute)}

footer{background:var(--deep);color:var(--cream-soft);padding:44px 0 30px;border-top:1px solid var(--line-dark)}
.foot-in{display:flex;flex-direction:column;gap:22px}
.foot-in .brand b{color:#fff}
.foot-links{display:flex;flex-wrap:wrap;gap:16px 24px}
.foot-links a{color:var(--cream-soft);font-size:14px}
.foot-links a:hover{color:#fff}
.foot-bot{margin-top:26px;padding-top:22px;border-top:1px solid var(--line-dark);display:flex;flex-direction:column;gap:10px;font-size:12.5px;color:var(--sage)}

.mk{display:grid;grid-template-columns:104px 1fr;font-family:var(--font-hanken),"Hanken Grotesk",sans-serif;background:#f7f5ef;color:#16201b;font-size:9px;line-height:1.35;overflow:hidden}
.mk-sb{background:#0a261b;padding:9px 0;display:flex;flex-direction:column;gap:1px}
.mk-sb .lg{margin:0 9px 10px;height:20px;border-radius:4px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-family:var(--font-archivo),"Archivo";font-weight:900;font-size:8.5px;letter-spacing:.06em;color:#eef2ed}
.mk-sb i{display:block;padding:5px 10px;color:rgba(238,242,237,.6);font-style:normal;font-size:8.5px}
.mk-sb i.on{background:rgba(255,255,255,.08);color:#fff;font-weight:600}
.mk-main{padding:13px 14px;min-width:0}
.mk-h{margin-bottom:11px}
.mk-h b{display:block;font-family:var(--font-archivo),"Archivo";font-weight:800;font-size:14px;letter-spacing:-.02em}
.mk-h span{color:#7a857f;font-size:8.5px}
.mk-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.mk-c{background:#fff;border:1px solid rgba(22,32,27,.1);border-radius:5px;padding:9px}
.mk-c .t{display:flex;align-items:center;justify-content:space-between;gap:5px;margin-bottom:5px}
.mk-c .t b{font-family:var(--font-archivo),"Archivo";font-weight:800;font-size:10px}
.mk-c .pill{font-size:6.5px;padding:2px 5px;border-radius:99px;background:#ece6f7;color:#5b3f96;font-weight:700;white-space:nowrap}
.mk-c .pill.a{background:#f6ecd0;color:#8a6d2a}
.mk-c .pill.g{background:#d9ecdd;color:#1c5c41}
.mk-c .sub{color:#7a857f;margin-bottom:6px}
.mk-bar{height:3px;border-radius:99px;background:rgba(22,32,27,.1);overflow:hidden;margin-bottom:6px}
.mk-bar b{display:block;height:100%;background:#1c5c41}
.mk-r{display:flex;justify-content:space-between;gap:6px;padding:2.5px 0;border-top:1px solid rgba(22,32,27,.07);color:#7a857f}
.mk-r span:last-child{color:#16201b;font-weight:600}
.mk-sens{display:flex;gap:5px;margin-top:6px}
.mk-sens div{flex:1;border:1px solid rgba(22,32,27,.1);border-radius:4px;padding:4px 5px}
.mk-sens .k{color:#7a857f;font-size:6.5px;text-transform:uppercase;letter-spacing:.08em}
.mk-sens .v{font-family:var(--font-archivo),"Archivo";font-weight:800;font-size:10.5px}
.mk-tabs{display:flex;gap:11px;border-bottom:1px solid rgba(22,32,27,.1);margin-bottom:9px}
.mk-tabs span{padding-bottom:5px;color:#7a857f}
.mk-tabs span.on{color:#1c5c41;font-weight:700;box-shadow:inset 0 -2px 0 #1c5c41}
.mk-tb{background:#fff;border:1px solid rgba(22,32,27,.1);border-radius:5px;overflow:hidden}
.mk-tb .hd,.mk-tb .rw{display:grid;grid-template-columns:1.6fr 1fr 1fr .8fr;gap:8px;padding:6px 9px;align-items:center}
.mk-tb .hd{background:#efece1;color:#7a857f;font-size:7.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:700}
.mk-tb .rw{border-top:1px solid rgba(22,32,27,.07)}
.mk-tb .rw b{font-family:var(--font-archivo),"Archivo";font-weight:700;font-size:9.5px;display:block}
.mk-tb .rw em{font-style:normal;color:#7a857f;font-size:7.5px}
.mk-tb .rw .lo{color:#a8442c;font-weight:700}
.mk-empty{background:#fff;border:1px solid rgba(22,32,27,.1);border-radius:5px;padding:26px;text-align:center;color:#9aa39d}
.mkp{font-family:var(--font-hanken),"Hanken Grotesk",sans-serif;font-size:9px;line-height:1.4;overflow:hidden;background:#f7f5ef;color:#16201b}
.mkp-nav{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#fff;border-bottom:1px solid rgba(0,0,0,.07)}
.mkp-nav .lg{font-family:var(--font-archivo),"Archivo";font-weight:900;font-size:9px;letter-spacing:.04em;padding:3px 6px;border-radius:3px}
.mkp-nav .lk{display:flex;gap:9px;align-items:center;color:#7a857f;font-size:8px}
.mkp-nav .cta{padding:3px 8px;border-radius:3px;color:#fff;font-weight:700;font-size:7.5px}
.mkp-hero{padding:15px 12px;text-align:center}
.mkp-hero .eb{font-family:var(--font-archivo),"Archivo";font-weight:700;font-size:6.5px;letter-spacing:.2em;text-transform:uppercase}
.mkp-hero h4{font-family:var(--font-archivo),"Archivo";font-weight:800;font-size:19px;color:#fff;margin:6px 0 4px;letter-spacing:-.025em}
.mkp-hero p{font-size:8px;color:rgba(255,255,255,.62)}
.mkp-st{display:flex;justify-content:center;gap:20px;margin-top:8px}
.mkp-st b{display:block;font-family:var(--font-archivo),"Archivo";font-weight:800;font-size:12px}
.mkp-st span{font-size:7px;color:rgba(255,255,255,.55)}
.mkp-body{padding:11px 12px 13px}
.mkp-body .eb{font-family:var(--font-archivo),"Archivo";font-weight:700;font-size:6.5px;letter-spacing:.2em;text-transform:uppercase}
.mkp-body h5{font-family:var(--font-archivo),"Archivo";font-weight:800;font-size:14px;margin:5px 0 9px;letter-spacing:-.02em}
.mkp-chips{display:flex;gap:5px;margin-bottom:9px}
.mkp-chips span{padding:2.5px 7px;border:1px solid rgba(0,0,0,.13);border-radius:99px;font-size:7px;color:#7a857f}
.mkp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.mkp-card{background:#fff;border:1px solid rgba(0,0,0,.09);border-radius:5px;overflow:hidden}
.mkp-card .ph{height:38px;background:#e9e4d6;display:flex;align-items:center;justify-content:center;color:#a9a294;font-size:7px}
.mkp-card .bd{padding:7px}
.mkp-card .bd b{font-family:var(--font-archivo),"Archivo";font-weight:800;font-size:9.5px;display:block}
.mkp-card .bd em{font-style:normal;color:#7a857f;font-size:7.5px;display:block;margin:2px 0 4px}
.mkp-card .bd .pr{display:flex;justify-content:space-between;align-items:center;font-size:8px;font-weight:700}
.mkp-card .bd .bt{margin-top:5px;padding:4px;border-radius:3px;text-align:center;color:#fff;font-weight:700;font-size:7.5px}
@media(max-width:560px){.mk{grid-template-columns:1fr}.mk-sb{display:none}.mk-cards,.mkp-grid{grid-template-columns:1fr 1fr}}

@media(min-width:640px){
  .hero-cta{flex-direction:row}
  .cta-btns{flex-direction:row;justify-content:center;max-width:none}
  .prob-grid{grid-template-columns:1fr 1fr}
  .feat-grid{grid-template-columns:1fr 1fr}
  .feat-shots{grid-template-columns:1fr 1fr}
  .trust-grid{grid-template-columns:1fr 1fr}
  .prob-after{flex-direction:row;align-items:center;gap:22px}
  .foot-bot{flex-direction:row;justify-content:space-between;align-items:center}
}
@media(min-width:900px){
  .wrap{padding:0 32px}
  section{padding:88px 0}
  .nav-links{display:flex}
  .hero-in{padding-top:84px}
  .hero-shot img,.hero-shot .mk{max-height:440px}
  .sides{grid-template-columns:1fr 1fr}
  .feat-grid{grid-template-columns:repeat(3,1fr)}
  .ten-grid{grid-template-columns:1fr 1fr}
  .trust-grid{grid-template-columns:repeat(3,1fr)}
  .sec-head{margin-bottom:46px}
}
`;

const LANDING_BODY = `
<header class="nav">
  <div class="wrap nav-in">
    <a class="brand" href="#top">
      <span class="bm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg></span>
      <b>Mi Club</b>
    </a>
    <nav class="nav-links">
      <a href="#producto">Producto</a>
      <a href="#panel">Panel</a>
      <a href="#demo">Demo en vivo</a>
      <a href="#confianza">Cómo funciona</a>
    </nav>
    <a class="btn btn-pri" href="#contacto">Agendar demo</a>
  </div>
</header>

<section class="hero" id="top" style="padding-bottom:0">
  <div class="wrap hero-in">
    <span class="eyebrow on-dark">Software de gestión para clubes sociales de cannabis</span>
    <h1>Un solo panel para llevar tu club, con la puerta de entrada de tus socios ya incluida.</h1>
    <p class="lead">Mi Club le da a tu club un sitio propio con tu marca y tu URL, más un panel interno para socios, dispensa, caja, stock y cultivo. Dejá el Excel, el papel y el WhatsApp.</p>
    <div class="hero-cta">
      <a class="btn btn-dark" href="#demo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3l14 9-14 9V3z"></path></svg>Ver demo en vivo</a>
      <a class="btn btn-out-d" href="#contacto">Hablemos de tu club</a>
    </div>
    <div class="hero-note"><span class="dot"></span>Funcionando en producción con un club real operando todos los días.</div>
    <div class="hero-shot">
      <div class="bar"><i></i><i></i><i></i><span>tuclub.miclub.site — panel de gestión</span></div>
      <div class="mk">
        <div class="mk-sb"><span class="lg">MI CLUB</span><i>Resumen</i><i>Dispensa</i><i>Socios</i><i>Catálogo</i><i>Stock</i><i class="on">Salas &amp; Cultivo</i><i>Sensores</i><i>Caja</i><i>Balance</i></div>
        <div class="mk-main">
          <div class="mk-h"><b>Salas &amp; Cultivo</b><span>Plantas, etapas y sensores</span></div>
          <div class="mk-cards">
            <div class="mk-c"><div class="t"><b>Flora 1</b><span class="pill">Floración · día 38</span></div><div class="sub">Aurora 21 · 36 plantas</div><div class="mk-bar"><b style="width:90%"></b></div><div class="mk-r"><span>Ocupación</span><span>36/40</span></div><div class="mk-r"><span>Cosecha est.</span><span>12/09/26</span></div><div class="mk-sens"><div><div class="k">Temp</div><div class="v">24.1°</div></div><div><div class="k">Hum</div><div class="v">58%</div></div></div></div>
            <div class="mk-c"><div class="t"><b>Flora 2</b><span class="pill">Floración · día 14</span></div><div class="sub">Costa Norte · 28 plantas</div><div class="mk-bar"><b style="width:70%"></b></div><div class="mk-r"><span>Ocupación</span><span>28/40</span></div><div class="mk-r"><span>Cosecha est.</span><span>03/10/26</span></div><div class="mk-sens"><div><div class="k">Temp</div><div class="v">23.6°</div></div><div><div class="k">Hum</div><div class="v">61%</div></div></div></div>
            <div class="mk-c"><div class="t"><b>Secado 1</b><span class="pill a">Secado · día 5</span></div><div class="sub">Bruma · 60 plantas</div><div class="mk-bar"><b style="width:60%"></b></div><div class="mk-r"><span>Ocupación</span><span>60/100</span></div><div class="mk-r"><span>Cosecha est.</span><span>28/08/26</span></div><div class="mk-sens"><div><div class="k">Temp</div><div class="v">19.8°</div></div><div><div class="k">Hum</div><div class="v">52%</div></div></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="prob">
  <div class="wrap">
    <div class="sec-head">
      <span class="eyebrow">El problema</span>
      <h2>Tu club creció. La forma de administrarlo, no.</h2>
      <p>La mayoría de los clubes se sostienen con herramientas que no fueron pensadas para esto. Funciona hasta que deja de funcionar.</p>
    </div>
    <div class="prob-grid">
      <div class="prob-i">
        <div class="pi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M9 3v18"></path></svg></div>
        <h3>El padrón vive en una planilla</h3>
        <p>Altas a mano, documentación en carpetas, vencimientos de REPROCANN que nadie controla hasta que hay un problema.</p>
      </div>
      <div class="prob-i">
        <div class="pi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.5 8.5 0 0 1-4-1L3 20l1.1-5.4a8.4 8.4 0 0 1-1-4A8.4 8.4 0 0 1 11.5 3h.5a8.4 8.4 0 0 1 9 8.5z"></path></svg></div>
        <h3>Los pedidos se pierden en el chat</h3>
        <p>Reservas mezcladas entre mensajes, sin estado claro de qué está preparado, qué se retiró y qué falta entregar.</p>
      </div>
      <div class="prob-i">
        <div class="pi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2.5"></circle></svg></div>
        <h3>La caja no cierra</h3>
        <p>Efectivo, transferencias y cuentas corrientes anotados en distintos lugares. A fin de mes, nadie sabe el número real.</p>
      </div>
      <div class="prob-i">
        <div class="pi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M5 8l7-5 7 5M5 8v8l7 5 7-5V8"></path></svg></div>
        <h3>El cultivo va por otro lado</h3>
        <p>Las salas, las plantas y los sensores se siguen en otro sistema (o en un cuaderno) sin relación con el stock que se dispensa.</p>
      </div>
    </div>
    <div class="prob-after">
      <span class="pa-l">Con Mi Club</span>
      <p>Un solo lugar: el socio se da de alta y reserva desde tu sitio, y vos ves todo — padrón, dispensa, caja, stock y salas — desde el panel.</p>
    </div>
  </div>
</section>

<section class="on-dark" id="producto">
  <div class="wrap">
    <div class="sec-head">
      <span class="eyebrow on-dark">Dos caras del mismo sistema</span>
      <h2>Lo que ve tu socio y lo que ves vos.</h2>
      <p>Mismo producto, mismo theming, dos accesos distintos: el sitio público sin login y el panel interno para tu equipo.</p>
    </div>
    <div class="sides">
      <div class="side">
        <div class="side-h">
          <span class="tag">Lo que ve tu socio</span>
          <h3>Sitio público del club</h3>
          <p>Tu presencia digital propia, con tu logo, tus colores y tu URL. Sin login.</p>
          <ul>
            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l5 5 9-11"></path></svg>Catálogo de genéticas con stock y precios</li>
            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l5 5 9-11"></path></svg>Alta de socio online con validación +18 y documentación</li>
            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l5 5 9-11"></path></svg>Reservas que caen directo en tu panel</li>
            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l5 5 9-11"></path></svg>Planes de membresía</li>
          </ul>
        </div>
        <div class="side-shot"><div class="mkp">
          <div class="mkp-nav"><span class="lg" style="background:#0f3d2e;color:#f3efe3">SIERRA VERDE</span><span class="lk">Genéticas Membresía <span class="cta" style="background:#1c5c41">Reserva</span></span></div>
          <div class="mkp-hero" style="background:#0f2b21"><div class="eb" style="color:#c9a14a">Club social de cannabis</div><h4>Sierra Verde</h4><p>Genéticas, membresías y dispensa para socios validados.</p><div class="mkp-st"><div><b style="color:#c9a14a">+300</b><span>Socios</span></div><div><b style="color:#c9a14a">6</b><span>Genéticas</span></div><div><b style="color:#c9a14a">100%</b><span>Validados</span></div></div></div>
          <div class="mkp-body"><div class="eb" style="color:#c9a14a">Catálogo</div><h5>Genéticas</h5><div class="mkp-chips"><span style="border-color:#1c5c41;color:#1c5c41">Todas</span><span>Indica</span><span>Sativa</span><span>Híbrida</span></div><div class="mkp-grid"><div class="mkp-card"><div class="ph">Foto</div><div class="bd"><b>Aurora 21</b><em>Indica · THC 22%</em><div class="pr"><span>$12.000/g</span><span style="color:#1c5c41">Disp.</span></div><div class="bt" style="background:#1c5c41">Reservar</div></div></div><div class="mkp-card"><div class="ph">Foto</div><div class="bd"><b>Costa Norte</b><em>Sativa · THC 19%</em><div class="pr"><span>$11.500/g</span><span style="color:#1c5c41">Disp.</span></div><div class="bt" style="background:#1c5c41">Reservar</div></div></div><div class="mkp-card"><div class="ph">Foto</div><div class="bd"><b>Bruma</b><em>Híbrida · THC 24%</em><div class="pr"><span>$12.500/g</span><span style="color:#a8442c">Sin stock</span></div><div class="bt" style="background:#8fa89a">Reservar</div></div></div></div></div>
        </div></div>
      </div>
      <div class="side">
        <div class="side-h">
          <span class="tag">Lo que ves vos</span>
          <h3>Panel de gestión</h3>
          <p>El mismo look &amp; feel, con todo lo que necesita tu equipo para operar el día a día.</p>
          <ul>
            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l5 5 9-11"></path></svg>Altas pendientes de validar, con su documentación</li>
            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l5 5 9-11"></path></svg>Dispensa registrada que descuenta stock e impacta caja</li>
            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l5 5 9-11"></path></svg>Salas de cultivo con sensores en vivo</li>
            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l5 5 9-11"></path></svg>Roles internos: admin, dispensador, cultivo</li>
          </ul>
        </div>
        <div class="side-shot"><div class="mk">
          <div class="mk-sb"><span class="lg">MI CLUB</span><i>Resumen</i><i class="on">Dispensa</i><i>Socios</i><i>Catálogo</i><i>Stock</i><i>Salas &amp; Cultivo</i><i>Sensores</i><i>Caja</i><i>Balance</i></div>
          <div class="mk-main">
            <div class="mk-h"><b>Dispensa</b><span>Pedidos y dispensas registradas</span></div>
            <div class="mk-tabs"><span class="on">Pedidos</span><span>Dispensas registradas</span></div>
            <div class="mk-tb"><div class="hd"><span>Socio</span><span>Items</span><span>Entrega</span><span>Estado</span></div>
              <div class="rw"><span><b>Socio #014</b><em>Válido</em></span><span>2 items · 8 g</span><span>Retiro en club</span><span class="pill g">Listo</span></div>
              <div class="rw"><span><b>Socio #027</b><em>Válido</em></span><span>1 item · 5 g</span><span>Envío coordinado</span><span class="pill a">Preparación</span></div>
              <div class="rw"><span><b>Socio #031</b><em>Válido</em></span><span>3 items · 12 g</span><span>Retiro en club</span><span class="pill">Reservado</span></div>
            </div>
          </div>
        </div></div>
      </div>
    </div>
  </div>
</section>

<section id="panel">
  <div class="wrap">
    <div class="sec-head">
      <span class="eyebrow">El panel</span>
      <h2>Todo lo que hoy está en seis lugares distintos.</h2>
      <p>Cada módulo conectado con el siguiente: una dispensa descuenta stock, registra el movimiento en caja y queda en el balance del mes.</p>
    </div>
    <div class="feat-grid">
      <div class="feat">
        <div class="fi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 20v-2a4 4 0 0 0-3-3.9"></path></svg></div>
        <h3>Socios</h3>
        <p>Padrón completo con estados (borrador, en evaluación, válido, rechazado), documentación adjunta y vinculación REPROCANN.</p>
        <div class="fmeta">Solo los socios validados pueden ser dispensados</div>
      </div>
      <div class="feat">
        <div class="fi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z"></path><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M3 12h18"></path></svg></div>
        <h3>Dispensa</h3>
        <p>Registro de cada entrega: socio, genética, gramos y medio de pago. Los pedidos del sitio público avanzan por estados hasta entregado.</p>
        <div class="fmeta">Descuenta stock e impacta caja automáticamente</div>
      </div>
      <div class="feat">
        <div class="fi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2.5"></circle><path d="M6 12h.01M18 12h.01"></path></svg></div>
        <h3>Caja y cuenta corriente</h3>
        <p>Turnos con apertura y cierre, movimientos por medio de pago (efectivo, transferencia, cuentas), arqueo con conteo y diferencia.</p>
        <div class="fmeta">Cierres con historial auditable</div>
      </div>
      <div class="feat">
        <div class="fi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18"></path><path d="M7 15l4-5 3 3 5-7"></path></svg></div>
        <h3>Balance</h3>
        <p>Ingresos y egresos del mes por rubro, comparativa de los últimos meses y detalle de cada movimiento con su cuenta.</p>
        <div class="fmeta">Visible solo para el perfil admin</div>
      </div>
      <div class="feat">
        <div class="fi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7l9-4 9 4-9 4-9-4z"></path><path d="M3 12l9 4 9-4M3 17l9 4 9-4"></path></svg></div>
        <h3>Stock e inventario</h3>
        <p>Gramos disponibles por artículo, mínimos configurables, alertas de stock bajo y ajustes por cosecha o merma.</p>
        <div class="fmeta">Se alimenta del catálogo y del cierre de ciclo</div>
      </div>
      <div class="feat">
        <div class="fi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3a2 2 0 0 0-2 2v9a4 4 0 1 0 4 0V5a2 2 0 0 0-2-2z"></path></svg></div>
        <h3>Cultivo con sensores IoT</h3>
        <p>Salas con plantas, etapa y ocupación, más temperatura, humedad y VPD en vivo desde nuestra propia integración de sensores.</p>
        <div class="fmeta">Histórico por sala: 1 h a 30 días</div>
      </div>
    </div>
    <div class="feat-shots">
      <div class="fshot">
        <div class="mk">
          <div class="mk-sb"><span class="lg">MI CLUB</span><i>Resumen</i><i>Dispensa</i><i>Socios</i><i>Stock</i><i class="on">Salas &amp; Cultivo</i><i>Sensores</i><i>Caja</i></div>
          <div class="mk-main">
            <div class="mk-h"><b>Salas &amp; Cultivo</b><span>Plantas, etapas y sensores</span></div>
            <div class="mk-cards" style="grid-template-columns:1fr 1fr">
              <div class="mk-c"><div class="t"><b>Flora 1</b><span class="pill">Floración · día 38</span></div><div class="sub">Aurora 21 · 36 plantas</div><div class="mk-bar"><b style="width:90%"></b></div><div class="mk-r"><span>Ocupación</span><span>36/40</span></div><div class="mk-sens"><div><div class="k">Temp</div><div class="v">24.1°</div></div><div><div class="k">Hum</div><div class="v">58%</div></div></div></div>
              <div class="mk-c"><div class="t"><b>Vega A</b><span class="pill g">Vegetativo · día 18</span></div><div class="sub">Serrana · 45 plantas</div><div class="mk-bar"><b style="width:75%"></b></div><div class="mk-r"><span>Ocupación</span><span>45/60</span></div><div class="mk-sens"><div><div class="k">Temp</div><div class="v">25.3°</div></div><div><div class="k">Hum</div><div class="v">64%</div></div></div></div>
            </div>
          </div>
        </div>
        <div class="cap"><b>Salas &amp; Cultivo</b> — plantas por sala, etapa, ocupación y cierre de ciclo con rendimiento por genética.</div>
      </div>
      <div class="fshot">
        <div class="mk">
          <div class="mk-sb"><span class="lg">MI CLUB</span><i>Resumen</i><i>Dispensa</i><i>Socios</i><i>Catálogo</i><i class="on">Stock</i><i>Salas &amp; Cultivo</i><i>Caja</i></div>
          <div class="mk-main">
            <div class="mk-h"><b>Stock</b><span>Inventario por artículo</span></div>
            <div class="mk-tb"><div class="hd"><span>Artículo</span><span>Tipo</span><span>Disponible</span><span>Mínimo</span></div>
              <div class="rw"><span><b>Aurora 21</b></span><span>Indica</span><span>420 g</span><span>50 g</span></div>
              <div class="rw"><span><b>Costa Norte</b></span><span>Sativa</span><span>180 g</span><span>50 g</span></div>
              <div class="rw"><span><b>Bruma</b></span><span>Híbrida</span><span class="lo">0 g</span><span>50 g</span></div>
              <div class="rw"><span><b>Niebla CBD</b></span><span>Alto CBD</span><span>95 g</span><span>40 g</span></div>
            </div>
          </div>
        </div>
        <div class="cap"><b>Stock</b> — inventario por artículo, con alerta cuando una genética se agota.</div>
      </div>
    </div>
  </div>
</section>

<section class="tenant" id="demo">
  <div class="wrap">
    <div class="sec-head">
      <span class="eyebrow">Multi-tenant real</span>
      <h2>Tu marca, tu URL, tus datos. No es un mockup.</h2>
      <p>El mismo producto sirve a N clubes, cada uno con su identidad visual y sus datos aislados. Acá lo ves con dos identidades distintas: mismo código, piel propia (ejemplos con datos ficticios).</p>
    </div>
    <div class="ten-grid">
      <div class="ten">
        <div class="ten-top">
          <span class="ten-url"><span class="sw" style="background:#0f3d2e"></span>sierraverde.miclub.site</span>
          <span class="live"><span class="d"></span>Theming propio</span>
        </div>
        <div class="mkp">
          <div class="mkp-nav"><span class="lg" style="background:#0f3d2e;color:#f3efe3">SIERRA VERDE</span><span class="lk">Genéticas Membresía <span class="cta" style="background:#1c5c41">Reserva</span></span></div>
          <div class="mkp-hero" style="background:#0f2b21"><div class="eb" style="color:#c9a14a">Club social de cannabis</div><h4>Sierra Verde</h4><p>Genéticas, membresías y dispensa para socios validados.</p><div class="mkp-st"><div><b style="color:#c9a14a">+300</b><span>Socios</span></div><div><b style="color:#c9a14a">6</b><span>Genéticas</span></div></div></div>
          <div class="mkp-body"><div class="eb" style="color:#c9a14a">Catálogo</div><h5>Genéticas</h5><div class="mkp-chips"><span style="border-color:#1c5c41;color:#1c5c41">Todas</span><span>Indica</span><span>Sativa</span></div><div class="mkp-grid"><div class="mkp-card"><div class="ph">Foto</div><div class="bd"><b>Aurora 21</b><em>Indica</em><div class="pr"><span>$12.000/g</span></div><div class="bt" style="background:#1c5c41">Reservar</div></div></div><div class="mkp-card"><div class="ph">Foto</div><div class="bd"><b>Costa Norte</b><em>Sativa</em><div class="pr"><span>$11.500/g</span></div><div class="bt" style="background:#1c5c41">Reservar</div></div></div><div class="mkp-card"><div class="ph">Foto</div><div class="bd"><b>Bruma</b><em>Híbrida</em><div class="pr"><span>$12.500/g</span></div><div class="bt" style="background:#1c5c41">Reservar</div></div></div></div></div>
        </div>
        <div class="ten-foot">Paleta verde y crema, logo propio, su subdominio.</div>
      </div>
      <div class="ten">
        <div class="ten-top">
          <span class="ten-url"><span class="sw" style="background:#8b3ff0"></span>nebula.miclub.site</span>
          <span class="live"><span class="d"></span>Theming propio</span>
        </div>
        <div class="mkp" style="background:#f5f3f8">
          <div class="mkp-nav" style="background:#0f0d14;border-color:rgba(255,255,255,.1)"><span class="lg" style="background:#1a1024;color:#e879f9">NÉBULA</span><span class="lk" style="color:rgba(255,255,255,.6)">Genéticas Membresía <span class="cta" style="background:#8b3ff0">Reserva</span></span></div>
          <div class="mkp-hero" style="background:#0a0a10"><div class="eb" style="color:#e879f9">Club social de cannabis</div><h4>Nébula</h4><p>Genéticas, membresías y dispensa para socios validados.</p><div class="mkp-st"><div><b style="color:#e879f9">+180</b><span>Socios</span></div><div><b style="color:#e879f9">5</b><span>Genéticas</span></div></div></div>
          <div class="mkp-body"><div class="eb" style="color:#e879f9">Catálogo</div><h5>Genéticas</h5><div class="mkp-chips"><span style="border-color:#8b3ff0;color:#8b3ff0">Todas</span><span>Indica</span><span>Sativa</span></div><div class="mkp-grid"><div class="mkp-card"><div class="ph" style="background:#eae6f2;color:#a09bb0">Foto</div><div class="bd"><b>Aurora 21</b><em>Indica</em><div class="pr"><span style="color:#7c3aed">$12.000/g</span></div><div class="bt" style="background:#8b3ff0">Reservar</div></div></div><div class="mkp-card"><div class="ph" style="background:#eae6f2;color:#a09bb0">Foto</div><div class="bd"><b>Costa Norte</b><em>Sativa</em><div class="pr"><span style="color:#7c3aed">$11.500/g</span></div><div class="bt" style="background:#8b3ff0">Reservar</div></div></div><div class="mkp-card"><div class="ph" style="background:#eae6f2;color:#a09bb0">Foto</div><div class="bd"><b>Bruma</b><em>Híbrida</em><div class="pr"><span style="color:#7c3aed">$12.500/g</span></div><div class="bt" style="background:#8b3ff0">Reservar</div></div></div></div></div>
        </div>
        <div class="ten-foot">Misma base de código, otra identidad: violeta y magenta sobre oscuro.</div>
      </div>
    </div>
    <div class="ten-note"><b>Sumar un club nuevo no requiere fricción técnica:</b> se configura su marca, su color y su subdominio, y queda operativo con sus propios datos, aislados del resto. Hoy el alta la hacemos nosotros junto con vos, en una llamada.</div>
  </div>
</section>

<section class="on-dark" id="confianza">
  <div class="wrap">
    <div class="sec-head">
      <span class="eyebrow on-dark">Pensado para la operatoria real</span>
      <h2>Diseñado para cómo funciona el sector hoy.</h2>
      <p>No intentamos que tu club opere como un e-commerce. Mi Club acompaña la forma en que ya trabajás.</p>
    </div>
    <div class="trust-grid">
      <div class="trust">
        <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="12" rx="2"></rect><path d="M2 11h20"></path></svg>Sin pasarela de pago</h3>
        <p>Todo el registro es manual: efectivo, transferencia o cuenta corriente. No dependés de un tercero que pueda dar de baja tu cuenta.</p>
      </div>
      <div class="trust">
        <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>Datos aislados por club</h3>
        <p>Cada club ve únicamente su propia información. Ningún club accede a los socios, la caja o el cultivo de otro.</p>
      </div>
      <div class="trust">
        <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v4l3 2"></path></svg>Trazabilidad de lo que pasó</h3>
        <p>Quién registró cada dispensa, quién abrió y cerró la caja, qué se validó y cuándo. Historial consultable, no memoria del equipo.</p>
      </div>
    </div>
  </div>
</section>

<section class="cta" id="contacto">
  <div class="wrap">
    <span class="eyebrow">Siguiente paso</span>
    <h2>Veamos tu club funcionando en Mi Club.</h2>
    <p>Te mostramos el panel real en una llamada de 30 minutos y vemos juntos cómo se traduce la operación de tu club. El alta la hacemos nosotros.</p>
    <div class="cta-btns">
      <a class="btn btn-pri" href="#contacto">Agendar una demo</a>
      <a class="btn btn-out" href="#contacto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.5 8.5 0 0 1-4-1L3 20l1.1-5.4a8.4 8.4 0 0 1-1-4A8.4 8.4 0 0 1 11.5 3h.5a8.4 8.4 0 0 1 9 8.5z"></path></svg>Escribinos por WhatsApp</a>
    </div>
    <small>Sin autogestión todavía: cada club se da de alta con nosotros, para configurar bien su marca y sus datos.</small>
  </div>
</section>

<footer>
  <div class="wrap foot-in">
    <a class="brand" href="#top">
      <span class="bm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg></span>
      <b>Mi Club</b>
    </a>
    <div class="foot-links">
      <a href="#producto">Producto</a>
      <a href="#panel">Panel de gestión</a>
      <a href="#demo">Demo en vivo</a>
      <a href="#confianza">Cómo funciona</a>
      <a href="#contacto">Agendar demo</a>
    </div>
    <div class="foot-bot">
      <span>© 2026 Mi Club — software de gestión para clubes sociales de cannabis.</span>
      <span>Herramienta de gestión para clubes constituidos. Contenido para mayores de 18 años.</span>
    </div>
  </div>
</footer>
`;

export function ProductLanding() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: LANDING_BODY }} />
    </>
  );
}
