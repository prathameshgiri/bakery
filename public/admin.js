// ============================================================
// SHIV BAKERY — ADMIN MANAGEMENT SYSTEM
// Frontend Application Logic
// ============================================================

const API = '';

// ====== STATE ======
let currentPage = 'dashboard';
let currentOrderFilter = 'all';
let currentCategoryFilter = 'all';
let currentMessageFilter = 'all';
let orderItems = [];
let allProducts = [];
let allCustomers = [];
let editingProductId = null;
let authToken = localStorage.getItem('bakery_admin_token') || '';
let eventSource = null;
let latestNewOrder = null;

// ====== AUTH HELPERS ======
function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };
}

function authFetch(url, options = {}) {
    options.headers = { ...options.headers, 'Authorization': `Bearer ${authToken}` };
    return fetch(url, options);
}

// ====== INITIALIZATION ======
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

// ====== AUTH ======
async function checkAuth() {
    if (!authToken) {
        showLoginScreen();
        return;
    }

    try {
        const res = await fetch(`${API}/api/auth/verify`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.valid) {
            hideLoginScreen();
            initApp();
        } else {
            showLoginScreen();
        }
    } catch {
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById('login-overlay').classList.remove('hidden');
}

function hideLoginScreen() {
    document.getElementById('login-overlay').classList.add('hidden');
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    btn.textContent = '⏳ Signing in...';
    btn.disabled = true;
    errorEl.style.display = 'none';

    try {
        const res = await fetch(`${API}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (data.success) {
            authToken = data.token;
            localStorage.setItem('bakery_admin_token', authToken);
            hideLoginScreen();
            initApp();
        } else {
            errorEl.style.display = 'block';
            errorEl.querySelector('span').textContent = '❌ ' + (data.message || 'Invalid credentials');
        }
    } catch {
        errorEl.style.display = 'block';
        errorEl.querySelector('span').textContent = '❌ Connection error. Please try again.';
    }

    btn.textContent = '🔐 Sign In';
    btn.disabled = false;
}

function logout() {
    authToken = '';
    localStorage.removeItem('bakery_admin_token');
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    showLoginScreen();
}

function initApp() {
    setupNavigation();
    setupEventListeners();
    setCurrentDate();
    loadDashboard();
    setupSSE();
    updateMessagesBadge();
}

// ====== SERVER-SENT EVENTS (Real-Time) ======
function setupSSE() {
    if (eventSource) eventSource.close();

    eventSource = new EventSource(`${API}/api/events`);

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'connected':
                    console.log('🔗 Real-time connected');
                    break;

                case 'new_order':
                    latestNewOrder = data.data;
                    showRealtimeBanner(`🆕 New order #${data.data.id} from ${data.data.customerName} — ₹${data.data.total}`);
                    playNotificationSound();
                    // Auto-refresh if on orders or dashboard page
                    if (currentPage === 'orders') loadOrders();
                    if (currentPage === 'dashboard') loadDashboard();
                    break;

                case 'order_updated':
                case 'order_status_changed':
                    showRealtimeBanner(`📋 Order #${data.data.id} → ${formatStatus(data.data.status)}`);
                    if (currentPage === 'orders') loadOrders();
                    if (currentPage === 'dashboard') loadDashboard();
                    break;

                case 'order_deleted':
                    if (currentPage === 'orders') loadOrders();
                    if (currentPage === 'dashboard') loadDashboard();
                    break;

                case 'product_added':
                    if (currentPage === 'products') loadProducts();
                    break;

                case 'new_message':
                    showRealtimeBanner(`✉️ New message from ${data.data.name}`);
                    playNotificationSound();
                    if (currentPage === 'messages') loadMessages();
                    updateMessagesBadge();
                    break;
            }
        } catch (err) {
            console.error('SSE parse error:', err);
        }
    };

    eventSource.onerror = () => {
        console.warn('SSE connection lost, reconnecting...');
    };
}

function showRealtimeBanner(message) {
    const banner = document.getElementById('realtime-banner');
    document.getElementById('realtime-text').textContent = message;
    banner.style.display = 'flex';

    // Auto-hide after 8 seconds
    clearTimeout(banner._timeout);
    banner._timeout = setTimeout(() => {
        banner.style.display = 'none';
    }, 8000);
}

