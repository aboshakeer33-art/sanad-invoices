import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  collection, addDoc, getDocs, doc, setDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* =========================
   Helpers
========================= */
const $ = (id) => document.getElementById(id);
const fmt = (n) => `SDG ${Number(n || 0).toLocaleString("en-US")}`;
const todayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
const n0 = (v) => Number(v || 0);

/* =========================
   UI Refs
========================= */
const authBox = $("authBox");
const appBox = $("appBox");

const authMsg = $("authMsg");
const invMsg = $("invMsg");
const prodMsg = $("prodMsg");
const custMsg = $("custMsg");
const repMsg = $("repMsg");
const expMsg = $("expMsg");

/* =========================
   Tabs
========================= */
document.querySelectorAll(".tabBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabBtn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.tab;
    document.querySelectorAll(".tabPane").forEach(p => p.classList.add("hidden"));
    $(target).classList.remove("hidden");
  });
});

/* =========================
   Auth
========================= */
$("btnLogin").addEventListener("click", async () => {
  authMsg.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
  } catch (e) {
    authMsg.textContent = `فشل الدخول: ${e.message}`;
  }
});

$("btnSignup").addEventListener("click", async () => {
  authMsg.textContent = "";
  try {
    await createUserWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
    authMsg.textContent = "تم إنشاء الحساب. الآن سجل دخول.";
  } catch (e) {
    authMsg.textContent = `فشل إنشاء الحساب: ${e.message}`;
  }
});

$("btnLogout").addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    authBox.classList.add("hidden");
    appBox.classList.remove("hidden");
    boot();
  } else {
    appBox.classList.add("hidden");
    authBox.classList.remove("hidden");
  }
});

/* =========================
   State
========================= */
let products = [];   // {id,name,sellPrice,buyPrice}
let invoiceItems = []; // {productId,name,qty,sellPrice,buyPrice}

/* =========================
   Boot
========================= */
function boot() {
  // defaults
  $("invDate").value = todayStr();
  $("rFrom").value = todayStr();
  $("rTo").value = todayStr();
  $("eDate").value = todayStr();

  // live lists
  watchProducts();
  watchCustomers();
  watchExpenses();

  // invoice actions
  $("btnAddItem").onclick = addInvoiceItem;
  $("btnSaveInvoice").onclick = saveInvoice;

  // products
  $("btnAddProduct").onclick = addOrUpdateProduct;

  // customers
  $("btnAddCustomer").onclick = addCustomer;

  // reports
  $("btnRunReport").onclick = runReport;

  // print
  $("btnPrintA4").onclick = () => printInvoice("A4");
  $("btnPrint80").onclick = () => printInvoice("80");

  // when choosing product -> auto sell price
  $("invProduct").addEventListener("change", syncSellPriceFromProduct);

  // load initial inv no
  $("invNo").value = `INV-${Date.now().toString().slice(-6)}`;

  recalcTotals();
}

/* =========================
   Products
========================= */
function watchProducts() {
  const qy = query(collection(db, "products"), orderBy("name"));
  onSnapshot(qy, (snap) => {
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProducts();
    fillProductsSelect();
    syncSellPriceFromProduct();
  });
}

