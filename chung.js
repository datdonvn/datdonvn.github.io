/* chung.js — phần dùng chung cho các trang quản lý của datdon (Pro, Pro plus).
   Nạp SAU supabase-js và config.js. Mỗi trang chỉ cần gọi:
     const app = await DatdonApp.start({ page: 'mua-hang', plan: 'pro' });
   rồi dùng app.sb, app.shop, app.el, app.formatMoney... (xem HOP-DONG-DU-LIEU.md mục 5).
   Lưu ý: kiểm tra gói ở đây chỉ để ẩn/hiện giao diện. Chặn thật nằm ở cơ sở dữ liệu (RLS). */
(function () {
  'use strict';
  // Bỏ qua null/false và trải mảng khi vẽ giao diện (tránh hiện chữ "null" hoặc "[object ...]")
  ['replaceChildren', 'append', 'prepend'].forEach(function (fn) {
    const orig = Element.prototype[fn];
    if (!orig || orig.__dd) return;
    const wrapped = function (...a) { return orig.apply(this, a.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false)); };
    wrapped.__dd = true;
    Element.prototype[fn] = wrapped;
  });

  const STORAGE_SHOP_KEY = 'datdon_selected_shop_id'; // dùng chung với quan-ly.html
  const PLAN_RANK = { standard: 1, pro: 2, proplus: 3 };
  const PLAN_LABELS = { standard: 'Standard', pro: 'Pro', proplus: 'Pro plus' };

  // Danh sách các trang mở rộng. Thêm một dòng khi một trang mới được đẩy lên.
  const PAGES = [
    { id: 'ban-hang', label: 'Bán hàng', href: 'ban-hang.html', plan: 'standard' },
    { id: 'quan-tri', label: 'Quản trị', href: 'quan-tri.html', plan: 'standard' }
  ];

  /* Công tắc gạt: onChange(checked) */
  function toggle(checked, onChange, label) {
    const inp = el('input', { type: 'checkbox', role: 'switch' });
    inp.checked = !!checked;
    inp.addEventListener('change', () => onChange(inp.checked));
    return el('label', { className: 'sw' }, inp, el('i'), label ? el('span', { text: label }) : null);
  }

  /* ===== Tiện ích ===== */
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'className') node.className = v;
        else if (k === 'text') node.textContent = String(v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    children.flat(Infinity).forEach((c) => {
      if (c === undefined || c === null || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return node;
  }

  // Lưu dạng JSON để giữ đúng kiểu (số, true/false, mảng, đối tượng); đọc được cả giá trị chữ cũ
  function storageGet(key, fallback) {
    try {
      const v = window.localStorage.getItem(key);
      if (v === null) return fallback;
      try { return JSON.parse(v); } catch (_) { return v; }
    } catch (_) { return fallback; }
  }
  function storageSet(key, val) {
    try {
      if (val === undefined || val === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  function formatMoney(amount) {
    const n = Math.round(Number(amount) || 0);
    return (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
  }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function vnParts(d) {
    const v = new Date((d instanceof Date ? d : new Date(d)).getTime() + 7 * 3600 * 1000);
    return { y: v.getUTCFullYear(), m: v.getUTCMonth() + 1, d: v.getUTCDate(), h: v.getUTCHours(), mi: v.getUTCMinutes() };
  }
  function toVnYmd(d) { const p = vnParts(d); return p.y + '-' + pad2(p.m) + '-' + pad2(p.d); }
  function formatVnDateTime(d) {
    if (!d) return '';
    const p = vnParts(d);
    return pad2(p.d) + '/' + pad2(p.m) + '/' + p.y + ' ' + pad2(p.h) + ':' + pad2(p.mi);
  }
  function shiftYmd(ymd, days) {
    const a = ymd.split('-').map(Number);
    const dt = new Date(Date.UTC(a[0], a[1] - 1, a[2] + days));
    return dt.getUTCFullYear() + '-' + pad2(dt.getUTCMonth() + 1) + '-' + pad2(dt.getUTCDate());
  }

  function translateServerError(err) {
    if (!err) return 'Có lỗi xảy ra, vui lòng thử lại';
    const msg = err.message ? String(err.message) : '';
    if (/[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(msg)) return msg;
    const low = msg.toLowerCase();
    if (low.includes('failed to fetch') || low.includes('network')) return 'Không kết nối được máy chủ. Hãy kiểm tra mạng và thử lại.';
    return 'Có lỗi xảy ra, vui lòng thử lại';
  }

  function showToast(message, type) {
    let stack = document.getElementById('dd-toasts');
    if (!stack) { stack = el('div', { id: 'dd-toasts', className: 'dd-toast-stack', 'aria-live': 'polite' }); document.body.appendChild(stack); }
    const cls = 'dd-toast' + (type === 'error' ? ' dd-toast-error' : type === 'accent' ? ' dd-toast-accent' : '');
    const t = el('div', { className: cls, text: message });
    stack.appendChild(t);
    window.setTimeout(() => t.remove(), 4200);
  }

  // CSV: chống chèn công thức, giữ số 0 đầu của số điện thoại khi mở bằng Excel
  function csvPhoneCell(raw) {
    const s = String(raw || '').trim();
    return /^(\d+|\+[\d\s.\-]+)$/.test(s) ? { __csvRawPhone: s } : s;
  }
  function csvEscapeCell(val) {
    if (val && typeof val === 'object' && typeof val.__csvRawPhone === 'string') return '="' + val.__csvRawPhone + '"';
    let s = val === null || val === undefined ? '' : String(val);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    if (/[";,\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function downloadCsv(filename, rows) {
    const text = '﻿' + rows.map((r) => r.map(csvEscapeCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  /* ===== Xuất Excel (.xlsx) 1 sheet, không cần thư viện ngoài ===== */
  const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function xmlEsc(v) { return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function colName(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function buildXlsx(rows, sheetName) {
    const enc = new TextEncoder();
    const nCols = rows.reduce((m, r) => Math.max(m, r.length), 1);
    const widths = Array.from({ length: nCols }, (_, c) => Math.min(40, Math.max(8, ...rows.slice(0, 200).map(r => String(r[c] == null ? '' : r[c]).length + 2))));
    const sheetRows = rows.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => {
      const ref = colName(ci) + (ri + 1), st = ri === 0 ? ' s="1"' : '';
      if (v === null || v === undefined || v === '') return '';
      if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + st + '><v>' + v + '</v></c>';
      return '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>';
    }).join('') + '</row>').join('');
    const files = {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + xmlEsc(sheetName || 'Du lieu') + '" sheetId="1" r:id="rId1"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
      'xl/worksheets/sheet1.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols><sheetData>' + sheetRows + '</sheetData><autoFilter ref="A1:' + colName(nCols - 1) + Math.max(1, rows.length) + '"/></worksheet>'
    };
    const names = Object.keys(files), parts = [], central = [];
    let offset = 0;
    for (const name of names) {
      const nb = enc.encode(name), data = enc.encode(files[name]), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, nb.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), nb, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, nb.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nb);
      offset += 30 + nb.length + data.length;
    }
    const cdSize = central.reduce((t, p) => t + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, names.length, true); end.setUint16(10, names.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function downloadXlsx(filename, rows, sheetName) {
    const url = URL.createObjectURL(buildXlsx(rows, sheetName));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ===== Giao diện nền (cùng màu, nút, ô nhập với quan-ly.html) ===== */
  const BASE_CSS = `
:root{--bg:#EDF2EA;--surface:#FFF;--surface-alt:#E4ECE3;--text:#14231B;--text-sub:#5E6F65;--border:#D3DDD4;--accent:#1E4D3A;--accent-hover:#2C6B51;--accent-soft:#DDE9DF;--accent-text:#FFF;--yellow:#F4C430;--error:#B23A1E;--error-bg:#FBEAE5;--error-border:#EBBFB2;--warn-bg:#FFF4E5;--warn-text:#8A4B00;--warn-border:#F2D0A4;--radius:12px;--radius-sm:10px;--radius-lg:14px;--font:'Be Vietnam Pro',system-ui,-apple-system,sans-serif}
@media(prefers-color-scheme:dark){:root{--bg:#101712;--surface:#18211B;--surface-alt:#212C25;--text:#E9F0EB;--text-sub:#A3B2A9;--border:#2B382F;--accent:#3F9A75;--accent-hover:#348264;--accent-soft:#17301F;--error:#F0907A;--error-bg:#3A1B19;--error-border:#6E2F2B;--warn-bg:#362712;--warn-text:#F7C782;--warn-border:#6B4A1E}}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;font-family:var(--font);background:var(--bg);color:var(--text);font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
button,input,select,textarea{font-family:inherit;font-size:16px;color:inherit}
button{cursor:pointer}a{color:var(--accent)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.hidden{display:none!important}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:10px 16px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface);color:var(--text);font-weight:600;text-decoration:none}
.btn:hover:not(:disabled){background:var(--surface-alt)}.btn:disabled{opacity:.55;cursor:not-allowed}
.btn-primary{background:var(--accent);border-color:var(--accent);color:var(--accent-text)}.btn-primary:hover:not(:disabled){background:var(--accent-hover)}
.btn-danger{border-color:var(--error-border);color:var(--error)}
.btn-sm{padding:8px 12px;font-size:14px}
.field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}.field label{font-size:14px;font-weight:600}
.input,.select,.textarea{width:100%;min-height:44px;padding:10px 12px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface);color:var(--text)}
.input:focus,.select:focus,.textarea:focus{border-color:var(--accent);outline:none}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:14px}
.alert{padding:12px 14px;border-radius:var(--radius-sm);font-size:14px;margin-bottom:14px;border:1px solid transparent}
.alert-error{background:var(--error-bg);border-color:var(--error-border);color:var(--error)}
.alert-warn{background:var(--warn-bg);border-color:var(--warn-border);color:var(--warn-text)}
.alert-success{background:var(--accent-soft);color:var(--accent)}
.toolbar{display:flex;flex-wrap:wrap;gap:8px}
.dd-wrap{max-width:960px;margin:0 auto;padding:14px 14px 40px}
.dd-top{position:sticky;top:0;z-index:20;background:var(--surface);border-bottom:1px solid var(--border)}
.dd-top-in{max-width:960px;margin:0 auto;padding:8px 14px;display:flex;align-items:center;gap:10px;flex-wrap:nowrap}
.dd-shop{font-weight:700;font-size:17px;margin:0;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-select{max-width:220px;min-height:40px;padding:6px 10px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface-alt);font-weight:600}
.dd-nav{display:inline-flex;flex-shrink:0;background:var(--accent-soft);padding:3px;border-radius:999px;gap:2px}
.dd-nav a{flex-shrink:0;padding:6px 12px;border-radius:999px;text-decoration:none;color:var(--text-sub);font-weight:600;font-size:13.5px;min-height:34px;display:inline-flex;align-items:center}
.dd-nav a.active{background:var(--accent);color:var(--accent-text)}
.dd-out{flex-shrink:0;width:38px;height:38px;min-height:38px;padding:0;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;color:var(--text-sub)}
.sw{position:relative;display:inline-flex;align-items:center;gap:8px;min-height:44px;cursor:pointer;font-size:14px;font-weight:600;color:var(--text-sub);flex-shrink:0}
.sw input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}
.sw i{width:46px;height:26px;border-radius:999px;background:var(--border);position:relative;transition:background .15s;flex-shrink:0}
.sw i::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .15s}
.sw input:checked+i{background:var(--accent)}.sw input:checked+i::after{transform:translateX(20px)}
.sw input:focus-visible+i{outline:2px solid var(--accent);outline-offset:2px}
.sw input:checked~span{color:var(--accent)}
.hscroll{display:flex;gap:8px;overflow-x:auto;flex-wrap:nowrap;padding-bottom:4px;-webkit-overflow-scrolling:touch;scrollbar-width:none}.hscroll::-webkit-scrollbar{display:none}.hscroll>*{flex-shrink:0}
.hscroll .btn{white-space:nowrap}
.dd-center{min-height:70vh;display:flex;align-items:center;justify-content:center;padding:20px 16px}
.dd-msg{max-width:420px;width:100%;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px 20px;text-align:center}
.dd-msg h1{font-size:20px;margin:0 0 8px}.dd-msg p{margin:0 0 16px;color:var(--text-sub)}
.dd-toast-stack{position:fixed;top:12px;left:12px;right:12px;z-index:80;display:flex;flex-direction:column;align-items:flex-end;gap:8px;pointer-events:none}
.dd-toast{pointer-events:auto;max-width:380px;width:100%;background:var(--text);color:var(--surface);padding:12px 14px;border-radius:var(--radius-sm);font-size:14px;font-weight:600}
.dd-toast-error{background:var(--error);color:#fff}.dd-toast-accent{background:var(--accent);color:var(--accent-text)}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`;

  function injectBase() {
    if (document.getElementById('dd-base-css')) return;
    const style = el('style', { id: 'dd-base-css' });
    style.textContent = BASE_CSS;
    document.head.appendChild(style);
    if (!document.querySelector('link[href*="Be+Vietnam+Pro"]')) {
      document.head.appendChild(el('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap' }));
    }
  }

  function showMessage(title, text, linkLabel, linkHref) {
    const box = el('div', { className: 'dd-center' },
      el('div', { className: 'dd-msg' },
        el('h1', { text: title }),
        el('p', { text }),
        linkLabel ? el('a', { className: 'btn btn-primary', href: linkHref || window.location.href, text: linkLabel }) : null));
    const root = document.getElementById('dd-root');
    if (root) root.replaceChildren(box); else document.body.replaceChildren(box);
  }


  /* ===== Đăng nhập / đăng ký / quên mật khẩu / đặt mật khẩu mới ===== */
  function authError(err) {
    const m = err && err.message ? String(err.message) : '';
    const low = m.toLowerCase();
    if (low.includes('invalid login credentials')) return 'Email hoặc mật khẩu không đúng';
    if (low.includes('email not confirmed')) return 'Bạn chưa xác nhận email. Hãy mở email và bấm vào link xác nhận';
    if (low.includes('user already registered')) return 'Email này đã đăng ký';
    if (low.includes('rate limit')) return 'Hệ thống gửi email đang quá tải, hãy thử lại sau ít phút';
    if (low.includes('at least 6')) return 'Mật khẩu tối thiểu 6 ký tự';
    return translateServerError(err);
  }

  function renderLogin(sb) {
    const here = window.location.href.split('#')[0];
    let mode = 'login'; // login | signup | forgot | recovery
    const root = document.getElementById('dd-root') || document.body;
    const msg = el('div', { className: 'hidden', role: 'alert' });
    const email = el('input', { className: 'input', type: 'email', autocomplete: 'email', inputmode: 'email', id: 'dd-email' });
    const pass = el('input', { className: 'input', type: 'password', id: 'dd-pass' });
    const title = el('h1');
    const sub = el('p');
    const submit = el('button', { className: 'btn btn-primary', type: 'submit' });
    const emailField = el('div', { className: 'field' }, el('label', { for: 'dd-email', text: 'Email' }), email);
    const passLabel = el('label', { for: 'dd-pass' });
    const passField = el('div', { className: 'field' }, passLabel, pass);
    const links = el('div', { className: 'toolbar', style: 'justify-content:center;margin-top:12px' });

    function say(text, kind) {
      msg.className = 'alert ' + (kind === 'ok' ? 'alert-success' : 'alert-error');
      msg.textContent = text;
    }
    function paint() {
      msg.className = 'hidden'; msg.textContent = '';
      emailField.classList.toggle('hidden', mode === 'recovery');
      passField.classList.toggle('hidden', mode === 'forgot');
      pass.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
      passLabel.textContent = mode === 'recovery' ? 'Mật khẩu mới' : 'Mật khẩu';
      title.textContent = { login: 'Đăng nhập', signup: 'Tạo tài khoản', forgot: 'Quên mật khẩu', recovery: 'Đặt mật khẩu mới' }[mode];
      sub.textContent = { login: 'Dùng email chủ tiệm hoặc nhân viên.', signup: 'Dùng đúng email đã đăng ký với người quản trị.',
        forgot: 'Nhập email, chúng tôi gửi link đặt lại mật khẩu.', recovery: 'Nhập mật khẩu mới (tối thiểu 6 ký tự).' }[mode];
      submit.textContent = { login: 'Đăng nhập', signup: 'Tạo tài khoản', forgot: 'Gửi link', recovery: 'Lưu mật khẩu' }[mode];
      links.replaceChildren();
      const go = (m, t) => links.appendChild(el('button', { className: 'btn btn-sm', type: 'button', text: t, onClick: () => { mode = m; paint(); } }));
      if (mode === 'login') { go('signup', 'Tạo tài khoản'); go('forgot', 'Quên mật khẩu'); }
      else if (mode !== 'recovery') go('login', 'Quay lại đăng nhập');
    }
    const form = el('form', { novalidate: true, onSubmit: async (ev) => {
      ev.preventDefault();
      submit.disabled = true;
      try {
        const em = email.value.trim(), pw = pass.value;
        if (mode !== 'recovery' && !/^\S+@\S+\.\S+$/.test(em)) { say('Email không hợp lệ'); return; }
        if (mode !== 'forgot' && pw.length < 6) { say('Mật khẩu tối thiểu 6 ký tự'); return; }
        if (mode === 'login') {
          const { error } = await sb.auth.signInWithPassword({ email: em, password: pw });
          if (error) { say(authError(error)); return; }
          pass.value = ''; window.location.reload();
        } else if (mode === 'signup') {
          const { error } = await sb.auth.signUp({ email: em, password: pw, options: { emailRedirectTo: here } });
          if (error) { say(authError(error)); return; }
          pass.value = '';
          say('Hãy mở email và bấm vào link xác nhận, rồi quay lại đây đăng nhập.', 'ok');
        } else if (mode === 'forgot') {
          const { error } = await sb.auth.resetPasswordForEmail(em, { redirectTo: here });
          if (error) { say(authError(error)); return; }
          say('Đã gửi link đặt lại mật khẩu. Hãy kiểm tra email.', 'ok');
        } else {
          const { error } = await sb.auth.updateUser({ password: pw });
          if (error) { say(authError(error)); return; }
          pass.value = ''; window.location.replace(here);
        }
      } catch (e) { say(authError(e)); } finally { submit.disabled = false; }
    } }, msg, emailField, passField, submit);
    root.replaceChildren(el('div', { className: 'dd-center' }, el('div', { className: 'dd-msg' }, title, sub, form, links)));
    sb.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') { mode = 'recovery'; paint(); } });
    paint();
  }

  function renderHeader(app, pageId) {
    const shopHead = app.shops.length > 1
      ? el('select', {
          className: 'dd-select', 'aria-label': 'Chọn quán',
          onChange: (ev) => { storageSet(STORAGE_SHOP_KEY, ev.target.value); window.location.reload(); }
        }, ...app.shops.map((s) => el('option', { value: s.id, text: s.name, selected: s.id === app.shop.id })))
      : el('h1', { className: 'dd-shop', text: app.shop.name });

    const outIcon = (() => {
      const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '20'); svg.setAttribute('height', '20');
      svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
      const pth = document.createElementNS(ns, 'path'); pth.setAttribute('d', 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9');
      svg.appendChild(pth); return svg;
    })();
    const header = el('header', { className: 'dd-top' },
      el('div', { className: 'dd-top-in', style: 'justify-content:space-between' }, shopHead,
        el('div', { style: 'display:flex;align-items:center;gap:8px;flex-shrink:0' },
          (app.headerExtra = el('span', { className: 'dd-extra', style: 'display:inline-flex' })),
          el('button', { className: 'btn dd-out', type: 'button', 'aria-label': 'Đăng xuất', title: 'Đăng xuất',
            onClick: async () => { try { await app.sb.auth.signOut(); } catch (_) {} window.location.reload(); } }, outIcon))));
    document.body.insertBefore(header, document.body.firstChild);
  }

  /* ===== Khởi động trang ===== */
  async function start(opts) {
    const o = opts || {};
    injectBase();

    if (!window.DATDON || !window.DATDON.SUPABASE_URL || !window.DATDON.SUPABASE_KEY || !window.supabase) {
      showMessage('Không kết nối được', 'Không nạp được cấu hình. Hãy tải lại trang.', 'Tải lại', window.location.href);
      return new Promise(() => {});
    }
    const sb = window.supabase.createClient(window.DATDON.SUPABASE_URL, window.DATDON.SUPABASE_KEY);

    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') window.location.reload();
    });

    let session = null;
    try {
      const r = await sb.auth.getSession();
      session = r.data && r.data.session;
    } catch (_) { /* coi như chưa đăng nhập */ }
    if (!session || !session.user) {
      renderLogin(sb);
      return new Promise(() => {});
    }
    try { await sb.rpc('claim_shop'); } catch (_) { /* không có tiệm để gắn thì bỏ qua */ }

    const { data, error } = await sb.from('shops').select('id,slug,name,plan,phone,address,active');
    if (error) {
      showMessage('Không tải được tiệm', translateServerError(error), 'Tải lại', window.location.href);
      return new Promise(() => {});
    }
    const shops = Array.isArray(data) ? data : [];
    if (shops.length === 0) {
      showMessage('Chưa có tiệm nào', 'Tài khoản chưa được gắn với tiệm nào. Hãy liên hệ người quản trị.', 'Tải lại', window.location.href);
      return new Promise(() => {});
    }
    const savedId = storageGet(STORAGE_SHOP_KEY, '');
    const shop = shops.find((s) => s.id === savedId) || shops[0];

    const need = o.plan || 'standard';
    if ((PLAN_RANK[shop.plan] || 1) < (PLAN_RANK[need] || 1)) {
      showMessage('Tính năng của gói ' + (PLAN_LABELS[need] || need),
        'Tiệm "' + shop.name + '" đang dùng gói ' + (PLAN_LABELS[shop.plan] || shop.plan) + '. Hãy liên hệ để nâng gói.',
        'Tải lại', window.location.href);
      return new Promise(() => {});
    }

    const app = {
      sb, user: session.user, shop, shops, plan: shop.plan,
      el, toggle, formatMoney, formatVnDateTime, toVnYmd, shiftYmd, pad2,
      showToast, translateServerError, downloadCsv, downloadXlsx, csvPhoneCell,
      storageGet, storageSet,
      hasPlan: (need) => (PLAN_RANK[shop.plan] || 1) >= (PLAN_RANK[need] || 1)
    };
    app.page = o.page;
    if (o.header !== 'none') renderHeader(app, o.page);
    return app;
  }

  window.DatdonApp = { start, PAGES, PLAN_RANK };
})();