function closeRealtimeBanner() {
    document.getElementById('realtime-banner').style.display = 'none';
}

function viewNewOrder() {
    closeRealtimeBanner();
    if (latestNewOrder) {
        navigateTo('orders');
        setTimeout(() => viewOrderDetail(latestNewOrder.id), 300);
    }
}

function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    } catch { }
}

// ====== NAVIGATION ======
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
}

function navigateTo(page) {
    currentPage = page;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');

    // Update title
    const titles = {
        dashboard: { title: 'Dashboard', subtitle: 'Overview of your bakery operations' },
        orders: { title: 'Orders', subtitle: 'Manage and track all customer orders' },
        products: { title: 'Products', subtitle: 'Manage your bakery catalog' },
        customers: { title: 'Customers', subtitle: 'View and manage customer information' },
        messages: { title: 'Messages', subtitle: 'Contact form submissions from customers' }
    };

    document.getElementById('page-title').textContent = titles[page].title;
    document.getElementById('page-subtitle').textContent = titles[page].subtitle;

    // Load page data
    switch (page) {
        case 'dashboard': loadDashboard(); break;
        case 'orders': loadOrders(); break;
        case 'products': loadProducts(); break;
        case 'customers': loadCustomers(); break;
        case 'messages': loadMessages(); break;
    }

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
}

// ====== EVENT LISTENERS ======
function setupEventListeners() {
    // Mobile menu toggle
    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Order status filters
    document.getElementById('order-status-filters').addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-tab')) {
            document.querySelectorAll('#order-status-filters .filter-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentOrderFilter = e.target.dataset.status;
            loadOrders();
        }
    });

    // Product category filters
    document.getElementById('product-category-filters').addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-tab')) {
            document.querySelectorAll('#product-category-filters .filter-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentCategoryFilter = e.target.dataset.category;
            loadProducts();
        }
    });

    // Product select in order modal
    document.getElementById('product-select').addEventListener('change', (e) => {
        const productId = parseInt(e.target.value);
        if (!productId) return;
        addOrderItem(productId);
        e.target.value = '';
    });

    // Customer search
    document.getElementById('customer-search').addEventListener('input', debounce((e) => {
        loadCustomers(e.target.value);
    }, 300));

    // Global search
    document.getElementById('global-search').addEventListener('input', debounce((e) => {
        handleGlobalSearch(e.target.value);
    }, 300));

    // Close modal on overlay click
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'modal-overlay') closeModal();
    });

    // Messages filter tabs
    document.getElementById('messages-filter-tabs').addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-tab')) {
            document.querySelectorAll('#messages-filter-tabs .filter-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentMessageFilter = e.target.dataset.filter;
            loadMessages();
        }
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

function setCurrentDate() {
    const now = new Date();
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', options);
}

// ====== DASHBOARD ======
async function loadDashboard() {
    try {
        const [stats, revenueHistory, topProducts, recentOrders] = await Promise.all([
            authFetch(`${API}/api/dashboard/stats`).then(r => r.json()),
            authFetch(`${API}/api/dashboard/revenue-history`).then(r => r.json()),
            authFetch(`${API}/api/dashboard/top-products`).then(r => r.json()),
            authFetch(`${API}/api/dashboard/recent-orders`).then(r => r.json())
        ]);

        // Animate stat values
        animateValue('stat-revenue', `₹${Number(stats.totalRevenue).toLocaleString('en-IN')}`);
        animateValue('stat-orders', stats.totalOrders);
        animateValue('stat-pending', stats.pendingOrders);
        animateValue('stat-customers', stats.totalCustomers);

        // Update pending badge
        document.getElementById('pending-badge').textContent = stats.pendingOrders;

        // Status distribution bars
        const total = stats.totalOrders || 1;
        updateStatusBar('pending', stats.pendingOrders, total);
        updateStatusBar('in-progress', stats.inProgressOrders, total);
        updateStatusBar('ready', stats.readyOrders, total);
        updateStatusBar('delivered', stats.deliveredOrders, total);

        // Revenue chart
        renderRevenueChart(revenueHistory);

        // Top products
        renderTopProducts(topProducts);

        // Recent orders
        renderRecentOrders(recentOrders);

    } catch (error) {
        console.error('Dashboard load error:', error);
        showToast('Failed to load dashboard data', 'error');
    }
}