function renderProducts() {
  const tb = $("productsTable").querySelector("tbody");
  tb.innerHTML = "";
  products.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.name || ""}</td>
      <td>${fmt(p.sellPrice)}</td>
      <td>${fmt(p.buyPrice)}</td>
      <td class="actions">
        <button class="btn sm" data-edit="${p.id}">تعديل</button>
        <button class="btn sm danger" data-del="${p.id}">حذف</button>
      </td>
    `;
    tb.appendChild(tr);
  });

  tb.querySelectorAll("[data-edit]").forEach(b => {
    b.onclick = () => {
      const p = products.find(x => x.id === b.dataset.edit);
      $("pName").value = p.name || "";
      $("pSell").value = p.sellPrice ?? 0;
      $("pBuy").value = p.buyPrice ?? 0;
      $("pName").dataset.editId = p.id;
      prodMsg.textContent = "تعديل جاهز — اضغط إضافة/تحديث للحفظ.";
    };
  });

  tb.querySelectorAll("[data-del]").forEach(b => {
    b.onclick = async () => {
      await deleteDoc(doc(db, "products", b.dataset.del));
    };
  });
}

async function addOrUpdateProduct() {
  prodMsg.textContent = "";
  const name = $("pName").value.trim();
  const sellPrice = n0($("pSell").value);
  const buyPrice = n0($("pBuy").value);

  if (!name) return (prodMsg.textContent = "اكتب اسم المنتج.");

  const editId = $("pName").dataset.editId;
  if (editId) {
    await setDoc(doc(db, "products", editId), {
      name, sellPrice, buyPrice, updatedAt: serverTimestamp()
    }, { merge: true });
    $("pName").dataset.editId = "";
    prodMsg.textContent = "تم تحديث المنتج ✅";
  } else {
    await addDoc(collection(db, "products"), {
      name, sellPrice, buyPrice, createdAt: serverTimestamp()
    });
    prodMsg.textContent = "تم إضافة المنتج ✅";
  }

  $("pName").value = "";
  $("pSell").value = "";
  $("pBuy").value = "";
}

function fillProductsSelect() {
  const sel = $("invProduct");
  const current = sel.value;
  sel.innerHTML = `<option value="">اختر منتج...</option>`;
  products.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
  if (products.some(p => p.id === current)) sel.value = current;
}

function syncSellPriceFromProduct() {
  const pid = $("invProduct").value;
  const p = products.find(x => x.id === pid);
  if (p) $("invSell").value = p.sellPrice ?? "";
}

/* =========================
   Invoice
========================= */
function addInvoiceItem() {
  invMsg.textContent = "";
  const pid = $("invProduct").value;
  const qty = n0($("invQty").value);
  const sellPrice = n0($("invSell").value);

  if (!pid) return (invMsg.textContent = "اختر منتج.");
  if (qty <= 0) return (invMsg.textContent = "الكمية لازم تكون أكبر من صفر.");

  const p = products.find(x => x.id === pid);
  if (!p) return (invMsg.textContent = "المنتج غير موجود.");

  invoiceItems.push({
    productId: pid,
    name: p.name,
    qty,
    sellPrice,
    buyPrice: n0(p.buyPrice)
  });

  renderItems();
  recalcTotals();
}

function renderItems() {
  const tb = $("itemsTable").querySelector("tbody");
  tb.innerHTML = "";
  invoiceItems.forEach((it, idx) => {
    const total = it.qty * it.sellPrice;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${it.name}</td>
      <td>${it.qty}</td>
      <td>${fmt(it.sellPrice)}</td>
      <td>${fmt(it.buyPrice)}</td>
      <td>${fmt(total)}</td>
      <td class="actions">
        <button class="btn sm danger" data-rm="${idx}">حذف</button>
      </td>
    `;
    tb.appendChild(tr);
  });

  tb.querySelectorAll("[data-rm]").forEach(b => {
    b.onclick = () => {
      invoiceItems.splice(Number(b.dataset.rm), 1);
      renderItems();
      recalcTotals();
    };
  });
}

function recalcTotals() {
  const subtotal = invoiceItems.reduce((s, it) => s + it.qty * it.sellPrice, 0);
  const costTotal = invoiceItems.reduce((s, it) => s + it.qty * it.buyPrice, 0);

  const discount = n0($("invDiscount")?.value);
  const shipping = n0($("invShipping")?.value);
  const otherCost = n0($("invOtherCost")?.value);

  const grand = Math.max(0, subtotal - discount) + shipping;
  const profit = grand - (costTotal + otherCost);

  $("tGrand").textContent = fmt(grand);
  $("tCost").textContent = fmt(costTotal);
  $("tProfit").textContent = fmt(profit);
}

["invDiscount","invShipping","invOtherCost"].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener("input", recalcTotals);
});

