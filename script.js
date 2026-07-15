const $ = id => document.getElementById(id);
const fmt = n => Math.round(Number(n)||0).toLocaleString('ko-KR') + '원';
const ladderRates = {
  safe: { label: '안전망사다리', 201: 65000, 304: 75000 },
  bending: { label: '밴딩사다리', 201: 45000, 304: 55000 },
  straight: { label: '일자사다리', 304: 52000 }
};

let pipePrices = {};
let currentProduct = 'safe';
let currentMaterial = '201';
let quoteItems = [];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  $('quoteDate').value = new Date().toISOString().slice(0,10);
  bindEvents();
  try {
    const res = await fetch('pipe-price.json', {cache:'no-store'});
    pipePrices = await res.json();
  } catch (e) {
    alert('파이프 단가표를 불러오지 못했습니다. pipe-price.json 파일을 확인해주세요.');
  }
  addPipeRow();
  calculateLadder();
  renderItems();
}

function bindEvents() {
  document.querySelectorAll('#productTabs .tab').forEach(btn => {
    btn.addEventListener('click', () => switchProduct(btn.dataset.product));
  });
  document.querySelectorAll('#ladderMaterial button').forEach(btn => {
    btn.addEventListener('click', () => {
      currentMaterial = btn.dataset.value;
      document.querySelectorAll('#ladderMaterial button').forEach(x => x.classList.toggle('active', x === btn));
      calculateLadder();
    });
  });
  ['ladderHeight','ladderQty'].forEach(id => $(id).addEventListener('input', calculateLadder));
  document.querySelectorAll('#ladderOptions input').forEach(el => el.addEventListener('input', calculateLadder));
  document.querySelectorAll('#handrailOptions input').forEach(el => el.addEventListener('input', calculateHandrail));
  ['postQty','postPrice','handrailQty'].forEach(id => $(id).addEventListener('input', calculateHandrail));

  $('addPipeRow').addEventListener('click', addPipeRow);
  $('addLadder').addEventListener('click', addLadderItem);
  $('addHandrail').addEventListener('click', addHandrailItem);
  $('addExtraCost').addEventListener('click', addExtraCostItem);
  $('makeQuote').addEventListener('click', openQuote);
  $('closeQuote').addEventListener('click', () => $('quoteModal').classList.add('hidden'));
  $('printQuote').addEventListener('click', () => window.print());
  $('saveJpg').addEventListener('click', saveJpg);
  $('resetAll').addEventListener('click', resetAll);
  $('saveDraft').addEventListener('click', saveDraft);
  $('loadDraft').addEventListener('click', loadDraft);
}

function switchProduct(product) {
  currentProduct = product;
  document.querySelectorAll('#productTabs .tab').forEach(btn => btn.classList.toggle('active', btn.dataset.product === product));
  const handrail = product === 'handrail';
  $('ladderPanel').classList.toggle('hidden', handrail);
  $('handrailPanel').classList.toggle('hidden', !handrail);
  if (!handrail) {
    if (product === 'straight') {
      currentMaterial = '304';
      document.querySelector('[data-value="201"]').style.display = 'none';
      document.querySelectorAll('#ladderMaterial button').forEach(btn => btn.classList.toggle('active', btn.dataset.value === '304'));
    } else {
      document.querySelector('[data-value="201"]').style.display = '';
    }
    calculateLadder();
  }
}

function getLadderOptions() {
  let total = 0;
  const texts = [];
  document.querySelectorAll('#ladderOptions .option-card').forEach(card => {
    const check = card.querySelector('input[type=checkbox]');
    const qty = Number(card.querySelector('.option-qty').value) || 1;
    if (check.checked) {
      const price = Number(check.dataset.price);
      total += price * qty;
      texts.push(`${check.dataset.name} ${qty}개`);
    }
  });
  return { total, texts };
}

function calculateLadder() {
  const config = ladderRates[currentProduct];
  const rate = config?.[currentMaterial] || 0;
  const length = (Number($('ladderHeight').value)||0) / 1000;
  const qty = Number($('ladderQty').value)||1;
  const base = rate * length * qty;
  const options = getLadderOptions();
  $('ladderRate').value = fmt(rate);
  $('ladderBaseAmount').value = fmt(base);
  $('ladderSummaryName').textContent = `${config?.label||''} SUS${currentMaterial}`;
  $('ladderSummaryLength').textContent = `${length || 0}m`;
  $('ladderSummaryOptions').textContent = fmt(options.total);
  $('ladderSummaryTotal').textContent = fmt(base + options.total);
}

function addLadderItem() {
  const config = ladderRates[currentProduct];
  const rate = config?.[currentMaterial] || 0;
  const length = (Number($('ladderHeight').value)||0) / 1000;
  const qty = Number($('ladderQty').value)||1;
  if (!length || !rate) return alert('높이와 재질을 확인해주세요.');
  const options = getLadderOptions();
  const amount = rate * length * qty + options.total;
  quoteItems.push({
    name: `${config.label} SUS${currentMaterial}`,
    spec: `높이 ${length}m`,
    qty,
    unit: Math.round(rate * length),
    amount: Math.round(amount),
    note: options.texts.join(', ')
  });
  renderItems();
}