function animateValue(elementId, endValue) {
    const el = document.getElementById(elementId);
    el.textContent = endValue;
    el.style.animation = 'none';
    el.offsetHeight; // force reflow
    el.style.animation = 'fadeIn 0.5s ease';
}

function updateStatusBar(status, count, total) {
    const percentage = Math.round((count / total) * 100);
    const barId = status === 'in-progress' ? 'bar-in-progress' : `bar-${status}`;
    const countId = status === 'in-progress' ? 'count-in-progress' : `count-${status}`;

    setTimeout(() => {
        document.getElementById(barId).style.width = `${percentage}%`;
        document.getElementById(countId).textContent = count;
    }, 200);
}

function renderRevenueChart(data) {
    const container = document.getElementById('revenue-chart');
    const maxRevenue = Math.max(...data.map(d => d.revenue));

    container.innerHTML = data.map((d, i) => {
        const height = (d.revenue / maxRevenue) * 180;
        return `
      <div class="chart-bar-group" style="animation-delay: ${i * 0.1}s">
        <div class="chart-bar-wrapper">
          <div class="chart-bar" style="height: ${height}px; animation: growBar 0.8s ease ${i * 0.1}s both;" data-value="₹${d.revenue.toLocaleString('en-IN')}"></div>
        </div>
        <span class="chart-label">${d.month}</span>
      </div>
    `;
    }).join('');

    // Add grow animation
    const style = document.createElement('style');
    style.textContent = `
    @keyframes growBar {
      from { height: 0; }
    }
  `;
    document.head.appendChild(style);
}

function renderTopProducts(products) {
    const container = document.getElementById('top-products-list');
    container.innerHTML = products.map(p => `
    <div class="top-product-item">
      <span class="top-product-icon">${p.image}</span>
      <div class="top-product-info">
        <div class="top-product-name">${p.name}</div>
        <div class="top-product-sales">${p.totalSold} sold</div>
      </div>
      <span class="top-product-revenue">₹${p.totalRevenue.toLocaleString('en-IN')}</span>
    </div>
  `).join('');
}

function renderRecentOrders(orders) {
    const tbody = document.getElementById('recent-orders-body');
    tbody.innerHTML = orders.map(order => `
    <tr onclick="viewOrderDetail(${order.id})" style="cursor:pointer">
      <td><span class="order-id">#${order.id}</span></td>
      <td>${order.customerName}</td>
      <td>${order.items.map(i => `${i.image} ${i.name}`).join(', ')}</td>
      <td>₹${order.total.toLocaleString('en-IN')}</td>
      <td><span class="status-badge ${order.status}">${formatStatus(order.status)}</span></td>
    </tr>
  `).join('');
}

// ====== ORDERS ======
async function loadOrders() {
    try {
        const params = new URLSearchParams();
        if (currentOrderFilter !== 'all') params.set('status', currentOrderFilter);

        const orders = await fetch(`${API}/api/orders?${params}`).then(r => r.json());
        const grid = document.getElementById('orders-grid');

        if (orders.length === 0) {
            grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">No orders found</div>
          <div class="empty-state-sub">Try a different filter or create a new order</div>
        </div>
      `;
            return;
        }

        grid.innerHTML = orders.map((order, i) => `
      <div class="order-card status-${order.status}" style="animation-delay: ${i * 0.05}s" onclick="viewOrderDetail(${order.id})">
        <div class="order-card-header">
          <div>
            <div class="order-card-id">#${order.id}</div>
            <div class="order-card-time">${formatTime(order.createdAt)}</div>
          </div>
          <span class="status-badge ${order.status}">${formatStatus(order.status)}</span>
        </div>
        <div class="order-card-customer">
          <span class="customer-avatar">${getInitials(order.customerName)}</span>
          <span class="customer-name">${order.customerName}</span>
        </div>
        <div class="order-card-items">
          ${order.items.map(item => `
            <span class="order-item-chip">${item.image} ${item.name} ×${item.quantity}</span>
          `).join('')}
        </div>
        ${order.notes ? `<p style="font-size:0.78rem;color:var(--text-muted);font-style:italic;margin-bottom:12px;">📝 ${order.notes}</p>` : ''}
        <div class="order-card-footer">
          <span class="order-total">₹${order.total.toLocaleString('en-IN')}</span>
          <div class="order-actions" onclick="event.stopPropagation()">
            ${getStatusActions(order)}
          </div>
        </div>
      </div>
    `).join('');

    } catch (error) {
        console.error('Orders load error:', error);
        showToast('Failed to load orders', 'error');
    }
}

function getStatusActions(order) {
    const nextStatus = {
        'pending': 'in-progress',
        'in-progress': 'ready',
        'ready': 'delivered'
    };

    const labels = {
        'in-progress': '🔥 Start',
        'ready': '✅ Ready',
        'delivered': '📦 Deliver'
    };

    const next = nextStatus[order.status];
    if (!next) return '';

    return `<button class="btn-status" onclick="updateOrderStatus(${order.id}, '${next}')">${labels[next]}</button>`;
}

async function updateOrderStatus(orderId, status) {
    try {
        await authFetch(`${API}/api/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ status })
        });

        showToast(`Order #${orderId} → ${formatStatus(status)}`, 'success');
        loadOrders();

        // Update pending badge
        const stats = await authFetch(`${API}/api/dashboard/stats`).then(r => r.json());
        document.getElementById('pending-badge').textContent = stats.pendingOrders;

    } catch (error) {
        showToast('Failed to update order status', 'error');
    }
}