async function saveInvoice() {
  invMsg.textContent = "";
  if (invoiceItems.length === 0) return (invMsg.textContent = "أضف بند واحد على الأقل.");

  const date = $("invDate").value || todayStr();
  const number = $("invNo").value.trim() || `INV-${Date.now().toString().slice(-6)}`;
  const customer = $("invCustomer").value.trim();

  const discount = n0($("invDiscount").value);
  const shipping = n0($("invShipping").value);
  const otherCost = n0($("invOtherCost").value);

  const subtotal = invoiceItems.reduce((s, it) => s + it.qty * it.sellPrice, 0);
  const costTotal = invoiceItems.reduce((s, it) => s + it.qty * it.buyPrice, 0);
  const grand = Math.max(0, subtotal - discount) + shipping;
  const profit = grand - (costTotal + otherCost);

  const payload = {
    number,
    date,             // YYYY-MM-DD (ممتاز للتقارير)
    customer,
    items: invoiceItems.map(it => ({
      productId: it.productId,
      name: it.name,
      qty: it.qty,
      sellPrice: it.sellPrice,
      buyPrice: it.buyPrice,
      lineTotal: it.qty * it.sellPrice,
      lineCost: it.qty * it.buyPrice
    })),
    totals: {
      subtotal,
      discount,
      shipping,
      otherCost,
      grand,
      costTotal,
      profit
    },
    createdAt: serverTimestamp()
  };

  await addDoc(collection(db, "invoices"), payload);

  invMsg.textContent = `تم حفظ الفاتورة ✅ (الربح: ${fmt(profit)})`;

  // reset for next invoice
  invoiceItems = [];
  renderItems();
  $("invNo").value = `INV-${Date.now().toString().slice(-6)}`;
  $("invCustomer").value = "";
  $("invDiscount").value = 0;
  $("invShipping").value = 0;
  $("invOtherCost").value = 0;
  recalcTotals();
}

/* =========================
   Customers
========================= */
function watchCustomers() {
  const qy = query(collection(db, "customers"), orderBy("name"));
  onSnapshot(qy, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const tb = $("customersTable").querySelector("tbody");
    tb.innerHTML = "";
    list.forEach(c => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.name || ""}</td>
        <td>${c.phone || ""}</td>
        <td class="actions">
          <button class="btn sm danger" data-del="${c.id}">حذف</button>
        </td>
      `;
      tb.appendChild(tr);
    });
    tb.querySelectorAll("[data-del]").forEach(b => {
      b.onclick = async () => await deleteDoc(doc(db, "customers", b.dataset.del));
    });
  });
}

async function addCustomer() {
  custMsg.textContent = "";
  const name = $("cName").value.trim();
  const phone = $("cPhone").value.trim();
  if (!name) return (custMsg.textContent = "اكتب اسم العميل.");

  await addDoc(collection(db, "customers"), {
    name, phone, createdAt: serverTimestamp()
  });

  custMsg.textContent = "تم إضافة العميل ✅";
  $("cName").value = "";
  $("cPhone").value = "";
}

/* =========================
   Reports
========================= */
async function runReport() {
  repMsg.textContent = "";
  const from = $("rFrom").value || todayStr();
  const to = $("rTo").value || todayStr();

  // We store date as string YYYY-MM-DD => string compare works for ranges.
  const qy = query(
    collection(db, "invoices"),
    where("date", ">=", from),
    where("date", "<=", to),
    orderBy("date", "asc")
  );

  const snap = await getDocs(qy);
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const sales = rows.reduce((s, r) => s + n0(r.totals?.grand), 0);
  const profit = rows.reduce((s, r) => s + n0(r.totals?.profit), 0);

  $("rSales").textContent = fmt(sales);
  $("rProfit").textContent = fmt(profit);
  $("rCount").textContent = String(rows.length);

  const tb = $("reportTable").querySelector("tbody");
  tb.innerHTML = "";
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.date || ""}</td>
      <td>${r.number || ""}</td>
      <td>${r.customer || "-"}</td>
      <td>${fmt(r.totals?.grand)}</td>
      <td class="goldText">${fmt(r.totals?.profit)}</td>
    `;
    tb.appendChild(tr);
  });

  repMsg.textContent = "تم ✅";
}

