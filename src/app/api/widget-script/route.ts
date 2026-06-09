/**
 * GET /api/widget-script
 * Returns a self-contained JavaScript widget that agencies embed on any website.
 *
 * Usage:
 *   <script src="https://your-app.com/api/widget-script"
 *     data-key="wk_live_xxx"
 *     data-color="#6366f1"
 *     data-text="Get a Free Audit"
 *     data-position="bottom-right"
 *     async></script>
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://webanalyzer.dev').replace(/\/$/, '');

  const js = buildWidgetScript(appUrl);

  return new NextResponse(js, {
    headers: {
      'Content-Type':                  'application/javascript; charset=utf-8',
      'Cache-Control':                 'public, max-age=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin':   '*',
      'X-Content-Type-Options':        'nosniff',
    },
  });
}

function buildWidgetScript(appUrl: string): string {
  /* ── Inline styles injected into host page ─────────────────────────── */
  const css = `
.wa-btn{position:fixed;z-index:2147483647;display:flex;align-items:center;gap:8px;padding:12px 18px;border-radius:9999px;border:none;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:600;color:#fff;box-shadow:0 4px 24px rgba(0,0,0,.22);transition:transform .15s,box-shadow .15s;line-height:1}
.wa-btn:hover{transform:translateY(-2px);box-shadow:0 6px 32px rgba(0,0,0,.28)}
.wa-btn.br{bottom:24px;right:24px}
.wa-btn.bl{bottom:24px;left:24px}
.wa-btn.bc{bottom:24px;left:50%;transform:translateX(-50%)}
.wa-btn.bc:hover{transform:translateX(-50%) translateY(-2px)}
.wa-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2147483646;display:flex;align-items:flex-end;justify-content:center;padding:16px;animation:wa-fade-in .15s ease}
.wa-panel{background:#0f0f1a;border:1px solid #1e1e3a;border-radius:16px;padding:24px;width:100%;max-width:400px;box-shadow:0 24px 64px rgba(0,0,0,.5);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;animation:wa-slide-up .2s ease}
.wa-close{float:right;background:none;border:none;color:#6b7280;font-size:20px;cursor:pointer;line-height:1;padding:0;margin:-4px -4px 0 0}
.wa-close:hover{color:#e5e7eb}
.wa-h{font-size:18px;font-weight:700;color:#f9fafb;margin:0 0 6px}
.wa-sub{font-size:13px;color:#9ca3af;margin:0 0 16px}
.wa-label{display:block;font-size:12px;font-weight:500;color:#9ca3af;margin-bottom:6px}
.wa-input{width:100%;padding:10px 12px;background:#1a1a2e;border:1px solid #2d2d52;border-radius:8px;color:#f9fafb;font-size:14px;outline:none;box-sizing:border-box;margin-bottom:10px;transition:border-color .15s}
.wa-input:focus{border-color:#6366f1}
.wa-input.wa-err{border-color:#ef4444}
.wa-submit{width:100%;padding:11px;border:none;border-radius:8px;color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .15s;margin-top:4px}
.wa-submit:hover{opacity:.88}
.wa-submit:disabled{opacity:.5;cursor:not-allowed}
.wa-err-msg{font-size:12px;color:#ef4444;margin:-6px 0 8px}
.wa-success{text-align:center;padding:8px 0}
.wa-success-icon{font-size:36px;margin-bottom:8px}
.wa-success-h{font-size:16px;font-weight:700;color:#f9fafb;margin:0 0 6px}
.wa-success-p{font-size:13px;color:#9ca3af;margin:0 0 14px}
.wa-success-link{display:inline-block;padding:9px 20px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600}
.wa-powered{font-size:10px;color:#6b7280;text-align:center;margin-top:14px}
.wa-powered a{color:#6b7280;text-decoration:none}
.wa-powered a:hover{color:#9ca3af}
@keyframes wa-fade-in{from{opacity:0}to{opacity:1}}
@keyframes wa-slide-up{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}
@media(min-width:480px){.wa-overlay{align-items:center}}
`.replace(/\n/g, '');

  return `/* WebAnalyzer Lead Widget — webanalyzer.dev */
(function(){
'use strict';
var s=document.currentScript||document.querySelector('script[data-key^="wk_live_"]');
if(!s)return;
var KEY=s.getAttribute('data-key');
var COLOR=s.getAttribute('data-color')||'#6366f1';
var TEXT=s.getAttribute('data-text')||'Get a Free Audit';
var POS=s.getAttribute('data-position')||'bottom-right';
var SHOW_EMAIL=s.getAttribute('data-show-email')!=='false';
var API='${appUrl}/api/widget/analyze';
var posClass={
  'bottom-right':'br',
  'bottom-left':'bl',
  'bottom-center':'bc'
}[POS]||'br';

// Inject CSS
var style=document.createElement('style');
style.textContent=${JSON.stringify(css)};
document.head.appendChild(style);

// Floating button
var btn=document.createElement('button');
btn.className='wa-btn '+posClass;
btn.style.background=COLOR;
btn.setAttribute('aria-label',TEXT);
btn.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'+TEXT;
document.body.appendChild(btn);

var overlay=null;

function openWidget(){
  if(overlay)return;
  overlay=document.createElement('div');
  overlay.className='wa-overlay';
  overlay.innerHTML=
    '<div class="wa-panel" role="dialog" aria-modal="true" aria-label="Website audit form">'+
      '<button class="wa-close" aria-label="Close">&times;</button>'+
      '<p class="wa-h">Free Website Audit</p>'+
      '<p class="wa-sub">Enter your website URL and get a full performance, accessibility, and AI analysis in about 60 seconds.</p>'+
      '<div class="wa-form">'+
        '<label class="wa-label" for="wa-url">Your website URL</label>'+
        '<input id="wa-url" class="wa-input" type="url" placeholder="https://yoursite.com" autocomplete="url"/>'+
        '<div id="wa-url-err" class="wa-err-msg" style="display:none"></div>'+
        (SHOW_EMAIL
          ? '<label class="wa-label" for="wa-email">Email (optional — to receive your report)</label>'+
            '<input id="wa-email" class="wa-input" type="email" placeholder="you@example.com" autocomplete="email"/>'
          : '')+
        '<button class="wa-submit" style="background:'+COLOR+'" id="wa-submit">Analyze my site</button>'+
      '</div>'+
      '<div class="wa-success" id="wa-success" style="display:none">'+
        '<div class="wa-success-icon">🎉</div>'+
        '<p class="wa-success-h">Analysis started!</p>'+
        '<p class="wa-success-p">Your report will be ready in about 60 seconds.</p>'+
        '<a class="wa-success-link" id="wa-report-link" href="#" target="_blank" rel="noopener">View Report →</a>'+
      '</div>'+
      '<p class="wa-powered">Powered by <a href="${appUrl}" target="_blank" rel="noopener">WebAnalyzer</a></p>'+
    '</div>';
  document.body.appendChild(overlay);

  // Events
  overlay.querySelector('.wa-close').addEventListener('click',closeWidget);
  overlay.addEventListener('click',function(e){if(e.target===overlay)closeWidget();});
  document.addEventListener('keydown',onEsc);

  var urlInput=overlay.querySelector('#wa-url');
  var submitBtn=overlay.querySelector('#wa-submit');
  var urlErr=overlay.querySelector('#wa-url-err');

  urlInput.focus();

  submitBtn.addEventListener('click',function(){
    var url=urlInput.value.trim();
    if(!url){showErr('Please enter a URL');return;}
    if(!/^https?:\\/\\//i.test(url))url='https://'+url;
    try{new URL(url);}catch(e){showErr('Please enter a valid URL');return;}
    urlErr.style.display='none';
    urlInput.classList.remove('wa-err');

    var email=SHOW_EMAIL?(overlay.querySelector('#wa-email')||{value:''}).value.trim():'';
    submitBtn.disabled=true;
    submitBtn.textContent='Analyzing…';

    fetch(API,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({key:KEY,url:url,email:email||undefined})
    })
    .then(function(r){return r.json().then(function(d){return{ok:r.ok,data:d};});})
    .then(function(res){
      if(!res.ok){
        showErr(res.data.error||'Something went wrong. Please try again.');
        submitBtn.disabled=false;
        submitBtn.textContent='Analyze my site';
        return;
      }
      overlay.querySelector('.wa-form').style.display='none';
      var success=overlay.querySelector('#wa-success');
      success.style.display='block';
      overlay.querySelector('#wa-report-link').href=res.data.reportUrl||'#';
    })
    .catch(function(){
      showErr('Network error. Please try again.');
      submitBtn.disabled=false;
      submitBtn.textContent='Analyze my site';
    });
  });

  function showErr(msg){
    urlErr.textContent=msg;
    urlErr.style.display='block';
    urlInput.classList.add('wa-err');
  }
}

function closeWidget(){
  if(!overlay)return;
  document.removeEventListener('keydown',onEsc);
  overlay.remove();
  overlay=null;
}

function onEsc(e){if(e.key==='Escape')closeWidget();}

btn.addEventListener('click',openWidget);
})();
`;
}