async function viewOrderDetail(orderId) {
    try {
        const order = await authFetch(`${API}/api/orders/${orderId}`).then(r => r.json());

        document.getElementById('detail-order-title').textContent = `Order #${order.id}`;

        const body = document.getElementById('order-detail-body');
        body.innerHTML = `
      <div class="detail-section">
        <h4>Order Information</h4>
        <div class="detail-row"><span class="label">Customer</span><span class="value">${order.customerName}</span></div>
        <div class="detail-row"><span class="label">Date</span><span class="value">${formatDateTime(order.createdAt)}</span></div>
        <div class="detail-row"><span class="label">Payment</span><span class="value" style="text-transform:capitalize">${order.paymentMethod}</span></div>
        <div class="detail-row"><span class="label">Status</span><span class="value"><span class="status-badge ${order.status}">${formatStatus(order.status)}</span></span></div>
      </div>

      <div class="detail-section">
        <h4>Items</h4>
        <div class="detail-items-list">
          ${order.items.map(item => `
            <div class="detail-item">
              <span class="detail-item-emoji">${item.image}</span>
              <div class="detail-item-info">
                <div class="detail-item-name">${item.name}</div>
                <div class="detail-item-meta">₹${item.price} × ${item.quantity}</div>
              </div>
              <span class="detail-item-total">₹${(item.price * item.quantity).toLocaleString('en-IN')}</span>
            </div>
          `).join('')}
        </div>
        <div class="detail-row" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-subtle)">
          <span class="label" style="font-weight:700;font-size:0.95rem">Total</span>
          <span class="value" style="font-weight:800;font-size:1.1rem;color:var(--accent-primary)">₹${order.total.toLocaleString('en-IN')}</span>
        </div>
      </div>

      ${order.notes ? `
        <div class="detail-section">
          <h4>Notes</h4>
          <div class="detail-notes">${order.notes}</div>
        </div>
      ` : ''}

      <div class="detail-section">
        <h4>Update Status</h4>
        <div class="detail-status-actions">
          ${['pending', 'in-progress', 'ready', 'delivered', 'cancelled'].map(s => `
            <button class="detail-status-btn ${s === order.status ? 'active-status' : ''}" 
              onclick="updateOrderStatusFromDetail(${order.id}, '${s}')">${formatStatus(s)}</button>
          `).join('')}
        </div>
      </div>
    `;

        openModal('modal-order-detail');
    } catch (error) {
        showToast('Failed to load order details', 'error');
    }
}

async function updateOrderStatusFromDetail(orderId, status) {
    await updateOrderStatus(orderId, status);
    viewOrderDetail(orderId);
}