function addPipeRow() {
  const row = document.createElement('div');
  row.className = 'pipe-row';
  row.innerHTML = `
    <label>재질<select class="p-material"><option value="201">SUS201</option><option value="304">SUS304</option></select></label>
    <label>형태<select class="p-shape"><option value="round">원파이프</option><option value="square">사각파이프</option></select></label>
    <label>규격<select class="p-size"></select></label>
    <label>두께(T)<select class="p-thickness"></select></label>
    <label>길이(m)<input class="p-length" type="number" min="0" step="0.1" placeholder="예: 7.9"></label>
    <label>원/m 단가<input class="p-price" readonly></label>
    <button class="remove-btn" title="삭제">×</button>`;
  $('pipeRows').appendChild(row);

  row.querySelector('.p-material').addEventListener('change', () => fillSizes(row));
  row.querySelector('.p-shape').addEventListener('change', () => fillSizes(row));
  row.querySelector('.p-size').addEventListener('change', () => fillThickness(row));
  row.querySelector('.p-thickness').addEventListener('change', calculateHandrail);
  row.querySelector('.p-length').addEventListener('input', calculateHandrail);
  row.querySelector('.remove-btn').addEventListener('click', () => {
    if (document.querySelectorAll('.pipe-row').length <= 1) return alert('파이프 행은 최소 1개가 필요합니다.');
    row.remove();
    calculateHandrail();
  });
  fillSizes(row);
}

function getPriceTable(row) {
  const shape = row.querySelector('.p-shape').value;
  const material = row.querySelector('.p-material').value;
  return pipePrices?.[shape]?.[material] || {};
}

function fillSizes(row) {
  const table = getPriceTable(row);
  const size = row.querySelector('.p-size');
  size.innerHTML = Object.keys(table).map(x => `<option value="${x}">${x}</option>`).join('');
  fillThickness(row);
}

function fillThickness(row) {
  const table = getPriceTable(row);
  const size = row.querySelector('.p-size').value;
  const thickness = row.querySelector('.p-thickness');
  thickness.innerHTML = Object.keys(table[size] || {}).map(x => `<option value="${x}">${x}</option>`).join('');
  calculateHandrail();
}

function getHandrailExtras() {
  let total = 0;
  const texts = [];
  document.querySelectorAll('#handrailOptions .option-card').forEach(card => {
    const check = card.querySelector('input[type=checkbox]');
    const qtyInput = card.querySelector('.option-qty');
    const priceInput = card.querySelector('.option-price');
    if (check.checked) {
      const qty = Number(qtyInput?.value)||1;
      const price = Number(priceInput?.value)||0;
      total += qty * price;
      texts.push(check.dataset.name === '기타 추가금액' ? `${check.dataset.name} ${fmt(price)}` : `${check.dataset.name} ${qty}개`);
    }
  });
  const postQty = Number($('postQty').value)||0;
  const postPrice = Number($('postPrice').value)||0;
  if (postQty > 0 && postPrice > 0) {
    total += postQty * postPrice;
    texts.push(`포스트 ${postQty}개`);
  }
  return { total, texts };
}

function getPipeCalculation() {
  let oneSetPipeAmount = 0;
  let totalLength = 0;
  const parts = [];
  document.querySelectorAll('.pipe-row').forEach(row => {
    const shape = row.querySelector('.p-shape').value;
    const material = row.querySelector('.p-material').value;
    const size = row.querySelector('.p-size').value;
    const thickness = row.querySelector('.p-thickness').value;
    const length = Number(row.querySelector('.p-length').value)||0;
    const price = pipePrices?.[shape]?.[material]?.[size]?.[thickness] || 0;
    row.querySelector('.p-price').value = fmt(price);
    oneSetPipeAmount += price * length;
    totalLength += length;
    if (length > 0) parts.push(`SUS${material} ${shape === 'round' ? '원' : '사각'} ${size}×${thickness}T ${length}m`);
  });
  return { oneSetPipeAmount, totalLength, parts };
}

function calculateHandrail() {
  const pipe = getPipeCalculation();
  const extras = getHandrailExtras();
  const qty = Number($('handrailQty').value)||1;
  $('pipeKindCount').textContent = `${document.querySelectorAll('.pipe-row').length}종`;
  $('pipeLengthTotal').textContent = `${Number(pipe.totalLength.toFixed(2))}m`;
  $('handrailOptionTotal').textContent = fmt(extras.total);
  $('handrailGrandTotal').textContent = fmt((pipe.oneSetPipeAmount + extras.total) * qty);
}

function addHandrailItem() {
  const pipe = getPipeCalculation();
  if (!pipe.parts.length) return alert('파이프 길이를 입력해주세요.');
  const extras = getHandrailExtras();
  const qty = Number($('handrailQty').value)||1;
  const unit = pipe.oneSetPipeAmount + extras.total;
  const notes = [...extras.texts];
  if ($('handrailNote').value.trim()) notes.push($('handrailNote').value.trim());
  quoteItems.push({
    name: '핸드레일',
    spec: pipe.parts.join(' / '),
    qty,
    unit: Math.round(unit),
    amount: Math.round(unit * qty),
    note: notes.join(', ')
  });
  renderItems();
}