/* =========================
   Expenses (Optional)
========================= */
function watchExpenses() {
  const qy = query(collection(db, "expenses"), orderBy("date", "desc"));
  onSnapshot(qy, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const tb = $("expensesTable").querySelector("tbody");
    tb.innerHTML = "";
    list.forEach(e => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${e.date || ""}</td>
        <td>${e.title || ""}</td>
        <td>${fmt(e.amount)}</td>
        <td class="actions">
          <button class="btn sm danger" data-del="${e.id}">حذف</button>
        </td>
      `;
      tb.appendChild(tr);
    });

    tb.querySelectorAll("[data-del]").forEach(b => {
      b.onclick = async () => await deleteDoc(doc(db, "expenses", b.dataset.del));
    });
  });
}

$("btnAddExpense")?.addEventListener("click", async () => {
  expMsg.textContent = "";
  const date = $("eDate").value || todayStr();
  const title = $("eTitle").value.trim();
  const amount = n0($("eAmount").value);
  if (!title) return (expMsg.textContent = "اكتب وصف المصروف.");
  if (amount <= 0) return (expMsg.textContent = "اكتب مبلغ صحيح.");

  await addDoc(collection(db, "expenses"), {
    date, title, amount, createdAt: serverTimestamp()
  });

  expMsg.textContent = "تم إضافة المصروف ✅";
  $("eTitle").value = "";
  $("eAmount").value = "";
});

/* =========================
   Printing (Basic)
========================= */
function printInvoice(mode) {
  // يطبع آخر فاتورة موجودة في الشاشة (invoiceItems + totals)
  const date = $("invDate").value || todayStr();
  const number = $("invNo").value.trim();
  const customer = $("invCustomer").value.trim();

  const subtotal = invoiceItems.reduce((s, it) => s + it.qty * it.sellPrice, 0);
  const costTotal = invoiceItems.reduce((s, it) => s + it.qty * it.buyPrice, 0);
  const discount = n0($("invDiscount").value);
  const shipping = n0($("invShipping").value);
  const otherCost = n0($("invOtherCost").value);
  const grand = Math.max(0, subtotal - discount) + shipping;
  const profit = grand - (costTotal + otherCost);

  const lines = invoiceItems.map(it => `
    <tr>
      <td>${it.name}</td>
      <td>${it.qty}</td>
      <td>${fmt(it.sellPrice)}</td>
      <td>${fmt(it.qty * it.sellPrice)}</td>
    </tr>
  `).join("");

  const is80 = mode === "80";
  const w = is80 ? "80mm" : "A4";

  const html = `
  <div class="printCard ${is80 ? "p80" : "pA4"}">
    <div class="pHead">
      <img src="logo.png" class="pLogo" />
      <div>
        <h2>سند لإكسسوارات الأبواب والألمنيوم</h2>
        <div class="muted">فاتورة — ${w}</div>
      </div>
    </div>
    <div class="pMeta">
      <div>رقم: <b>${number || "-"}</b></div>
      <div>تاريخ: <b>${date}</b></div>
      <div>عميل: <b>${customer || "-"}</b></div>
    </div>

    <table class="pTable">
      <thead><tr><th>الصنف</th><th>كمية</th><th>سعر</th><th>إجمالي</th></tr></thead>
      <tbody>${lines || ""}</tbody>
    </table>

    <div class="pTotals">
      <div>الإجمالي: <b>${fmt(grand)}</b></div>
      <div>خصم: <b>${fmt(discount)}</b></div>
      <div>ترحيل: <b>${fmt(shipping)}</b></div>
      <div>مصروفات: <b>${fmt(otherCost)}</b></div>
      <div class="goldText">صافي الربح: <b>${fmt(profit)}</b></div>
    </div>

    <div class="pFoot muted">شكراً لتعاملكم مع سند</div>
  </div>`;

  const area = $("printArea");
  area.innerHTML = html;
  area.classList.remove("hidden");

  window.print();

  setTimeout(() => {
    area.classList.add("hidden");
    area.innerHTML = "";
  }, 500);
        }
