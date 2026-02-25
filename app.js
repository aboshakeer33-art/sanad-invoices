import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  collection, addDoc, doc, getDoc, setDoc, updateDoc,
  deleteDoc, getDocs, query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ========= Helpers ========= */
const $ = (id) => document.getElementById(id);
const fmt = (n) => (Number(n || 0)).toLocaleString("ar-SD");
const todayISO = () => new Date().toISOString().slice(0,10);

let currentUser = null;
let items = []; // current invoice items

function ownerWrap(data){
  return { ...data, ownerUid: currentUser.uid };
}

/* ========= UI: Tabs ========= */
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    const t = btn.dataset.tab;
    document.querySelectorAll(".tabpane").forEach(p=>p.classList.add("hidden"));
    $(`tab-${t}`).classList.remove("hidden");
  });
});

/* ========= Auth ========= */
$("btnLogin").addEventListener("click", async ()=>{
  $("authMsg").textContent = "جارٍ الدخول...";
  try{
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
    $("authMsg").textContent = "";
  }catch(e){
    $("authMsg").textContent = "فشل الدخول: " + (e?.message || e);
  }
});

$("btnSignup").addEventListener("click", async ()=>{
  $("authMsg").textContent = "جارٍ إنشاء الحساب...";
  try{
    await createUserWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
    $("authMsg").textContent = "تم إنشاء الحساب. سجل دخول الآن.";
  }catch(e){
    $("authMsg").textContent = "فشل إنشاء الحساب: " + (e?.message || e);
  }
});

$("btnLogout").addEventListener("click", ()=> signOut(auth));

onAuthStateChanged(auth, async (user)=>{
  currentUser = user || null;
  if(!currentUser){
    $("authView").classList.remove("hidden");
    $("mainView").classList.add("hidden");
    return;
  }
  $("authView").classList.add("hidden");
  $("mainView").classList.remove("hidden");

  // init defaults
  $("invoiceDate").value = todayISO();

  await ensureSettings();
  await loadCustomers();
  await loadProducts();
  await nextInvoiceNo();
  await refreshInvoices();
});

/* ========= Settings: invoice counter ========= */
async function ensureSettings(){
  const ref = doc(db, "settings", "main_" + currentUser.uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    await setDoc(ref, ownerWrap({
      shopName: "سند لإكسسوارات الأبواب والألمنيوم",
      currency: "SDG",
      lastInvoiceNo: 0,
      createdAt: serverTimestamp()
    }));
  }
}

async function nextInvoiceNo(){
  const ref = doc(db, "settings", "main_" + currentUser.uid);
  const snap = await getDoc(ref);
  const last = snap.data().lastInvoiceNo || 0;
  const next = last + 1;
  const no = "INV-" + String(next).padStart(6,"0");
  $("invoiceNo").value = no;
  return { ref, last, next, no };
}

/* ========= Customers ========= */
$("btnAddCustomer").addEventListener("click", async ()=>{
  const name = $("cName").value.trim();
  const phone = $("cPhone").value.trim();
  if(!name) return;

  await addDoc(collection(db,"customers"), ownerWrap({
    name, phone,
    createdAt: serverTimestamp()
  }));
  $("cName").value = ""; $("cPhone").value = "";
  await loadCustomers();
});