// ====== NEW ORDER ======
async function openNewOrderModal() {
    orderItems = [];
    updateOrderItemsUI();

    // Load customers
    const customers = await fetch(`${API}/api/customers`).then(r => r.json());
    const select = document.getElementById('order-customer');
    select.innerHTML = '<option value="">Select customer...</option>' +
        customers.map(c => `<option value="${c.id}" data-name="${c.name}">${c.name}</option>`).join('');

    // Load products
    allProducts = await fetch(`${API}/api/products`).then(r => r.json());
    const productSelect = document.getElementById('product-select');
    productSelect.innerHTML = '<option value="">Add a product...</option>' +
        allProducts.map(p => `<option value="${p.id}">${p.image} ${p.name} — ₹${p.price}</option>`).join('');

    document.getElementById('order-notes').value = '';
    document.querySelector('input[name="payment"][value="cash"]').checked = true;

    openModal('modal-new-order');
}

function addOrderItem(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const existing = orderItems.find(i => i.productId === productId);
    if (existing) {
        existing.quantity++;
    } else {
        orderItems.push({
            productId: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: 1
        });
    }

    updateOrderItemsUI();
}

function removeOrderItem(productId) {
    orderItems = orderItems.filter(i => i.productId !== productId);
    updateOrderItemsUI();
}

function changeItemQty(productId, delta) {
    const item = orderItems.find(i => i.productId === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        removeOrderItem(productId);
        return;
    }

    updateOrderItemsUI();
}

function updateOrderItemsUI() {
    const container = document.getElementById('order-items-list');
    const totalEl = document.getElementById('order-total-value');

    container.innerHTML = orderItems.map(item => `
    <div class="order-item-row">
      <span class="order-item-emoji">${item.image}</span>
      <span class="order-item-name">${item.name}</span>
      <span class="order-item-price">₹${item.price}</span>
      <div class="order-item-qty">
        <button class="qty-btn" onclick="changeItemQty(${item.productId}, -1)">−</button>
        <span class="qty-value">${item.quantity}</span>
        <button class="qty-btn" onclick="changeItemQty(${item.productId}, 1)">+</button>
      </div>
      <button class="order-item-remove" onclick="removeOrderItem(${item.productId})">×</button>
    </div>
  `).join('');

    const total = orderItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    totalEl.textContent = `₹${total.toLocaleString('en-IN')}`;
}

async function submitOrder() {
    const customerSelect = document.getElementById('order-customer');
    const selectedOption = customerSelect.options[customerSelect.selectedIndex];
    const customerName = selectedOption.dataset?.name || selectedOption.text;
    const customerId = customerSelect.value ? parseInt(customerSelect.value) : null;
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    const notes = document.getElementById('order-notes').value;

    if (!customerSelect.value) {
        showToast('Please select a customer', 'error');
        return;
    }

    if (orderItems.length === 0) {
        showToast('Please add at least one item', 'error');
        return;
    }

    try {
        const res = await authFetch(`${API}/api/orders`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ customerId, customerName, items: orderItems, paymentMethod, notes })
        });

        const order = await res.json();
        if (res.ok) {
            showToast(`Order #${order.id} created successfully!`, 'success');
            closeModal();
            loadOrders();
        } else {
            showToast(order.error || 'Failed to create order', 'error');
        }
    } catch (error) {
        showToast('Failed to create order', 'error');
    }
}

