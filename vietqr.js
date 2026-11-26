// VietQR (chuẩn NAPAS): tạo mã QR chuyển khoản ngay trong trình duyệt, không gọi dịch vụ ngoài.
(function () {
  var BANKS = [
    ['970436', 'Vietcombank'], ['970415', 'VietinBank'], ['970418', 'BIDV'], ['970405', 'Agribank'],
    ['970407', 'Techcombank'], ['970422', 'MB Bank'], ['970416', 'ACB'], ['970432', 'VPBank'],
    ['970423', 'TPBank'], ['970403', 'Sacombank'], ['970437', 'HDBank'], ['970441', 'VIB'],
    ['970443', 'SHB'], ['970440', 'SeABank'], ['970448', 'OCB'], ['970426', 'MSB'],
    ['970431', 'Eximbank'], ['970449', 'LPBank'], ['970428', 'Nam A Bank'], ['970409', 'Bac A Bank'],
    ['970433', 'VietBank'], ['970425', 'ABBank'], ['970419', 'NCB'], ['970412', 'PVcomBank'], ['970452', 'KienlongBank']
  ];
  function bankName(bin) { for (var i = 0; i < BANKS.length; i++) if (BANKS[i][0] === bin) return BANKS[i][1]; return 'Ngân hàng'; }
  function tlv(id, v) { v = String(v); return id + ('0' + v.length).slice(-2) + v; }
  function crc16(s) {
    var c = 0xFFFF;
    for (var i = 0; i < s.length; i++) {
      c ^= s.charCodeAt(i) << 8;
      for (var b = 0; b < 8; b++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF;
    }
    return ('000' + c.toString(16).toUpperCase()).slice(-4);
  }
  // info: nội dung chuyển khoản, chỉ chữ/số không dấu, tối đa 25 ký tự
  function payload(o) {
    var info = String(o.info || '').replace(/[^A-Za-z0-9 ]/g, '').slice(0, 25);
    var acct = tlv('00', o.bin) + tlv('01', o.account);
    var s = tlv('00', '01') + tlv('01', '12') +
      tlv('38', tlv('00', 'A000000727') + tlv('01', acct) + tlv('02', 'QRIBFTTA')) +
      tlv('53', '704') + (o.amount > 0 ? tlv('54', Math.round(o.amount)) : '') + tlv('58', 'VN') +
      (info ? tlv('62', tlv('08', info)) : '') + '6304';
    return s + crc16(s);
  }
  function img(text) {
    var q = window.qrcode(0, 'M'); q.addData(text); q.make();
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }));
  }
  // Tải mã QR về máy dưới dạng ảnh PNG (vẽ lại từ SVG để mở được trong Ảnh/Zalo)
  function download(svgUrl, filename, btn) {
    var label = btn ? btn.textContent : '';
    function done(msg) { if (btn) { btn.textContent = msg; setTimeout(function () { btn.textContent = label; }, 2000); } }
    var im = new Image();
    im.onload = function () {
      var S = 800, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
      var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, S, S); cx.imageSmoothingEnabled = false; cx.drawImage(im, 0, 0, S, S);
      cv.toBlob(function (b) {
        if (!b) { done('Không tải được'); return; }
        var url = URL.createObjectURL(b), a = document.createElement('a');
        a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        done('Đã tải về');
      }, 'image/png');
    };
    im.onerror = function () { done('Không tải được'); };
    im.src = svgUrl;
  }
  function canShow(shop) { return !!(shop && shop.bank_bin && shop.bank_account); }
  function money(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }
  function mk(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  // Khối QR hoàn chỉnh để gắn vào trang
  function block(shop, amount, code) {
    var box = mk('div', 'text-align:center');
    var im = mk('img', 'width:230px;max-width:70%;height:auto;aspect-ratio:1;background:#fff;border-radius:12px;padding:8px;box-sizing:border-box;border:1px solid var(--border)');
    im.alt = 'Mã QR chuyển khoản'; im.src = img(payload({ bin: shop.bank_bin, account: shop.bank_account, amount: amount, info: code }));
    box.appendChild(im);
    var info = mk('div', 'margin-top:8px;font-size:14px;line-height:1.5');
    info.appendChild(mk('div', 'font-weight:700', bankName(shop.bank_bin) + ' · ' + shop.bank_account));
    if (shop.bank_holder) info.appendChild(mk('div', '', shop.bank_holder));
    info.appendChild(mk('div', 'font-weight:700;margin-top:2px', 'Số tiền: ' + money(amount)));
    info.appendChild(mk('div', '', 'Nội dung: ' + code));
    box.appendChild(info);
    var cp = mk('button', 'margin-top:8px;min-height:40px;padding:6px 14px;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:10px;font:inherit;font-weight:600', 'Sao chép số tài khoản');
    cp.type = 'button';
    cp.onclick = function () {
      try { navigator.clipboard.writeText(shop.bank_account).then(function () { cp.textContent = 'Đã sao chép'; }, function () { cp.textContent = shop.bank_account; }); }
      catch (e) { cp.textContent = shop.bank_account; }
    };
    box.appendChild(cp);
    var dl = mk('button', 'margin-top:8px;margin-left:8px;min-height:40px;padding:6px 14px;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:10px;font:inherit;font-weight:600', 'Tải mã QR');
    dl.type = 'button';
    dl.onclick = function () { download(im.src, 'qr-thanh-toan-' + String(code || 'don').replace(/[^A-Za-z0-9]/g, '') + '.png', dl); };
    box.appendChild(dl);
    box.appendChild(mk('div', 'font-size:12.5px;opacity:.7;margin-top:6px', 'Mở app ngân hàng, chọn quét QR. Số tiền và nội dung đã điền sẵn.'));
    return box;
  }
  window.DDQR = { BANKS: BANKS, bankName: bankName, payload: payload, crc16: crc16, img: img, download: download, canShow: canShow, block: block };
})();
