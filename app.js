// ===== البيانات =====
let data = {
  settings: {
    nameAr: 'سند لاكسسوارات الألمنيوم',
    nameEn: 'SANAD',
    locAr: 'الخرطوم بحري',
    locEn: 'Khartoum Bahri',
    phone: '+249913678918',
    currency: 'SDG'
  },
  customers: [
    { id: 1, name: 'عميل نقدي', phone: '-', notes: 'افتراضي' }
  ],
  items: [],
  invoices: [],
  returns: [],
  cart: []
};

// ===== التهيئة =====
document.addEventListener('DOMContentLoaded', function() {
  loadData();
  initNavigation();
  initEventListeners();
  updateUI();
  setDefaultDate();
  updateHomeStats();
});

// ===== التنقل بين الصفحات =====
function initNavigation() {
  const navBtns = document.querySelectorAll('.navBtn');
  const views = document.querySelectorAll('.view');
  
  navBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const viewName = this.dataset.view;
      switchView(viewName);
    });
  });
}

function switchView(viewName) {
  // إخفاء كل الصفحات
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.navBtn').forEach(b => b.classList.remove('active'));
  
  // إظهار الصفحة المطلوبة
  const targetView = document.getElementById('view-' + viewName);
  const targetBtn = document.querySelector('[data-view="' + viewName + '"]');
  
  if (targetView) targetView.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');
  
  // تحديث البيانات حسب الصفحة
  if (viewName === 'invoices') {
    refreshInvoiceForm();
  } else if (viewName === 'home') {
    updateHomeStats();
    loadRecentInvoices();
  } else if (viewName === 'items') {
    loadItemsTable();
  } else if (viewName === 'customers') {
    loadCustomersTable();
  } else if (viewName === 'returns') {
    loadReturnsData();
  } else if (viewName === 'reports') {
    loadReports();
  } else if (viewName === 'settings') {
    loadSettings();
  }
}

// ===== مستمعي الأحداث =====
function initEventListeners() {
  // الفواتير
  document.getElementById('addLineBtn')?.addEventListener('click', addLineToCart);
  document.getElementById('clearCartBtn')?.addEventListener('click', clearCart);
  document.getElementById('saveInvoiceBtn')?.addEventListener('click', saveInvoice);
  document.getElementById('printInvoiceBtn')?.addEventListener('click', printInvoice);
  document.getElementById('invSearch')?.addEventListener('input', searchInvoices);
  
  // البنود
  document.getElementById('addItemBtn')?.addEventListener('click', addItem);
  
  // العملاء
  document.getElementById('addCustomerBtn')?.addEventListener('click', addCustomer);
  
  // المرتجعات
  document.getElementById('addReturnBtn')?.addEventListener('click', addReturn);
  document.getElementById('retInvoice')?.addEventListener('change', onReturnInvoiceChange);
  
  // التقارير
  document.getElementById('runReportBtn')?.addEventListener('click', runReport);
  
  // الإعدادات
  document.getElementById('saveSettingsBtn')?.addEventListener('click', saveSettings);
  document.getElementById('resetBtn')?.addEventListener('click', resetAllData);
}

// ===== الفواتير =====
function refreshInvoiceForm() {
  // تحديث قائمة العملاء
  const custSelect = document.getElementById('invCustomer');
  if (custSelect) {
    custSelect.innerHTML = data.customers.map(c => 
      `<option value="${c.id}">${c.name}</option>`
    ).join('');
  }
  
  // تحديث قائمة البنود
  const itemSelect = document.getElementById('lineItem');
  if (itemSelect) {
    itemSelect.innerHTML = data.items.map(i => 
      `<option value="${i.id}">${i.name} - ${i.sell} ${data.settings.currency}</option>`
    ).join('');
  }
  
  // تحديث جدول السلة
  updateCartTable();
  updateTotals();
  
  // تحديث الفواتير المحفوظة
  loadInvoicesTable();
}