async function loadCustomers(){
  const tbody = $("customersTable").querySelector("tbody");
  tbody.innerHTML = "";
  const sel = $("invoiceCustomer");
  sel.innerHTML = "";
  // default cash customer
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "عميل نقدي";
  sel.appendChild(opt0);

  const qy = query(collection(db,"customers"), orderBy("createdAt","desc"), limit(200));
  const snaps = await getDocs(qy);

  snaps.forEach(s=>{
    const d = s.data();
    if(d.ownerUid !== currentUser.uid) return;

    // table
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.name}</td>
      <td>${d.phone || ""}</td>
      <td><button class="iconbtn" data-del="${s.id}">حذف</button></td>
    `;
    tbody.appendChild(tr);

    // select
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = d.name;
    sel.appendChild(opt);
  });

  tbody.querySelectorAll("button[data-del]").forEach(b=>{
    b.addEventListener("click", async ()=>{
      await deleteDoc(doc(db,"customers", b.dataset.del));
      await loadCustomers();
    });
  });
}

/* ========= Products ========= */
$("btnAddProduct").addEventListener("click", async ()=>{
  const name = $("pName").value.trim();
  const price = Number($("pPrice").value || 0);
  if(!name) return;
  await addDoc(collection(db,"products"), ownerWrap({
    name, price,
    createdAt: serverTimestamp()
  }));
  $("pName").value=""; $("pPrice").value="";
  await loadProducts();
});

async function loadProducts(){
  const tbody = $("productsTable").querySelector("tbody");
  tbody.innerHTML = "";
  const sel = $("itemProduct");
  sel.innerHTML = `<option value="">اختر منتج</option>`;

  const qy = query(collection(db,"products"), orderBy("createdAt","desc"), limit(500));
  const snaps = await getDocs(qy);

  snaps.forEach(s=>{
    const d = s.data();
    if(d.ownerUid !== currentUser.uid) return;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.name}</td>
      <td>${fmt(d.price)} SDG</td>
      <td><button class="iconbtn" data-del="${s.id}">حذف</button></td>
    `;
    tbody.appendChild(tr);

    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${d.name} — ${fmt(d.price)} SDG`;
    opt.dataset.price = d.price;
    sel.appendChild(opt);
  });

  sel.addEventListener("change", ()=>{
    const o = sel.options[sel.selectedIndex];
    $("itemPrice").value = o?.dataset?.price || "";
  }, { once:false });

  tbody.querySelectorAll("button[data-del]").forEach(b=>{
    b.addEventListener("click", async ()=>{
      await deleteDoc(doc(db,"products", b.dataset.del));
      await loadProducts();
    });
  });
}

/* ========= Invoice items ========= */
$("btnAddItem").addEventListener("click", ()=>{
  const prodSel = $("itemProduct");
  const prodId = prodSel.value;
  const prodText = prodSel.options[prodSel.selectedIndex]?.textContent || "";
  const name = prodText.split("—")[0].trim() || "صنف";
  const price = Number($("itemPrice").value || 0);
  const qty = Number($("itemQty").value || 1);
  if(!prodId && !name) return;
  if(qty <= 0) return;

  items.push({ prodId, name, price, qty, total: price*qty });
  renderItems();
});

function renderItems(){
  const tb = $("itemsTable").querySelector("tbody");
  tb.innerHTML = "";
  items.forEach((it, idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${it.name}</td>
      <td>${fmt(it.price)}</td>
      <td>${fmt(it.qty)}</td>
      <td>${fmt(it.total)}</td>
      <td><button class="iconbtn" data-rm="${idx}">حذف</button></td>
    `;
    tb.appendChild(tr);
  });

  tb.querySelectorAll("button[data-rm]").forEach(b=>{
    b.addEventListener("click", ()=>{
      items.splice(Number(b.dataset.rm), 1);
      renderItems();
    });
  });

  recalcTotals();
}

$("discount").addEventListener("input", recalcTotals);
$("paid").addEventListener("input", recalcTotals);

function recalcTotals(){
  const sum = items.reduce((a,b)=> a + (b.total||0), 0);
  const discount = Number($("discount").value || 0);
  const grand = Math.max(0, sum - discount);
  const paid = Number($("paid").value || 0);
  const due = Math.max(0, grand - paid);
  $("grandTotal").textContent = fmt(grand);
  $("dueTotal").textContent = fmt(due);
  return { sum, discount, grand, paid, due };
}