// ====== PRODUCTS ======
async function loadProducts() {
    try {
        const params = new URLSearchParams();
        if (currentCategoryFilter !== 'all') params.set('category', currentCategoryFilter);

        const products = await fetch(`${API}/api/products?${params}`).then(r => r.json());
        allProducts = products;
        const grid = document.getElementById('products-grid');

        if (products.length === 0) {
            grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🍩</div>
          <div class="empty-state-text">No products found</div>
          <div class="empty-state-sub">Try a different category or add a new product</div>
        </div>
      `;
            return;
        }

        grid.innerHTML = products.map((product, i) => {
            const stockPercent = Math.min(100, (product.stock / 60) * 100);
            const stockLevel = product.stock > 20 ? 'high' : product.stock > 10 ? 'medium' : 'low';
            const profit = product.price - product.cost;

            return `
        <div class="product-card" style="animation-delay: ${i * 0.05}s">
          <span class="product-emoji">${product.image}</span>
          <div class="product-name">${product.name}</div>
          <div class="product-category">${product.category}</div>
          <div class="product-price">₹${product.price}</div>
          <div class="product-meta">
            <div class="product-meta-item">Stock: <span>${product.stock}</span></div>
            <div class="product-meta-item">Profit: <span>₹${profit}</span></div>
          </div>
          <div class="product-stock-bar">
            <div class="product-stock-fill ${stockLevel}" style="width: ${stockPercent}%"></div>
          </div>
          <div class="product-actions">
            <button class="btn btn-ghost btn-sm" onclick="editProduct(${product.id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteProduct(${product.id})">Delete</button>
          </div>
        </div>
      `;
        }).join('');

    } catch (error) {
        console.error('Products load error:', error);
        showToast('Failed to load products', 'error');
    }
}

function openNewProductModal() {
    editingProductId = null;
    document.getElementById('product-modal-title').textContent = 'Add New Product';
    document.getElementById('btn-submit-product').textContent = 'Add Product';
    document.getElementById('product-name').value = '';
    document.getElementById('product-image').value = '';
    document.getElementById('product-category').value = 'Breads';
    document.getElementById('product-stock').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-cost').value = '';
    document.getElementById('product-description').value = '';
    openModal('modal-new-product');
}

async function editProduct(id) {
    try {
        const product = await fetch(`${API}/api/products/${id}`).then(r => r.json());
        editingProductId = id;
        document.getElementById('product-modal-title').textContent = 'Edit Product';
        document.getElementById('btn-submit-product').textContent = 'Save Changes';
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-image').value = product.image;
        document.getElementById('product-category').value = product.category;
        document.getElementById('product-stock').value = product.stock;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-cost').value = product.cost;
        document.getElementById('product-description').value = product.description;
        openModal('modal-new-product');
    } catch {
        showToast('Failed to load product', 'error');
    }
}

async function submitProduct() {
    const data = {
        name: document.getElementById('product-name').value,
        image: document.getElementById('product-image').value || '🍩',
        category: document.getElementById('product-category').value,
        stock: document.getElementById('product-stock').value,
        price: document.getElementById('product-price').value,
        cost: document.getElementById('product-cost').value,
        description: document.getElementById('product-description').value
    };

    if (!data.name || !data.price) {
        showToast('Name and price are required', 'error');
        return;
    }

    try {
        const url = editingProductId
            ? `${API}/api/products/${editingProductId}`
            : `${API}/api/products`;

        const res = await authFetch(url, {
            method: editingProductId ? 'PUT' : 'POST',
            headers: authHeaders(),
            body: JSON.stringify(data)
        });

        if (res.ok) {
            showToast(editingProductId ? 'Product updated!' : 'Product added!', 'success');
            closeModal();
            loadProducts();
        } else {
            const err = await res.json();
            showToast(err.error || 'Failed to save product', 'error');
        }
    } catch {
        showToast('Failed to save product', 'error');
    }
}

async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
        await authFetch(`${API}/api/products/${id}`, { method: 'DELETE', headers: authHeaders() });
        showToast('Product deleted', 'success');
        loadProducts();
    } catch {
        showToast('Failed to delete product', 'error');
    }
}

// ====== CUSTOMERS ======
async function loadCustomers(search = '') {
    try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);

        const customers = await fetch(`${API}/api/customers?${params}`).then(r => r.json());
        allCustomers = customers;
        const tbody = document.getElementById('customers-body');

        if (customers.length === 0) {
            tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:40px;">
            <div class="empty-state-icon">👥</div>
            <div class="empty-state-text">No customers found</div>
          </td>
        </tr>
      `;
            return;
        }

        tbody.innerHTML = customers.map(customer => `
      <tr>
        <td>
          <div class="customer-cell">
            <span class="customer-avatar">${getInitials(customer.name)}</span>
            <span>${customer.name}</span>
          </div>
        </td>
        <td>${customer.email}</td>
        <td>${customer.phone}</td>
        <td>${customer.totalOrders}</td>
        <td style="color:var(--accent-primary);font-weight:600">₹${customer.totalSpent.toLocaleString('en-IN')}</td>
        <td>${customer.createdAt}</td>
      </tr>
    `).join('');

    } catch (error) {
        console.error('Customers load error:', error);
        showToast('Failed to load customers', 'error');
    }
}