function addLineToCart() {
  const itemId = document.getElementById('lineItem')?.value;
  const qty = parseInt(document.getElementById('lineQty')?.value) || 1;
  const discount = parseFloat(document.getElementById('lineDiscount')?.value) || 0;
  
  if (!itemId) {
    alert('اختر بند أولاً');
    return;
  }
  
  const item = data.items.find(i => i.id == itemId);
  if (!item) return;
  
  if (qty > item.stock) {
    alert('الكمية المطلوبة أكبر من المخزون المتاح: ' + item.stock);
    return;
  }
  
  const line = {
    id: Date.now(),
    itemId: item.id,
    name: item.name,
    price: item.sell,
    qty: qty,
    discount: discount,
    total: (item.sell * qty) - discount,
    cost: item.cost
  };
  
  data.cart.push(line);
  updateCartTable();
  updateTotals();
  
  // إعادة تعيين الكمية والخصم
  document.getElementById('lineQty').value = 1;
  document.getElementById('lineDiscount').value = 0;
}

function updateCartTable() {
  const tbody = document.querySelector('#cartTable tbody');
  if (!tbody) return;
  
  tbody.innerHTML = data.cart.map((line, index) => `
    <tr>
      <td>${line.name}</td>
      <td>${line.price}</td>
      <td>${line.qty}</td>
      <td>${line.discount}</td>
      <td><strong>${line.total}</strong></td>
      <td>
        <button class="iconBtn" onclick="removeCartLine(${index})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function removeCartLine(index) {
  data.cart.splice(index, 1);
  updateCartTable();
  updateTotals();
}

function clearCart() {
  if (data.cart.length === 0) return;
  if (!confirm('تأكيد تفريغ السلة؟')) return;
  
  data.cart = [];
  updateCartTable();
  updateTotals();
}

function updateTotals() {
  const subTotal = data.cart.reduce((sum, line) => sum + (line.price * line.qty), 0);
  const discTotal = data.cart.reduce((sum, line) => sum + line.discount, 0);
  const grandTotal = data.cart.reduce((sum, line) => sum + line.total, 0);
  
  const subEl = document.getElementById('subTotal');
  const discEl = document.getElementById('discTotal');
  const grandEl = document.getElementById('grandTotal');
  
  if (subEl) subEl.textContent = subTotal.toLocaleString() + ' ' + data.settings.currency;
  if (discEl) discEl.textContent = discTotal.toLocaleString() + ' ' + data.settings.currency;
  if (grandEl) grandEl.textContent = grandTotal.toLocaleString() + ' ' + data.settings.currency;
}

function saveInvoice() {
  if (data.cart.length === 0) {
    alert('السلة فارغة! أضف بنود أولاً');
    return;
  }
  
  const customerId = document.getElementById('invCustomer')?.value;
  const date = document.getElementById('invDate')?.value;
  
  if (!date) {
    alert('اختر التاريخ');
    return;
  }
  
  const customer = data.customers.find(c => c.id == customerId);
  
  // حساب الربح
  const profit = data.cart.reduce((sum, line) => 
    sum + ((line.price - line.cost) * line.qty), 0
  );
  
  const invoice = {
    id: Date.now(),
    number: 'INV-' + String(data.invoices.length + 1).padStart(4, '0'),
    customerId: customerId,
    customerName: customer ? customer.name : 'عميل نقدي',
    date: date,
    items: [...data.cart],
    subTotal: data.cart.reduce((sum, line) => sum + (line.price * line.qty), 0),
    discount: data.cart.reduce((sum, line) => sum + line.discount, 0),
    total: data.cart.reduce((sum, line) => sum + line.total, 0),
    profit: profit
  };
  
  // خصم من المخزون
  data.cart.forEach(line => {
    const item = data.items.find(i => i.id == line.itemId);
    if (item) item.stock -= line.qty;
  });
  
  data.invoices.push(invoice);
  data.cart = [];
  
  saveData();
  updateCartTable();
  updateTotals();
  loadInvoicesTable();
  updateHomeStats();
  
  alert('✅ تم حفظ الفاتورة بنجاح!\nرقم الفاتورة: ' + invoice.number);
}

function loadInvoicesTable() {
  const tbody = document.querySelector('#invoicesTable tbody');
  if (!tbody) return;
  
  tbody.innerHTML = data.invoices.slice().reverse().map(inv => `
    <tr>
      <td><strong>${inv.number}</strong></td>
      <td>${inv.customerName}</td>
      <td>${inv.date}</td>
      <td><strong style="color: var(--gold)">${inv.total.toLocaleString()} ${data.settings.currency}</strong></td>
      <td>
        <button class="iconBtn" onclick="viewInvoice(${inv.id})">👁️</button>
        <button class="iconBtn" onclick="printInvoiceById(${inv.id})">🖨️</button>
        <button class="iconBtn" onclick="deleteInvoice(${inv.id})" style="color: #ef4444">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function searchInvoices() {
  const term = document.getElementById('invSearch')?.value.toLowerCase();
  if (!term) {
    loadInvoicesTable();
    return;
  }
  
  const filtered = data.invoices.filter(inv => 
    inv.number.toLowerCase().includes(term) ||
    inv.customerName.toLowerCase().includes(term)
  );
  
  const tbody = document.querySelector('#invoicesTable tbody');
  if (!tbody) return;
  
  tbody.innerHTML = filtered.slice().reverse().map(inv => `
    <tr>
      <td><strong>${inv.number}</strong></td>
      <td>${inv.customerName}</td>
      <td>${inv.date}</td>
      <td><strong style="color: var(--gold)">${inv.total.toLocaleString()} ${data.settings.currency}</strong></td>
      <td>
        <button class="iconBtn" onclick="viewInvoice(${inv.id})">👁️</button>
        <button class="iconBtn" onclick="printInvoiceById(${inv.id})">🖨️</button>
        <button class="iconBtn" onclick="deleteInvoice(${inv.id})" style="color: #ef4444">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function viewInvoice(id) {
  const inv = data.invoices.find(i => i.id === id);
  if (!inv) return;
  
  let itemsHtml = inv.items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td>${item.price}</td>
      <td>${item.qty}</td>
      <td>${item.discount}</td>
      <td>${item.total}</td>
    </tr>
  `).join('');
  
  const html = `
    <div style="padding: 20px;">
      <h2 style="color: var(--gold); margin-bottom: 20px;">فاتورة ${inv.number}</h2>
      <p><strong>العميل:</strong> ${inv.customerName}</p>
      <p><strong>التاريخ:</strong> ${inv.date}</p>
      <hr style="margin: 20px 0; border-color: var(--gold);">
      <table class="tbl" style="width: 100%;">
        <thead>
          <tr>
            <th>البند</th>
            <th>السعر</th>
            <th>الكمية</th>
            <th>الخصم</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div style="margin-top: 20px; text-align: left; font-size: 18px;">
        <p><strong>الإجمالي:</strong> ${inv.subTotal} ${data.settings.currency}</p>
        <p><strong>الخصم:</strong> ${inv.discount} ${data.settings.currency}</p>
        <p style="font-size: 24px; color: var(--gold);"><strong>المبلغ النهائي:</strong> ${inv.total} ${data.settings.currency}</p>
      </div>
    </div>
  `;
  
  // عرض في نافذة منبثقة
  const popup = window.open('', '_blank', 'width=800,height=600');
  popup.document.write(`
    <html dir="rtl">
    <head>
      <title>فاتورة ${inv.number}</title>
      <style>
        body { font-family: Arial; background: #0a0e1a; color: #f8fafc; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; border-bottom: 1px solid #333; text-align: right; }
        th { background: #1e3a8a; color: #d4af37; }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `);
}

function deleteInvoice(id) {
  if (!confirm('حذف الفاتورة نهائياً؟')) return;
  
  const index = data.invoices.findIndex(i => i.id === id);
  if (index > -1) {
    // إرجاع المخزون
    data.invoices[index].items.forEach(line => {
      const item = data.items.find(i => i.id == line.itemId);
      if (item) item.stock += line.qty;
    });
    
    data.invoices.splice(index, 1);
    saveData();
    loadInvoicesTable();
    updateHomeStats();
  }
}

// ===== الطباعة =====
function printInvoice() {
  if (data.cart.length === 0) {
    alert('السلة فارغة!');
    return;
  }
  
  generatePrintContent(data.cart, {
    subTotal: data.cart.reduce((sum, line) => sum + (line.price * line.qty), 0),
    discount: data.cart.reduce((sum, line) => sum + line.discount, 0),
    total: data.cart.reduce((sum, line) => sum + line.total, 0)
  }, 'فاتورة جديدة');
}

function printInvoiceById(id) {
  const inv = data.invoices.find(i => i.id === id);
  if (!inv) return;
  
  generatePrintContent(inv.items, {
    subTotal: inv.subTotal,
    discount: inv.discount,
    total: inv.total
  }, inv.number, inv.customerName, inv.date);
}

function generatePrintContent(items, totals, invNumber, customerName, date) {
  const printArea = document.getElementById('printArea');
  const printContent = document.getElementById('printContent');
  
  const today = date || new Date().toISOString().split('T')[0];
  const custName = customerName || document.getElementById('invCustomer')?.selectedOptions[0]?.text || 'عميل نقدي';
  
  let itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #ddd;">${item.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">${item.price}</td>
      <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">${item.qty}</td>
      <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">${item.discount}</td>
      <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: left;"><strong>${item.total}</strong></td>
    </tr>
  `).join('');
  
  printContent.innerHTML = `
    <div style="font-family: Arial; max-width: 800px; margin: 0 auto;">
      <!-- Header -->
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 3px solid #1e3a8a; margin-bottom: 30px;">
        <h1 style="color: #1e3a8a; font-size: 32px; margin: 0;">${data.settings.nameAr}</h1>
        <h2 style="color: #d4af37; font-size: 20px; margin: 10px 0;">${data.settings.nameEn}</h2>
        <p style="color: #666; margin: 5px 0;">
          📍 ${data.settings.locAr} | ${data.settings.locEn}<br>
          📞 ${data.settings.phone}
        </p>
      </div>
      
      <!-- Invoice Info -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 10px;">
        <div>
          <p><strong>رقم الفاتورة:</strong> ${invNumber}</p>
          <p><strong>التاريخ:</strong> ${today}</p>
        </div>
        <div style="text-align: left;">
          <p><strong>العميل:</strong> ${custName}</p>
        </div>
      </div>
      
      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background: #1e3a8a; color: white;">
            <th style="padding: 15px; text-align: right;">البند</th>
            <th style="padding: 15px; text-align: center;">السعر</th>
            <th style="padding: 15px; text-align: center;">الكمية</th>
            <th style="padding: 15px; text-align: center;">الخصم</th>
            <th style="padding: 15px; text-align: left;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      
      <!-- Totals -->
      <div style="width: 300px; margin-right: auto; margin-left: 0; background: #f8f9fa; padding: 20px; border-radius: 10px; border: 2px solid #d4af37;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span>الإجمالي:</span>
          <span>${totals.subTotal} ${data.settings.currency}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span>الخصم:</span>
          <span>${totals.discount} ${data.settings.currency}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; color: #1e3a8a; border-top: 2px solid #d4af37; padding-top: 10px; margin-top: 10px;">
          <span>المبلغ النهائي:</span>
          <span>${totals.total} ${data.settings.currency}</span>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
        <p>شكراً لتعاملكم معنا</p>
        <p style="font-size: 12px; margin-top: 10px;">${data.settings.nameAr} - ${data.settings.phone}</p>
      </div>
    </div>
  `;
  
  // فتح نافذة الطباعة
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html dir="rtl">
    <head>
      <title>فاتورة ${invNumber}</title>
      <style>
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 20px; background: white;">
      ${printContent.innerHTML}
      <script>
        window.onload = function() { window.print(); }
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ===== البنود =====
function addItem() {
  const name = document.getElementById('itemName')?.value.trim();
  const sell = parseFloat(document.getElementById('itemSell')?.value) || 0;
  const cost = parseFloat(document.getElementById('itemCost')?.value) || 0;
  const stock = parseInt(document.getElementById('itemStock')?.value) || 0;
  
  if (!name) {
    alert('أدخل اسم البند');
    return;
  }
  
  if (sell <= 0) {
    alert('أدخل سعر البيع');
    return;
  }
  
  const item = {
    id: Date.now(),
    name: name,
    sell: sell,
    cost: cost,
    stock: stock
  };
  
  data.items.push(item);
  saveData();
  
  // إعادة تعيين الحقول
  document.getElementById('itemName').value = '';
  document.getElementById('itemSell').value = 0;
  document.getElementById('itemCost').value = 0;
  document.getElementById('itemStock').value = 0;
  
  loadItemsTable();
  alert('✅ تم إضافة البند بنجاح');
}

function loadItemsTable() {
  const tbody = document.querySelector('#itemsTable tbody');
  if (!tbody) return;
  
  tbody.innerHTML = data.items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td style="color: var(--gold); font-weight: bold;">${item.sell} ${data.settings.currency}</td>
      <td>${item.stock}</td>
      <td>
        <button class="iconBtn" onclick="deleteItem(${item.id})" style="color: #ef4444">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function deleteItem(id) {
  if (!confirm('حذف البند؟')) return;
  
  const index = data.items.findIndex(i => i.id === id);
  if (index > -1) {
    data.items.splice(index, 1);
    saveData();
    loadItemsTable();
  }
}

// ===== العملاء =====
function addCustomer() {
  const name = document.getElementById('custName')?.value.trim();
  const phone = document.getElementById('custPhone')?.value.trim();
  const notes = document.getElementById('custNotes')?.value.trim();
  
  if (!name) {
    alert('أدخل اسم العميل');
    return;
  }
  
  const customer = {
    id: Date.now(),
    name: name,
    phone: phone || '-',
    notes: notes || ''
  };
  
  data.customers.push(customer);
  saveData();
  
  document.getElementById('custName').value = '';
  document.getElementById('custPhone').value = '';
  document.getElementById('custNotes').value = '';
  
  loadCustomersTable();
  alert('✅ تم إضافة العميل بنجاح');
}

function loadCustomersTable() {
  const tbody = document.querySelector('#customersTable tbody');
  if (!tbody) return;
  
  tbody.innerHTML = data.customers.filter(c => c.id !== 1).map(c => `
    <tr>
      <td>${c.name}</td>
      <td>${c.phone}</td>
      <td>
        <button class="iconBtn" onclick="deleteCustomer(${c.id})" style="color: #ef4444">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function deleteCustomer(id) {
  if (!confirm('حذف العميل؟')) return;
  
  const index = data.customers.findIndex(c => c.id === id);
  if (index > -1) {
    data.customers.splice(index, 1);
    saveData();
    loadCustomersTable();
  }
}

// ===== المرتجعات =====
function loadReturnsData() {
  const invSelect = document.getElementById('retInvoice');
  if (invSelect) {
    invSelect.innerHTML = data.invoices.map(inv => 
      `<option value="${inv.id}">${inv.number} - ${inv.customerName}</option>`
    ).join('');
  }
  
  onReturnInvoiceChange();
  loadReturnsTa