function addExtraCostItem() {
  const name = $('extraCostName').value.trim();
  const amount = Number($('extraCostAmount').value) || 0;
  const note = $('extraCostNote').value.trim();

  if (!name) return alert('기타 비용명을 입력해주세요.');
  if (amount <= 0) return alert('기타 비용 금액을 입력해주세요.');

  quoteItems.push({
    name,
    spec: '기타 비용',
    qty: 1,
    unit: Math.round(amount),
    amount: Math.round(amount),
    note
  });

  $('extraCostName').value = '';
  $('extraCostAmount').value = '';
  $('extraCostNote').value = '';
  renderItems();
}

function renderItems() {
  $('quoteItems').innerHTML = quoteItems.map((item, index) => `
    <tr>
      <td>${index+1}</td><td>${item.name}</td><td>${item.spec}</td><td>${item.qty}</td>
      <td>${fmt(item.unit)}</td><td>${fmt(item.amount)}</td><td>${item.note||''}</td>
      <td><button class="remove-btn" onclick="removeItem(${index})">삭제</button></td>
    </tr>`).join('');
  const subtotal = quoteItems.reduce((sum, item) => sum + item.amount, 0);
  const vat = Math.round(subtotal * 0.1);
  $('subtotal').textContent = fmt(subtotal);
  $('vat').textContent = fmt(vat);
  $('grandTotal').textContent = fmt(subtotal + vat);
}

window.removeItem = index => { quoteItems.splice(index,1); renderItems(); };

function openQuote() {
  if (!quoteItems.length) return alert('견적 목록에 제품을 추가해주세요.');
  $('quoteCustomer').innerHTML = `
    <div><b>견적일자</b><span>${$('quoteDate').value}</span></div>
    <div><b>업체명</b><span>${$('company').value}</span></div>
    <div><b>담당자</b><span>${$('manager').value}</span></div>
    <div><b>연락처</b><span>${$('phone').value}</span></div>
    <div><b>이메일</b><span>${$('email').value}</span></div>
    <div><b>현장명</b><span>${$('site').value}</span></div>`;
  $('quoteSheetItems').innerHTML = quoteItems.map((item,index)=>`
    <tr><td>${index+1}</td><td>${item.name}</td><td>${item.spec}</td><td>${item.qty}</td>
    <td>${fmt(item.unit)}</td><td>${fmt(item.amount)}</td><td>${item.note||''}</td></tr>`).join('');
  const subtotal = quoteItems.reduce((sum,item)=>sum+item.amount,0);
  const vat = Math.round(subtotal*0.1);
  $('quoteGrand').textContent = `총금액 ${fmt(subtotal+vat)} (V.A.T. 포함)`;
  $('quoteTotals').innerHTML = `
    <div><b>공급가액</b><span>${fmt(subtotal)}</span></div>
    <div><b>부가세</b><span>${fmt(vat)}</span></div>
    <div><b>총금액</b><span><strong>${fmt(subtotal+vat)}</strong></span></div>`;
  $('quoteModal').classList.remove('hidden');
}

async function saveJpg() {
  if (typeof html2canvas === 'undefined') return alert('JPG 저장 모듈을 불러오지 못했습니다. 인터넷 연결을 확인해주세요.');
  const canvas = await html2canvas($('quoteSheet'), {scale:2, useCORS:true, backgroundColor:'#fff'});
  const link = document.createElement('a');
  link.download = `강동자바라_사다리견적서_${$('company').value||'고객'}_${$('quoteDate').value}.jpg`;
  link.href = canvas.toDataURL('image/jpeg',0.95);
  link.click();
}

function resetAll() {
  if (!confirm('전체 내용을 초기화할까요?')) return;
  quoteItems = [];
  ['company','manager','phone','email','site','ladderHeight','handrailNote','extraCostName','extraCostAmount','extraCostNote'].forEach(id => $(id).value = '');
  $('ladderQty').value = 1; $('handrailQty').value = 1; $('postQty').value = 0; $('postPrice').value = 0;
  document.querySelectorAll('input[type=checkbox]').forEach(x => x.checked = false);
  renderItems(); calculateLadder(); calculateHandrail();
}

function saveDraft() {
  const data = {
    customer: ['quoteDate','company','manager','phone','email','site'].reduce((o,id)=>(o[id]=$(id).value,o),{}),
    items: quoteItems
  };
  localStorage.setItem('kd-ladder-draft', JSON.stringify(data));
  alert('현재 견적을 이 기기에 저장했습니다.');
}

function loadDraft() {
  const raw = localStorage.getItem('kd-ladder-draft');
  if (!raw) return alert('저장된 견적이 없습니다.');
  const data = JSON.parse(raw);
  Object.entries(data.customer||{}).forEach(([id,value]) => { if ($(id)) $(id).value = value; });
  quoteItems = Array.isArray(data.items) ? data.items : [];
  renderItems();
  alert('저장된 견적을 불러왔습니다.');
}
