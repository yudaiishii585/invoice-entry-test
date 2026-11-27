// HINATA Works（ひなた製菓 社内システム）「仕入請求書の新規入力」— 研修用の練習サイト
// 入力した内容はこのブラウザの sessionStorage にだけ残る。外へは何も送らない。
(function () {
  'use strict';

  var KEY = 'hinata-invoice-entry-v1';
  var $ = function (id) { return document.getElementById(id); };

  var supplierEl = $('supplier');
  var dateEl = $('invoice-date');
  var form = $('line-form');
  var nameEl = $('item-name');
  var qtyEl = $('item-qty');
  var priceEl = $('item-price');
  var lineError = $('line-error');
  var tbody = $('lines-body');
  var totalEl = $('total');
  var countEl = $('line-count');
  var submitBtn = $('submit-btn');
  var msgEl = $('submit-message');
  var clearBtn = $('clear-btn');
  var badgeEl = $('status-badge');
  var sumSupplier = $('sum-supplier');
  var sumDate = $('sum-date');
  var sumCount = $('sum-count');
  var sumTotal = $('sum-total');
  var toastsEl = $('toasts');

  var state = { supplier: '', date: '', lines: [], registered: null };
  var submitError = '';
  var lastAdded = -1;

  function load() {
    try {
      var s = JSON.parse(sessionStorage.getItem(KEY));
      if (s && Array.isArray(s.lines)) state = s;
    } catch (e) { /* 読めなければ空のまま */ }
  }
  function save() {
    try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 保存できなくても動く */ }
  }

  function fmt(n) { return n.toLocaleString('ja-JP'); }
  function yen(n) { return '¥' + fmt(n); }

  // 全角数字・カンマ・円記号・空白は許して整数に直す。読めなければ NaN
  function toInt(text) {
    var s = String(text)
      .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[,，\s¥￥円]/g, '');
    if (!/^\d+$/.test(s)) return NaN;
    return parseInt(s, 10);
  }

  function total() {
    return state.lines.reduce(function (sum, l) { return sum + l.qty * l.price; }, 0);
  }

  function dateLabel(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return iso;
    return m[1] + '年' + Number(m[2]) + '月' + Number(m[3]) + '日';
  }

  // アイコン（index.html の中の線画を名前で呼ぶ。名前はこのファイルの中の決まった文字だけ）
  function icon(name) {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'i');
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS(NS, 'use');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }

  // 画面の右下に短く出る知らせ
  function toast(kind, text) {
    var t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.appendChild(icon(kind === 'ng' ? 'alert' : kind === 'info' ? 'trash' : 'check'));
    var s = document.createElement('span');
    s.textContent = text;
    t.appendChild(s);
    toastsEl.appendChild(t);
    while (toastsEl.children.length > 3) toastsEl.removeChild(toastsEl.firstChild);
    setTimeout(function () { t.classList.add('out'); }, 2400);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2700);
  }

  function cell(tr, text, cls) {
    var td = document.createElement('td');
    if (cls) td.className = cls;
    td.textContent = text;
    tr.appendChild(td);
  }

  var EMPTY_ART =
    '<svg viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="27" y="7" width="40" height="52" rx="5" fill="#f4f7fb"/>' +
    '<path d="M35 21h24M35 30h24M35 39h13"/>' +
    '<circle cx="67" cy="54" r="11" fill="#fff" stroke="#2563eb"/>' +
    '<path d="M67 49v10M62 54h10" stroke="#2563eb"/>' +
    '<path d="M12 59h8M78 15h7" opacity=".55"/></svg>';

  function render() {
    tbody.textContent = '';
    state.lines.forEach(function (l, i) {
      var no = i + 1;
      var tr = document.createElement('tr');
      tr.id = 'line-' + no;
      tr.className = 'line' + (i === lastAdded ? ' new' : '');
      cell(tr, String(no), 'no');
      cell(tr, l.name, 'name');
      cell(tr, fmt(l.qty), 'num');
      cell(tr, yen(l.price), 'num');
      cell(tr, yen(l.qty * l.price), 'num');
      var td = document.createElement('td');
      td.className = 'act';
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn del';
      b.id = 'delete-' + no;
      b.appendChild(icon('trash'));
      b.appendChild(document.createTextNode('削除'));
      b.setAttribute('aria-label', no + '行目（' + l.name + '）を削除');
      b.addEventListener('click', function () {
        state.lines.splice(i, 1);
        state.registered = null;
        submitError = '';
        lastAdded = -1;
        save();
        render();
        toast('info', '明細を削除しました：' + l.name);
      });
      td.appendChild(b);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    lastAdded = -1;
    if (state.lines.length === 0) {
      var er = document.createElement('tr');
      er.className = 'empty-row';
      var etd = document.createElement('td');
      etd.colSpan = 6;
      var box = document.createElement('div');
      box.className = 'empty';
      box.innerHTML = EMPTY_ART;   // 決まった線画だけ（入力された文字は入れない）
      var eb = document.createElement('b');
      eb.textContent = 'まだ明細がありません';
      var es = document.createElement('span');
      es.textContent = '上の欄に品名・数量・単価を入力して［追加］を押してください。';
      box.appendChild(eb);
      box.appendChild(es);
      etd.appendChild(box);
      er.appendChild(etd);
      tbody.appendChild(er);
    }
    totalEl.textContent = yen(total());
    countEl.textContent = state.lines.length + '件';
    sumCount.textContent = state.lines.length + '件';
    sumTotal.textContent = yen(total());
    renderHeader();
    renderMessage();
  }

  function mirror(el, text) {
    el.textContent = text || '未入力';
    el.className = text ? '' : 'muted';
  }
  function renderHeader() {
    mirror(sumSupplier, (state.supplier || '').trim());
    mirror(sumDate, state.date ? dateLabel(state.date) : '');
  }

  function renderMessage() {
    msgEl.className = '';
    msgEl.textContent = '';
    if (state.registered) {
      msgEl.className = 'ok';
      msgEl.appendChild(icon('check'));
      var box = document.createElement('div');
      var main = document.createElement('strong');
      main.textContent = '登録しました（' + state.registered.count + '件・合計 ' + yen(state.registered.total) + '）';
      var sub = document.createElement('span');
      sub.textContent = '仕入先：' + state.registered.supplier + ' ／ 請求日：' + dateLabel(state.registered.date);
      box.appendChild(main);
      box.appendChild(sub);
      msgEl.appendChild(box);
    } else if (submitError) {
      msgEl.className = 'error';
      msgEl.appendChild(icon('alert'));
      var e = document.createElement('div');
      e.textContent = submitError;
      msgEl.appendChild(e);
    }
    badgeEl.textContent = state.registered ? '登録済み' : '下書き';
    badgeEl.className = 'badge ' + (state.registered ? 'done' : 'draft');
  }

  function showLineError(text, el) {
    lineError.textContent = text;
    lineError.hidden = false;
    if (el) el.focus();
  }

  // 仕入先・請求日
  function onHeaderChange() {
    state.supplier = supplierEl.value;
    state.date = dateEl.value;
    state.registered = null;
    submitError = '';
    save();
    renderHeader();
    renderMessage();
  }
  supplierEl.addEventListener('input', onHeaderChange);
  supplierEl.addEventListener('change', onHeaderChange);
  dateEl.addEventListener('input', onHeaderChange);
  dateEl.addEventListener('change', onHeaderChange);

  // 明細を1行足す（［追加］ボタンでも Enter キーでも）
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = nameEl.value.trim();
    var qty = toInt(qtyEl.value);
    var price = toInt(priceEl.value);
    if (!name) return showLineError('品名を入力してください。', nameEl);
    if (isNaN(qty) || qty <= 0) return showLineError('数量は 1 以上の数字で入力してください。', qtyEl);
    if (isNaN(price)) return showLineError('単価は数字で入力してください。', priceEl);

    lineError.hidden = true;
    lineError.textContent = '';
    state.lines.push({ name: name, qty: qty, price: price });
    state.registered = null;
    submitError = '';
    lastAdded = state.lines.length - 1;
    save();
    render();
    toast('ok', '明細を追加しました：' + name);
    nameEl.value = '';
    qtyEl.value = '';
    priceEl.value = '';
    nameEl.focus();
  });

  // 登録する（この練習サイトでは画面に結果を出すだけ。どこにも送らない）
  submitBtn.addEventListener('click', function () {
    state.supplier = supplierEl.value;
    state.date = dateEl.value;
    var focusEl = null;
    if (state.lines.length === 0) {
      submitError = '明細が0件です。1行以上追加してから登録してください。';
      focusEl = nameEl;
    } else if (!state.supplier.trim()) {
      submitError = '仕入先を入力してください。';
      focusEl = supplierEl;
    } else if (!state.date) {
      submitError = '請求日を入力してください。';
      focusEl = dateEl;
    } else {
      submitError = '';
      state.registered = {
        count: state.lines.length,
        total: total(),
        supplier: state.supplier.trim(),
        date: state.date
      };
    }
    save();
    renderHeader();
    renderMessage();
    if (state.registered) {
      toast('ok', '登録しました（' + state.registered.count + '件・合計 ' + yen(state.registered.total) + '）');
    } else {
      toast('ng', submitError);
      if (focusEl) focusEl.focus();
    }
    if (msgEl.scrollIntoView) msgEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  // すべて消して最初から
  clearBtn.addEventListener('click', function () {
    state = { supplier: '', date: '', lines: [], registered: null };
    submitError = '';
    supplierEl.value = '';
    dateEl.value = '';
    nameEl.value = '';
    qtyEl.value = '';
    priceEl.value = '';
    lineError.hidden = true;
    save();
    render();
    toast('info', '入力をすべて消しました');
  });

  load();
  supplierEl.value = state.supplier || '';
  dateEl.value = state.date || '';
  render();
})();
