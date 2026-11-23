// Màu và logo riêng của từng tiệm (dùng cho trang khách và chỗ chọn trong app Bán hàng)
(function () {
  var T = {
    'xanh-la':   { name: 'Xanh lá',  c: '#1E4D3A', bg: '#EDF2EA', bd: '#D3DDD4', l: ['#1E4D3A', '#2C6B51', '#DDE9DF'], d: ['#3B8B6A', '#49A27D', '#1E352A', '#FFFFFF'] },
    'xanh-bien': { name: 'Xanh biển', c: '#1F4E79', bg: '#EBF0F5', bd: '#D0DAE5', l: ['#1F4E79', '#2B6AA3', '#DCE8F3'], d: ['#4C94D1', '#66A7DE', '#1B2F42', '#FFFFFF'] },
    'tim':       { name: 'Tím',      c: '#5B3A8C', bg: '#F0ECF5', bd: '#DAD2E6', l: ['#5B3A8C', '#7450AA', '#E8E0F2'], d: ['#9B78D1', '#AE8DDE', '#2D2340', '#FFFFFF'] },
    'do-dat':    { name: 'Đỏ đất',   c: '#A33B2B', bg: '#F7EEEC', bd: '#E6D3CF', l: ['#A33B2B', '#BF5140', '#F5E1DD'], d: ['#E0725F', '#E88A79', '#3E221D', '#FFFFFF'] },
    'cam':       { name: 'Cam',      c: '#B05A12', bg: '#F7F0E8', bd: '#E8D8C6', l: ['#B05A12', '#CC6E20', '#F6E4D2'], d: ['#E3913F', '#EBA55E', '#3D2C18', '#1A1208'] },
    'hong':      { name: 'Hồng',     c: '#A8366A', bg: '#F7ECF1', bd: '#E8D2DD', l: ['#A8366A', '#C24A82', '#F5DFE9'], d: ['#DB6FA3', '#E68AB6', '#3C2030', '#FFFFFF'] },
    'nau':       { name: 'Nâu',      c: '#6B4A2B', bg: '#F2EEE9', bd: '#DDD3C8', l: ['#6B4A2B', '#855F3A', '#EBE1D6'], d: ['#B88F63', '#C9A27A', '#33291F', '#1A1208'] },
    'den':       { name: 'Đen',      c: '#2B2B2B', bg: '#F0F0F0', bd: '#D9D9D9', l: ['#2B2B2B', '#444444', '#E6E6E6'], d: ['#E5E5E5', '#FFFFFF', '#2E2E2E', '#111111'] }
  };
  function css(t) {
    return ':root{--bg:' + t.bg + ';--border:' + t.bd + ';--accent:' + t.l[0] + ';--accent-hover:' + t.l[1] + ';--accent-soft:' + t.l[2] + ';--accent-text:#FFFFFF}' +
      '@media (prefers-color-scheme: dark){:root{--accent:' + t.d[0] + ';--accent-hover:' + t.d[1] + ';--accent-soft:' + t.d[2] + ';--accent-text:' + t.d[3] + '}}';
  }
  function setLink(rel, href, extra) {
    var l = document.querySelector('link[rel="' + rel + '"]');
    if (!l) { l = document.createElement('link'); l.rel = rel; document.head.appendChild(l); }
    l.href = href; if (extra) l.type = extra;
  }
  window.DDBrand = {
    THEMES: T,
    // Chỉ áp màu của tiệm (dùng trong app Bán hàng, giữ nguyên icon app)
    applyTheme: function (shop) {
      var t = T[shop && shop.theme] || T['xanh-la'];
      var st = document.getElementById('dd-theme');
      if (!st) { st = document.createElement('style'); st.id = 'dd-theme'; document.head.appendChild(st); }
      st.textContent = css(t);
      var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t.c);
    },
    // Áp màu + icon cho trang khách của một tiệm
    apply: function (shop) {
      var t = T[shop && shop.theme] || T['xanh-la'];
      var st = document.getElementById('dd-theme');
      if (!st) { st = document.createElement('style'); st.id = 'dd-theme'; document.head.appendChild(st); }
      st.textContent = css(t);
      var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t.c);
      if (shop && shop.logo_url) { setLink('icon', shop.logo_url, 'image/png'); setLink('apple-touch-icon', shop.logo_url); }
      else { setLink('icon', 'icon-datdon-180.png', 'image/png'); setLink('apple-touch-icon', 'icon-datdon-180.png'); }
    }
  };
})();
