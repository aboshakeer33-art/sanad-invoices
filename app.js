/* Sanad Invoicing — Offline, LocalStorage, SDG
   ✅ Profit is internal only (reports), never shown on invoice print/view
*/

const LS_KEY = "sanad_invoices_v1";

const fmt = (n) => {
  const x = Number(n || 0);
  return x.toLocaleString("en-US") + " SDG";
};
const todayISO = () => new Date().toISOString().slice(0,10);

function uid(prefix="ID"){
  return `${prefix}-${Math.random().toString(16).slice(2,8)}-${Date.now().toString(16)}`;
}

function loadDB(){
  const raw = localStorage.getItem(LS_KEY);
  if(raw){
    try { return JSON.parse(raw); } catch(e){}
  }
  // Seed
  return {
    settings:{
      nameAr:"سند",
      nameEn:"SANAD",
      locAr:"الخرطوم بحري",
      locEn:"Khartoum Bahri",
      phone:"+249913678918",
      currency:"SDG"
    },
    customers:[
      { id: uid("C"), name:"عميل نقدي", phone:"", notes:"" }
    ],
    items:[
      { id: uid("I"), name:"مفصلة جناح عادي", sell: 0, cost: 0, stock: 0 }
    ],
    invoices:[],
    returns:[]
  };
}

function saveDB(){
  localStorage.setItem(LS_KEY, JSON.stringify(DB));
}

let DB = loadDB();

/* ---------------- UI Helpers ---------------- */
const $ = (id) => document.getElementById(id);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

function setActiveView(view){
  qsa(".navBtn").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  qsa(".view").forEach(v => v.classList.toggle("active", v.id === `view-${view}`));
}

/* ---------------- Header / Settings ---------------- */
function renderHeader(){
  $("companyNameAr").textContent = DB.settings.nameAr || "سند";
  $("companyNameEn").textContent = DB.settings.nameEn || "SANAD";
  $("companyLocationAr").textContent = DB.settings.locAr || "";
  $("companyLocationEn").textContent = DB.settings.locEn || "";
  $("companyPhoneAr").textContent = DB.settings.phone || "";
  $("companyPhoneEn").textContent = DB.settings.phone || "";
  $("currencyBadge").textContent = DB.settings.currency || "SDG";
}

function fillSettingsForm(){
  $("setNameAr").value = DB.settings.nameAr || "";
  $("setNameEn").value = DB.settings.nameEn || "";
  $("setLocAr").value  = DB.settings.locAr  || "";
  $("setLocEn").value  = DB.settings.locEn  || "";
  $("setPhone").value  = DB.settings.phone  || "";
}

/* ---------------- Customers ---------------- */
function renderCustomers(){
  const sel = $("invCustomer");
  sel.innerHTML = "";
  DB.customers.forEach(c=>{
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });

  const tbody = $("customersTable").querySelector("tbody");
  tbody.innerHTML = "";
  DB.customers.forEach(c=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.phone || "")}</td>
      <td><button class="iconBtn" data-del-cust="${c.id}">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  // returns invoice selector
  renderReturnInvoiceSelect();
}

function addCustomer(){
  const name = $("custName").value.trim();
  const phone = $("custPhone").value.trim();
  const notes = $("custNotes").value.trim();
  if(!name) return alert("اكتب اسم العميل");
  DB.customers.push({ id: uid("C"), name, phone, notes });
  saveDB();
  $("custName").value = "";
  $("custPhone").value = "";
  $("custNotes").value = "";
  renderCustomers();
}