/* ========= Save Invoice ========= */
$("btnSaveInvoice").addEventListener("click", async ()=>{
  if(items.length === 0){
    $("saveMsg").textContent = "أضف بند واحد على الأقل.";
    return;
  }
  $("saveMsg").textContent = "جارٍ الحفظ...";

  const { ref, next, no } = await nextInvoiceNo();
  const dt = $("invoiceDate").value || todayISO();
  const customerId = $("invoiceCustomer").value || "";
  const customerName = $("invoiceCustomer").selectedOptions[0]?.textContent || "عميل نقدي";
  const totals = recalcTotals();

  const invoiceDoc = await addDoc(collection(db,"invoices"), ownerWrap({
    invoiceNo: no,
    date: dt,
    customerId,
    customerName,
    items,
    discount: totals.discount,
    total: totals.grand,
    paid: totals.paid,
    due: totals.due,
    createdAt: serverTimestamp()
  }));

  await updateDoc(ref, ownerWrap({ lastInvoiceNo: next }));

  // reset
  items = [];
  renderItems();
  $("discount").value = 0;
  $("paid").value = 0;
  $("saveMsg").textContent = "تم حفظ الفاتورة ✅";

  await nextInvoiceNo();
  await refreshInvoices();

  // جهّز للطباعة فوراً
  await printInvoice(invoiceDoc.id);
});

/* ========= Invoices list ========= */
$("btnRefreshInvoices").addEventListener("click", refreshInvoices);

async function refreshInvoices(){
  const tbody = $("invoicesTable").querySelector("tbody");
  tbody.innerHTML = "";
  const qy = query(collection(db,"invoices"), orderBy("createdAt","desc"), limit(200));
  const snaps = await getDocs(qy);

  snaps.forEach(s=>{
    const d = s.data();
    if(d.ownerUid !== currentUser.uid) return;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.invoiceNo}</td>
      <td>${d.date}</td>
      <td>${d.customerName || ""}</td>
      <td>${fmt(d.total)} SDG</td>
      <td>${fmt(d.paid)} SDG</td>
      <td>${fmt(d.due)} SDG</td>
      <td><button class="iconbtn" data-print="${s.id}">طباعة</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-print]").forEach(b=>{
    b.addEventListener("click", ()=> printInvoice(b.dataset.print));
  });
}

/* ========= Print A4 ========= */
$("btnPrint").addEventListener("click", async ()=>{
  // طباعة آخر فاتورة محفوظة إن وجدت
  const qy = query(collection(db,"invoices"), orderBy("createdAt","desc"), limit(1));
  const snaps = await getDocs(qy);
  const first = snaps.docs.find(x=> x.data().ownerUid === currentUser.uid);
  if(first) await printInvoice(first.id);
});

async function printInvoice(id){
  const snap = await getDoc(doc(db,"invoices", id));
  if(!snap.exists()) return;
  const d = snap.data();
  if(d.ownerUid !== currentUser.uid) return;

  const logoHtml = `<img class="p-logo" src="logo.png" onerror="this.style.display='none'">`;

  const rows = (d.items || []).map((it,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${it.name}</td>
      <td>${fmt(it.price)}</td>
      <td>${fmt(it.qty)}</td>
      <td>${fmt(it.total)}</td>
    </tr>
  `).join("");

  $("printArea").innerHTML = `
    <div class="p-head">
      <div class="p-brand">
        ${logoHtml}
        <div>
          <h1>سند لإكسسوارات الأبواب والألمنيوم</h1>
          <div class="meta">فاتورة بيع — A4</div>
        </div>
      </div>
      <div class="meta">
        <div><b>رقم:</b> ${d.invoiceNo}</div>
        <div><b>تاريخ:</b> ${d.date}</div>
        <div><b>العميل:</b> ${d.customerName || "عميل نقدي"}</div>
        <div><b>العملة:</b> SDG</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>الصنف</th>
          <th>السعر</th>
          <th>الكمية</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="sum">
      <div class="sumbox">
        <div><b>الإجمالي:</b> ${fmt(d.total)} SDG</div>
        <div><b>خصم:</b> ${fmt(d.discount)} SDG</div>
        <div><b>مدفوع:</b> ${fmt(d.paid)} SDG</div>
        <div><b>المتبقي:</b> ${fmt(d.due)} SDG</div>
      </div>
    </div>

    <div class="meta" style="margin-top:12px">
      شكراً لتعاملكم مع <b>سند</b>.
    </div>
  `;

  $("printArea").classList.remove("hidden");
  window.print();
  $("printArea").classList.add("hidden");
}

/* ========= End ========= */
