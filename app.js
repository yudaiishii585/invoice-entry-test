// ひなた製菓 社内システム「仕入れ請求書の入力」（研修用の練習サイト）
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

  var state = { supplier: '', date: '', lines: [], registered: null };
  var submitError = '';

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

  function cell(tr, text, cls) {
    var td = document.createElement('td');
    if (cls) td.className = cls;
    td.textContent = text;
    tr.appendChild(td);
  }

  function render() {
    tbody.textContent = '';
    state.lines.forEach(function (l, i) {
      var no = i + 1;
      var tr = document.createElement('tr');
      tr.id = 'line-' + no;
      tr.className = 'line';
      cell(tr, String(no), 'no');
      cell(tr, l.name, 'name');
      cell(tr, fmt(l.qty), 'num');
      cell(tr, yen(l.price), 'num');
      cell(tr, yen(l.qty * l.price), 'num');
      var td = document.createElement('td');
      td.className = 'act';
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'secondary small';
      b.id = 'delete-' + no;
      b.textContent = '削除';
      b.setAttribute('aria-label', no + '行目（' + l.name + '）を削除');
      b.addEventListener('click', function () {
        state.lines.splice(i, 1);
        state.registered = null;
        submitError = '';
        save();
        render();
      });
      td.appendChild(b);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    if (state.lines.length === 0) {
      var er = document.createElement('tr');
      er.className = 'empty-row';
      var etd = document.createElement('td');
      etd.colSpan = 6;
      etd.textContent = 'まだ明細がありません。上の欄に入力して［追加］を押してください。';
      er.appendChild(etd);
      tbody.appendChild(er);
    }
    totalEl.textContent = yen(total());
    countEl.textContent = state.lines.length + '件';
    renderMessage();
  }

  function renderMessage() {
    msgEl.className = '';
    msgEl.textContent = '';
    if (state.registered) {
      msgEl.className = 'ok';
      var main = document.createElement('strong');
      main.textContent = '登録しました（' + state.registered.count + '件・合計 ' + yen(state.registered.total) + '）';
      var sub = document.createElement('span');
      sub.textContent = '仕入先：' + state.registered.supplier + ' ／ 請求日：' + dateLabel(state.registered.date);
      msgEl.appendChild(main);
      msgEl.appendChild(sub);
    } else if (submitError) {
      msgEl.className = 'error';
      msgEl.textContent = submitError;
    }
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
    renderMessage();
  }
  supplierEl.addEventListener('input', onHeaderChange);
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
    save();
    render();
    nameEl.value = '';
    qtyEl.value = '';
    priceEl.value = '';
    nameEl.focus();
  });

  // 登録する（この練習サイトでは画面に結果を出すだけ。どこにも送らない）
  submitBtn.addEventListener('click', function () {
    state.supplier = supplierEl.value;
    state.date = dateEl.value;
    if (state.lines.length === 0) {
      submitError = '明細が0件です。1行以上追加してから登録してください。';
    } else if (!state.supplier.trim()) {
      submitError = '仕入先を入力してください。';
    } else if (!state.date) {
      submitError = '請求日を入力してください。';
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
    renderMessage();
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
  });

  load();
  supplierEl.value = state.supplier || '';
  dateEl.value = state.date || '';
  render();
})();