/* ---------------- Items ---------------- */
function renderItems(){
  const itemSel = $("lineItem");
  itemSel.innerHTML = "";
  DB.items.forEach(it=>{
    const opt = document.createElement("option");
    opt.value = it.id;
    opt.textContent = it.name;
    itemSel.appendChild(opt);
  });

  const retSel = $("retItem");
  retSel.innerHTML = "";
  DB.items.forEach(it=>{
    const opt = document.createElement("option");
    opt.value = it.id;
    opt.textContent = it.name;
    retSel.appendChild(opt);
  });

  const tbody = $("itemsTable").querySelector("tbody");
  tbody.innerHTML = "";
  DB.items.forEach(it=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(it.name)}</td>
      <td>${fmt(it.sell)}</td>
      <td>${Number(it.stock||0).toLocaleString("en-US")}</td>
      <td><button class="iconBtn" data-del-item="${it.id}">✕</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function addItem(){
  const name = $("itemName").value.trim();
  const sell = Number($("itemSell").value || 0);
  const cost = Number($("itemCost").value || 0);
  const stock = Number($("itemStock").value || 0);
  if(!name) return alert("اكتب اسم البند");
  DB.items.push({ id: uid("I"), name, sell, cost, stock });
  saveDB();
  $("itemName").value = "";
  $("itemSell").value = 0;
  $("itemCost").value = 0;
  $("itemStock").value = 0;
  renderItems();
}

/* ---------------- Invoices (Cart) ---------------- */
let CART = []; // {itemId, qty, discount}

function renderCart(){
  const tbody = $("cartTable").querySelector("tbody");
  tbody.innerHTML = "";
  CART.forEach((ln, idx)=>{
    const it = DB.items.find(x=>x.id===ln.itemId);
    const price = it ? Number(it.sell||0) : 0;
    const lineTotal = Math.max(0, price*ln.qty - Number(ln.discount||0));
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(it?.name || "—")}</td>
      <td>${fmt(price)}</td>
      <td>${Number(ln.qty).toLocaleString("en-US")}</td>
      <td>${fmt(ln.discount||0)}</td>
      <td>${fmt(lineTotal)}</td>
      <td><button class="iconBtn" data-del-line="${idx}">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  const totals = calcCartTotals();
  $("subTotal").textContent = fmt(totals.subtotal);
  $("discTotal").textContent = fmt(totals.discountTotal);
  $("grandTotal").textContent = fmt(totals.grandTotal);
}

function calcCartTotals(){
  let subtotal = 0;
  let discountTotal = 0;
  CART.forEach(ln=>{
    const it = DB.items.find(x=>x.id===ln.itemId);
    const price = it ? Number(it.sell||0) : 0;
    subtotal += price*Number(ln.qty||0);
    discountTotal += Number(ln.discount||0);
  });
  const grandTotal = Math.max(0, subtotal - discountTotal);
  return { subtotal, discountTotal, grandTotal };
}

function calcCartProfit(){
  // internal profit only: (sell - cost)*qty - discount
  let profit = 0;
  CART.forEach(ln=>{
    const it = DB.items.find(x=>x.id===ln.itemId);
    if(!it) return;
    const sell = Number(it.sell||0);
    const cost = Number(it.cost||0);
    profit += (sell - cost) * Number(ln.qty||0) - Number(ln.discount||0);
  });
  return profit;
}

function addLine(){
  const itemId = $("lineItem").value;
  const qty = Math.max(1, Number($("lineQty").value || 1));
  const discount = Math.max(0, Number($("lineDiscount").value || 0));
  if(!itemId) return alert("اختر بند");
  CART.push({ itemId, qty, discount });
  $("lineQty").value = 1;
  $("lineDiscount").value = 0;
  renderCart();
}

function clearCart(){
  CART = [];
  renderCart();
}

function saveInvoice(){
  if(CART.length === 0) return alert("السلة فاضية");
  const customerId = $("invCustomer").value;
  const date = $("invDate").value || todayISO();

  // check stock
  for(const ln of CART){
    const it = DB.items.find(x=>x.id===ln.itemId);
    if(!it) continue;
    const need = Number(ln.qty||0);
    if(Number(it.stock||0) < need){
      return alert(`المخزون غير كافي للبند: ${it.name}`);
    }
  }

  // deduct stock
  CART.forEach(ln=>{
    const it = DB.items.find(x=>x.id===ln.itemId);
    if(!it) return;
    it.stock = Number(it.stock||0) - Number(ln.qty||0);
  });

  const totals = calcCartTotals();
  const profit = calcCartProfit(); // internal
  const invNo = (DB.invoices.length + 1).toString().padStart(5,"0");

  DB.invoices.unshift({
    id: uid("INV"),
    no: invNo,
    date,
    customerId,
    lines: CART.map(x=>({...x})),
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    grandTotal: totals.grandTotal,
    profit // ✅ stored but never shown on invoice print/view
  });

  saveDB();
  clearCart();
  renderItems();
  renderInvoices();
  renderReportsQuick();
  renderReturnInvoiceSelect();
  alert(`تم حفظ الفاتورة رقم ${invNo}`);
}

function renderInvoices(){
  const search = ($("invSearch").value || "").trim().toLowerCase();
  const tbody = $("invoicesTable").querySelector("tbody");
  tbody.innerHTML = "";

  DB.invoices
    .filter(inv=>{
      const cust = DB.customers.find(c=>c.id===inv.customerId);
      const s = `${inv.no} ${cust?.name||""}`.toLowerCase();
      return !search || s.includes(search);
    })
    .forEach(inv=>{
      const cust = DB.customers.find(c=>c.id===inv.customerId);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(inv.no)}</td>
        <td>${escapeHtml(cust?.name || "—")}</td>
        <td>${escapeHtml(inv.date)}</td>
        <td>${fmt(inv.grandTotal)}</td>
        <td>
          <button class="iconBtn" data-print-inv="${inv.id}">🖨</button>
          <button class="iconBtn" data-del-inv="${inv.id}">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  // refresh returns selector items based on invoices
  renderReturnInvoiceSelect();
}

function printCurrentOrSelected(invoiceId=null){
  let inv = null;
  if(invoiceId){
    inv = DB.invoices.find(x=>x.id===invoiceId);
  }else{
    // print current cart as preview (without saving)
    if(CART.length === 0) return alert("السلة فاضية");
  }

  const s = DB.settings;
  const cust = inv ? DB.customers.find(c=>c.id===inv.customerId) : DB.customers.find(c=>c.id===$("invCustomer").value);
  const date = inv ? inv.date : ($("invDate").value || todayISO());
  const no = inv ? inv.no : "—";

  const lines = inv ? inv.lines : CART;
  const totals = inv ? {subtotal:inv.subtotal, discountTotal:inv.discountTotal, grandTotal:inv.grandTotal} : calcCartTotals();

  // ✅ PROFIT NOT INCLUDED
  const html = `
    <div class="card" style="background:#fff;border:1px solid #ddd;border-radius:14px;padding:14px;color:#111">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
        <div style="direction:ltr;text-align:left">
          <div style="font-weight:900;font-size:20px">${escapeHtml(s.nameEn||"SANAD")}</div>
          <div style="font-size:12px;color:#555">${escapeHtml(s.locEn||"")} • ${escapeHtml(s.phone||"")}</div>
        </div>
        <div style="direction:rtl;text-align:right">
          <div style="font-weight:900;font-size:26px">${escapeHtml(s.nameAr||"سند")}</div>
          <div style="font-size:12px;color:#555">${escapeHtml(s.locAr||"")} • ${escapeHtml(s.phone||"")}</div>
        </div>
      </div>

      <hr style="border:none;border-top:1px solid #ddd;margin:10px 0"/>

      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="direction:rtl"><b>رقم الفاتورة:</b> ${escapeHtml(no)} • <b>التاريخ:</b> ${escapeHtml(date)}</div>
        <div style="direction:ltr"><b>Invoice No:</b> ${escapeHtml(no)} • <b>Date:</b> ${escapeHtml(date)}</div>
      </div>

      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:6px">
        <div style="direction:rtl"><b>العميل:</b> ${escapeHtml(cust?.name||"")}</div>
        <div style="direction:ltr"><b>Customer:</b> ${escapeHtml(cust?.name||"")}</div>
      </div>

      <div style="margin-top:10px;border:1px solid #ddd;border-radius:12px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f7f7f7">
              <th style="text-align:right;padding:8px;border-bottom:1px solid #ddd">البند / Item</th>
              <th style="text-align:right;padding:8px;border-bottom:1px solid #ddd">سعر / Price</th>
              <th style="text-align:right;padding:8px;border-bottom:1px solid #ddd">كمية / Qty</th>
              <th style="text-align:right;padding:8px;border-bottom:1px solid #ddd">خصم / Disc</th>
              <th style="text-align:right;padding:8px;border-bottom:1px solid #ddd">الإجمالي / Total</th>
            </tr>
          </thead>
          <tbody>
            ${lines.map(ln=>{
              const it = DB.items.find(x=>x.id===ln.itemId);
              const price = it ? Number(it.sell||0) : 0;
              const total = Math.max(0, price*Number(ln.qty||0) - Number(ln.discount||0));
              return `
                <tr>
                  <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(it?.name||"—")}</td>
                  <td style="padding:8px;border-bottom:1px solid #eee">${fmt(price)}</td>
                  <td style="padding:8px;border-bottom:1px solid #eee">${Number(ln.qty||0).toLocaleString("en-US")}</td>
                  <td style="padding:8px;border-bottom:1px solid #eee">${fmt(ln.discount||0)}</td>
                  <td style="padding:8px;border-bottom:1px solid #eee">${fmt(total)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>

      <div style="margin-top:10px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="direction:rtl">
          <div><b>الإجمالي:</b> ${fmt(totals.subtotal)}</div>
          <div><b>الخصم:</b> ${fmt(totals.discountTotal)}</div>
          <div style="font-size:18px"><b>المبلغ النهائي:</b> ${fmt(totals.grandTotal)}</div>
        </div>
        <div style="direction:ltr;text-align:left">
          <div><b>Subtotal:</b> ${fmt(totals.subtotal)}</div>
          <div><b>Discount:</b> ${fmt(totals.discountTotal)}</div>
          <div style="font-size:18px"><b>Grand Total:</b> ${fmt(totals.grandTotal)}</div>
        </div>
      </div>

      <div style="margin-top:10px;color:#666;font-size:12px;display:flex;justify-content:space-between;gap:10px">
        <div style="direction:rtl">شكراً لتعاملكم مع سند</div>
        <div style="direction:ltr">Thank you for choosing Sanad</div>
      </div>
    </div>
  `;

  const printArea = $("printArea");
  printArea.innerHTML = html;
  window.print();
}

/* ---------------- Returns ---------------- */
function renderReturnInvoiceSelect(){
  const sel = $("retInvoice");
  if(!sel) return;
  const prev = sel.value;
  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "—";
  sel.appendChild(opt0);

  DB.invoices.forEach(inv=>{
    const cust = DB.customers.find(c=>c.id===inv.customerId);
    const opt = document.createElement("option");
    opt.value = inv.id;
    opt.textContent = `#${inv.no} — ${cust?.name||""} — ${inv.date}`;
    sel.appendChild(opt);
  });

  sel.value = prev || "";
}

function addReturn(){
  const invoiceId = $("retInvoice").value || null;
  const itemId = $("retItem").value;
  const qty = Math.max(1, Number($("retQty").value || 1));
  const reason = ($("retReason").value || "").trim();

  const it = DB.items.find(x=>x.id===itemId);
  if(!it) return alert("اختر بند صحيح");

  // amount uses selling price * qty (simple)
  const amount = Number(it.sell||0) * qty;

  // restore stock
  it.stock = Number(it.stock||0) + qty;

  DB.returns.unshift({
    id: uid("RET"),
    date: todayISO(),
    invoiceId,
    itemId,
    qty,
    amount,
    reason
  });

  saveDB();
  $("retQty").value = 1;
  $("retReason").value = "";
  renderItems();
  renderReturns();
  renderReportsQuick();
  alert("تم تسجيل المرتجع");
}

function renderReturns(){
  const tbody = $("returnsTable").querySelector("tbody");
  tbody.innerHTML = "";
  DB.returns.forEach(r=>{
    const inv = r.invoiceId ? DB.invoices.find(x=>x.id===r.invoiceId) : null;
    const it = DB.items.find(x=>x.id===r.itemId);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.date)}</td>
      <td>${inv ? escapeHtml(inv.no) : "—"}</td>
      <td>${escapeHtml(it?.name||"—")}</td>
      <td>${Number(r.qty||0).toLocaleString("en-US")}</td>
      <td>${fmt(r.amount||0)}</td>
      <td><button class="iconBtn" data-del-ret="${r.id}">✕</button></td>
    `;
    tbody.appendChild(tr);
  });
}

/* ---------------- Reports ---------------- */
function renderReportsQuick(){
  // all-time quick stats
  let sales = 0;
  let profit = 0;
  let invCount = 0;

  // returns reduce sales (simple)
  const returnsTotal = DB.returns.reduce((a,r)=>a+Number(r.amount||0),0);

  DB.invoices.forEach(inv=>{
    invCount++;
    sales += Number(inv.grandTotal||0);
    profit += Number(inv.profit||0);
  });

  sales = Math.max(0, sales - returnsTotal);

  $("repSales").textContent = fmt(sales);
  $("repInvCount").textContent = invCount.toLocaleString("en-US");
  $("repProfit").textContent = fmt(profit); // internal only
}

function runReport(){
  const from = $("repFrom").value || "0000-01-01";
  const to = $("repTo").value || "9999-12-31";

  const list = DB.invoices
    .filter(inv => inv.date >= from && inv.date <= to)
    .map(inv=>{
      const cust = DB.customers.find(c=>c.id===inv.customerId);
      return {
        date: inv.date,
        no: inv.no,
        customer: cust?.name || "—",
        sales: Number(inv.grandTotal||0),
        profit: Number(inv.profit||0)
      };
    });

  const tbody = $("reportTable").querySelector("tbody");
  tbody.innerHTML = "";
  list.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.no)}</td>
      <td>${escapeHtml(r.customer)}</td>
      <td>${fmt(r.sales)}</td>
      <td>${fmt(r.profit)}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ---------------- Delete handlers ---------------- */
function deleteInvoice(id){
  const inv = DB.invoices.find(x=>x.id===id);
  if(!inv) return;

  // restore stock (since invoice deleted)
  inv.lines.forEach(ln=>{
    const it = DB.items.find(x=>x.id===ln.itemId);
    if(!it) return;
    it.stock = Number(it.stock||0) + Number(ln.qty||0);
  });

  // also detach returns linked to this invoice (keep them but set invoiceId null)
  DB.returns.forEach(r=>{
    if(r.invoiceId === id) r.invoiceId = null;
  });

  DB.invoices = DB.invoices.filter(x=>x.id!==id);
  saveDB();
  renderItems();
  renderInvoices();
  renderReturnInvoiceSelect();
  renderReportsQuick();
}

function deleteReturn(id){
  // when deleting a return, subtract its stock restore effect
  const r = DB.returns.find(x=>x.id===id);
  if(!r) return;
  const it = DB.items.find(x=>x.id===r.itemId);
  if(it){
    it.stock = Math.max(0, Number(it.stock||0) - Number(r.qty||0));
  }
  DB.returns = DB.returns.filter(x=>x.id!==id);
  saveDB();
  renderItems();
  renderReturns();
  renderReportsQuick();
}

function deleteItem(id){
  // prevent delete if used in invoices
  const used = DB.invoices.some(inv => inv.lines.some(ln=>ln.itemId===id));
  if(used) return alert("لا يمكن حذف بند مستخدم في فواتير محفوظة");
  DB.items = DB.items.filter(x=>x.id!==id);
  saveDB();
  renderItems();
  renderCart();
}

function deleteCustomer(id){
  // prevent delete if used
  const used = DB.invoices.some(inv => inv.customerId === id);
  if(used) return alert("لا يمكن حذف عميل مرتبط بفواتير");
  if(DB.customers.length<=1) return alert("لا يمكن حذف آخر عميل");
  DB.customers = DB.customers.filter(x=>x.id!==id);
  saveDB();
  renderCustomers();
}

/* ---------------- Misc ---------------- */
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* ---------------- Events ---------------- */
function bindEvents(){
  // navigation
  qsa(".navBtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      setActiveView(btn.dataset.view);
    });
  });

  // defaults
  $("invDate").value = todayISO();

  // invoice
  $("addLineBtn").addEventListener("click", addLine);
  $("clearCartBtn").addEventListener("click", clearCart);
  $("saveInvoiceBtn").addEventListener("click", saveInvoice);
  $("printInvoiceBtn").addEventListener("click", ()=>printCur