function openNewCustomerModal() {
    document.getElementById('customer-name').value = '';
    document.getElementById('customer-email').value = '';
    document.getElementById('customer-phone').value = '';
    openModal('modal-new-customer');
}

async function submitCustomer() {
    const data = {
        name: document.getElementById('customer-name').value,
        email: document.getElementById('customer-email').value,
        phone: document.getElementById('customer-phone').value
    };

    if (!data.name) {
        showToast('Customer name is required', 'error');
        return;
    }

    try {
        const res = await fetch(`${API}/api/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            showToast('Customer added successfully!', 'success');
            closeModal();
            loadCustomers();
        } else {
            const err = await res.json();
            showToast(err.error || 'Failed to add customer', 'error');
        }
    } catch {
        showToast('Failed to add customer', 'error');
    }
}

// ====== MESSAGES ======
async function loadMessages() {
    try {
        const messages = await authFetch(`${API}/api/messages`).then(r => r.json());

        let filtered = messages;
        if (currentMessageFilter === 'unread') filtered = messages.filter(m => !m.read);
        if (currentMessageFilter === 'read') filtered = messages.filter(m => m.read);

        const container = document.getElementById('messages-list');

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✉️</div>
                    <div class="empty-state-text">No messages found</div>
                    <div class="empty-state-sub">${currentMessageFilter === 'all' ? 'No contact form submissions yet' : `No ${currentMessageFilter} messages`}</div>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map((msg, i) => `
            <div class="message-card ${msg.read ? 'read' : 'unread'}" style="animation-delay: ${i * 0.05}s">
                <div class="message-card-header">
                    <div class="message-sender">
                        <span class="message-avatar">${getInitials(msg.name)}</span>
                        <div>
                            <div class="message-name">${msg.name}</div>
                            <div class="message-email">${msg.email}</div>
                        </div>
                    </div>
                    <div class="message-meta">
                        ${!msg.read ? '<span class="message-unread-dot"></span>' : ''}
                        <span class="message-time">${formatDateTime(msg.createdAt)}</span>
                    </div>
                </div>
                <div class="message-body">${msg.message}</div>
                <div class="message-actions">
                    ${!msg.read ? `<button class="btn btn-ghost btn-sm" onclick="markMessageRead(${msg.id})">✓ Mark Read</button>` : '<span class="message-read-label">✓ Read</span>'}
                    <button class="btn btn-danger btn-sm" onclick="deleteMessage(${msg.id})">Delete</button>
                </div>
            </div>
        `).join('');

        updateMessagesBadge();
    } catch (error) {
        console.error('Messages load error:', error);
        showToast('Failed to load messages', 'error');
    }
}

async function updateMessagesBadge() {
    try {
        const messages = await authFetch(`${API}/api/messages`).then(r => r.json());
        const unread = messages.filter(m => !m.read).length;
        const badge = document.getElementById('messages-badge');
        if (unread > 0) {
            badge.textContent = unread;
            badge.style.display = '';
        } else {
            badge.style.display = 'none';
        }
    } catch { }
}

async function markMessageRead(id) {
    try {
        await authFetch(`${API}/api/messages/${id}/read`, {
            method: 'PATCH',
            headers: authHeaders()
        });
        showToast('Message marked as read', 'success');
        loadMessages();
    } catch {
        showToast('Failed to update message', 'error');
    }
}

async function deleteMessage(id) {
    if (!confirm('Delete this message?')) return;
    try {
        await authFetch(`${API}/api/messages/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        showToast('Message deleted', 'success');
        loadMessages();
    } catch {
        showToast('Failed to delete message', 'error');
    }
}

// ====== GLOBAL SEARCH ======
function handleGlobalSearch(query) {
    if (!query) return;
    // Navigate to orders and search there
    if (/^\d+$/.test(query)) {
        navigateTo('orders');
    }
}

// ====== MODAL MANAGEMENT ======
function openModal(modalId) {
    const overlay = document.getElementById('modal-overlay');
    // Hide all modals first
    overlay.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    // Show target modal
    document.getElementById(modalId).style.display = 'block';
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.body.style.overflow = '';
}

// ====== TOAST NOTIFICATIONS ======
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span>${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

    container.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'toastSlideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ====== UTILITY FUNCTIONS ======
function formatStatus(status) {
    return status.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
    });
}

function getInitials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}
