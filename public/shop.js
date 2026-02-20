// ============================================================
// SHIV BAKERY — BAKERY SHOP
// Frontend Application Logic
// ============================================================

const API = '';

// Product images mapped by product name (LOCAL PATHS)
const PRODUCT_IMAGES = {
    'Sourdough Bread': 'images/SourdoughBread.jpg',
    'Chocolate Croissant': 'images/ChocolateCroissant.jpg',
    'Red Velvet Cake': 'images/RedVelvetCake.jpg',
    'Blueberry Muffin': 'images/BlueberryMuffin.jpg',
    'Cinnamon Roll': 'images/CinnamonRoll.jpg',
    'Baguette': 'images/Baguette.jpg',
    'Tiramisu': 'images/Tiramisu.jpg',
    'Chocolate Chip Cookie': 'images/ChocolateChipCookies.jpg',
    'Whole Wheat Loaf': 'images/bread.jpg',
    'Strawberry Tart': 'images/StrawberryTart.jpg',
    'Macarons (6pc)': 'images/Macarons.jpg',
    'Birthday Cake': 'images/BirthdayCake.jpg',
};

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1486427944544-d2c246c4df4d?w=500&q=80';

// ====== STATE ======
let cart = [];
let allProducts = [];
let currentFilter = 'all';
let userToken = localStorage.getItem('bakery_user_token') || '';
let currentUser = null;

// ====== INIT ======
document.addEventListener('DOMContentLoaded', () => {
    setupNavbar();
    setupFilters();
    setupScrollAnimations();
    loadProducts();
    loadCartFromStorage();
    checkUserSession();
    setupDropdownClose();
});

// ====== NAVBAR ======
function setupNavbar() {
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (window.scrollY > 60) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Update active nav link based on scroll position
        updateActiveNavLink();
    });
}

function updateActiveNavLink() {
    const sections = ['hero', 'products', 'about', 'contact'];
    const scrollPos = window.scrollY + 200;

    sections.forEach(id => {
        const section = document.getElementById(id);
        if (!section) return;
        const top = section.offsetTop;
        const bottom = top + section.offsetHeight;

        const link = document.querySelector(`.nav-link[data-section="${id}"]`);
        if (link) {
            if (scrollPos >= top && scrollPos < bottom) {
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        }
    });
}

function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
    }
    // Close mobile menu
    document.getElementById('nav-links').classList.remove('active');
    document.getElementById('mobile-menu-btn').classList.remove('active');

    if (id === 'products') {
        // Reset filter to show all
        currentFilter = 'all';
        document.querySelectorAll('.product-filter').forEach(f => {
            f.classList.toggle('active', f.dataset.cat === 'all');
        });
        loadProducts();
    }
}

function toggleMobileMenu() {
    document.getElementById('nav-links').classList.toggle('active');
    document.getElementById('mobile-menu-btn').classList.toggle('active');
}

// ====== FILTERS ======
function setupFilters() {
    document.getElementById('product-filters').addEventListener('click', (e) => {
        if (e.target.classList.contains('product-filter')) {
            document.querySelectorAll('.product-filter').forEach(f => f.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.cat;
            loadProducts();
        }
    });
}

function filterByCategory(category) {
    currentFilter = category;
    document.querySelectorAll('.product-filter').forEach(f => {
        f.classList.toggle('active', f.dataset.cat === category);
    });
    scrollToSection('products');
    setTimeout(() => loadProducts(), 300);
}

// ====== LOAD PRODUCTS ======
async function loadProducts() {
    try {
        const params = new URLSearchParams();
        if (currentFilter !== 'all') params.set('category', currentFilter);

        const products = await fetch(`${API}/api/products?${params}`).then(r => r.json());
        allProducts = products;
        renderProducts(products);
    } catch (err) {
        console.error('Failed to load products:', err);
    }
}

function renderProducts(products) {
    const grid = document.getElementById('shop-products-grid');

    if (products.length === 0) {
        grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:80px 20px;color:var(--text-muted);">
        <div style="font-size:3rem;margin-bottom:16px;opacity:0.4;">🍰</div>
        <p style="font-size:1.1rem;">No products found in this category</p>
      </div>
    `;
        return;
    }

    grid.innerHTML = products.map((product, i) => {
        const imgUrl = PRODUCT_IMAGES[product.name] || DEFAULT_IMAGE;
        const stockLabel = product.stock < 10 ? `Only ${product.stock} left!` : `${product.stock} in stock`;
        const stockClass = product.stock < 10 ? 'low' : '';
        const inCart = cart.find(c => c.id === product.id);

        return `
      <div class="product-card" style="animation-delay: ${i * 0.06}s">
        <div class="product-card-img">
          <img src="${imgUrl}" alt="${product.name}" loading="lazy">
          <span class="product-card-category">${product.category}</span>
          ${product.stock < 10 ? '<span class="product-card-badge">Low Stock</span>' : ''}
        </div>
        <div class="product-card-body">
          <h3 class="product-card-name">${product.name}</h3>
          <p class="product-card-desc">${product.description}</p>
          <div class="product-card-footer">
            <div>
              <span class="product-card-price">₹${product.price}</span>
              <div class="product-card-stock ${stockClass}">${stockLabel}</div>
            </div>
            <button class="btn-add-cart" onclick="addToCart(${product.id})" id="btn-cart-${product.id}">
              ${inCart ? `✓ In Cart (${inCart.quantity})` : '🛒 Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    `;
    }).join('');
}

// ====== CART ======
function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(c => c.id === productId);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: PRODUCT_IMAGES[product.name] || DEFAULT_IMAGE,
            emoji: product.image,
            quantity: 1
        });
    }

    saveCartToStorage();
    updateCartUI();
    renderProducts(allProducts.filter(p => currentFilter === 'all' || p.category === currentFilter));
    showToast(`${product.name} added to cart!`, 'success');

    // Animate cart button
    const btn = document.getElementById(`btn-cart-${productId}`);
    if (btn) {
        btn.style.transform = 'scale(1.1)';
        setTimeout(() => btn.style.transform = '', 200);
    }
}

function removeFromCart(productId) {
    cart = cart.filter(c => c.id !== productId);
    saveCartToStorage();
    updateCartUI();
    renderProducts(allProducts.filter(p => currentFilter === 'all' || p.category === currentFilter));
}

function changeCartQty(productId, delta) {
    const item = cart.find(c => c.id === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        removeFromCart(productId);
        return;
    }

    saveCartToStorage();
    updateCartUI();
}

function clearCart() {
    cart = [];
    saveCartToStorage();
    updateCartUI();
    renderProducts(allProducts.filter(p => currentFilter === 'all' || p.category === currentFilter));
    showToast('Cart cleared', 'success');
}

function updateCartUI() {
    const countEl = document.getElementById('cart-count');
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    countEl.textContent = totalCount;
    countEl.classList.toggle('visible', totalCount > 0);

    const itemsContainer = document.getElementById('cart-items');
    const footer = document.getElementById('cart-footer');

    if (cart.length === 0) {
        itemsContainer.innerHTML = `
      <div class="cart-empty">
        <span class="cart-empty-icon">🛒</span>
        <span class="cart-empty-text">Your cart is empty</span>
        <p style="font-size:0.78rem;color:var(--text-dim);">Browse our menu and add items</p>
      </div>
    `;
        footer.style.display = 'none';
        return;
    }

    footer.style.display = 'block';

    itemsContainer.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">
        <img src="${item.image}" alt="${item.name}">
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">₹${item.price}</div>
        <div class="cart-item-controls">
          <button class="cart-qty-btn" onclick="changeCartQty(${item.id}, -1)">−</button>
          <span class="cart-qty-value">${item.quantity}</span>
          <button class="cart-qty-btn" onclick="changeCartQty(${item.id}, 1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${item.id})">×</button>
    </div>
  `).join('');

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('cart-total-value').textContent = `₹${total}`;
}

function toggleCart() {
    document.getElementById('cart-sidebar').classList.toggle('active');
    document.getElementById('cart-overlay').classList.toggle('active');
    document.body.style.overflow = document.getElementById('cart-sidebar').classList.contains('active') ? 'hidden' : '';
    updateCartUI();
}

function saveCartToStorage() {
    localStorage.setItem('bakery_cart', JSON.stringify(cart));
}

function loadCartFromStorage() {
    try {
        const saved = localStorage.getItem('bakery_cart');
        if (saved) cart = JSON.parse(saved);
    } catch { }
    updateCartUI();
}

// ====== CHECKOUT ======
let pendingCheckout = false;

function openCheckoutModal() {
    if (cart.length === 0) {
        showToast('Your cart is empty!', 'error');
        return;
    }

    // Require login before checkout
    if (!currentUser) {
        pendingCheckout = true;
        toggleCart(); // close cart first
        showToast('Please login first to place an order', 'error');
        setTimeout(() => openUserAuthModal(), 400);
        return;
    }

    pendingCheckout = false;

    // Close cart sidebar
    document.getElementById('cart-sidebar').classList.remove('active');
    document.getElementById('cart-overlay').classList.remove('active');
    document.body.style.overflow = 'hidden';

    // Build summary
    const summary = document.getElementById('checkout-summary');
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    summary.innerHTML = `
    ${cart.map(item => `
      <div class="checkout-item">
        <span>${item.emoji} ${item.name} × ${item.quantity}</span>
        <span>₹${(item.price * item.quantity)}</span>
      </div>
    `).join('')}
    <hr class="checkout-divider">
    <div class="checkout-total">
      <span>Total</span>
      <span>₹${total}</span>
    </div>
  `;

    document.getElementById('checkout-modal').classList.add('active');
    document.getElementById('checkout-user-name').textContent = currentUser.name;
    autoFillCheckout();
}

function closeCheckoutModal() {
    document.getElementById('checkout-modal').classList.remove('active');
    document.body.style.overflow = '';
}

async function placeOrder() {
    const payment = document.querySelector('input[name="checkout-payment"]:checked').value;
    const notes = document.getElementById('checkout-notes').value.trim();

    if (!currentUser) {
        showToast('Please login first', 'error');
        return;
    }

    // Create order using logged-in user's name
    const items = cart.map(item => ({
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.emoji
    }));

    try {
        const res = await fetch(`${API}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerName: currentUser.name,
                items,
                paymentMethod: payment,
                notes
            })
        });

        const order = await res.json();

        if (res.ok) {
            closeCheckoutModal();
            document.getElementById('success-order-id').textContent = `Order #${order.id}`;
            document.getElementById('success-order-total').textContent = `₹${order.total.toLocaleString('en-IN')}`;
            document.getElementById('success-order-items').textContent = `${order.items.length} item${order.items.length > 1 ? 's' : ''}`;
            document.getElementById('success-modal').classList.add('active');

            // Clear cart
            cart = [];
            saveCartToStorage();
            updateCartUI();

            // Reset form
            document.getElementById('checkout-notes').value = '';
        } else {
            showToast(order.error || 'Failed to place order', 'error');
        }
    } catch (err) {
        showToast('Failed to place order. Please try again.', 'error');
    }
}

function closeSuccessModal() {
    document.getElementById('success-modal').classList.remove('active');
    document.body.style.overflow = '';
    renderProducts(allProducts);
}

function viewMyOrdersFromSuccess() {
    closeSuccessModal();
    openMyOrdersModal();
}

// ====== CONTACT FORM ======
async function handleContactSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('contact-name').value.trim();
    const email = document.getElementById('contact-email').value.trim();
    const message = document.getElementById('contact-message').value.trim();

    if (!name || !email || !message) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    try {
        const res = await fetch(`${API}/api/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, message })
        });

        if (res.ok) {
            showToast('Message sent successfully! We\'ll get back to you soon.', 'success');
            document.getElementById('contact-form').reset();
        } else {
            showToast('Failed to send message. Please try again.', 'error');
        }
    } catch {
        showToast('Failed to send message. Please try again.', 'error');
    }
}

// ====== SCROLL ANIMATIONS ======
function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    // Observe sections
    document.querySelectorAll('.section-header, .category-card, .testimonial-card, .about-grid, .contact-grid').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)';
        observer.observe(el);
    });
}

// Add CSS for animation
const animStyle = document.createElement('style');
animStyle.textContent = '.animate-in { opacity: 1 !important; transform: translateY(0) !important; }';
document.head.appendChild(animStyle);

// ====== TOAST NOTIFICATIONS ======
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const icon = type === 'success' ? '✅' : '❌';

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <span>${icon}</span>
    <span>${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ====== USER AUTHENTICATION ======
async function checkUserSession() {
    if (!userToken) {
        updateAccountUI(null);
        return;
    }

    try {
        const res = await fetch(`${API}/api/user/verify`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const data = await res.json();

        if (data.valid) {
            currentUser = data.user;
            updateAccountUI(currentUser);
        } else {
            userToken = '';
            localStorage.removeItem('bakery_user_token');
            updateAccountUI(null);
        }
    } catch {
        updateAccountUI(null);
    }
}

function updateAccountUI(user) {
    const btn = document.getElementById('account-btn');
    const nameEl = document.getElementById('account-name');

    if (user) {
        btn.classList.add('logged-in');
        nameEl.textContent = user.name.split(' ')[0];
        btn.title = user.name;
    } else {
        btn.classList.remove('logged-in');
        nameEl.textContent = '';
        btn.title = 'Login / Register';
    }
}

function handleAccountClick() {
    if (currentUser) {
        // Toggle dropdown
        const dropdown = document.getElementById('user-account-dropdown');
        if (dropdown.style.display === 'none' || !dropdown.style.display) {
            // Update dropdown content
            document.getElementById('account-dropdown-name').textContent = currentUser.name;
            document.getElementById('account-dropdown-email').textContent = currentUser.email;
            document.getElementById('account-dropdown-avatar').textContent =
                currentUser.name.split(' ').map(w => w[0]).join('').toUpperCase();
            dropdown.style.display = 'block';
        } else {
            dropdown.style.display = 'none';
        }
    } else {
        openUserAuthModal();
    }
}

function setupDropdownClose() {
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('user-account-dropdown');
        const accountBtn = document.getElementById('account-btn');
        if (dropdown && !dropdown.contains(e.target) && !accountBtn.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

// ====== LOGIN / REGISTER MODALS ======
function openUserAuthModal() {
    document.getElementById('user-auth-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
    switchAuthTab('login');
}

function closeUserAuthModal() {
    document.getElementById('user-auth-modal').classList.remove('active');
    document.body.style.overflow = '';
    // Clear errors
    document.getElementById('auth-login-error').style.display = 'none';
    document.getElementById('auth-register-error').style.display = 'none';
}

function switchAuthTab(tab) {
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    document.getElementById('auth-login-form').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('auth-register-form').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('auth-modal-title').textContent =
        tab === 'login' ? '👤 Login to Your Account' : '✨ Create New Account';
}

async function userLogin() {
    const email = document.getElementById('user-login-email').value.trim();
    const password = document.getElementById('user-login-password').value;
    const errorEl = document.getElementById('auth-login-error');

    if (!email || !password) {
        errorEl.textContent = '❌ Please enter email and password';
        errorEl.style.display = 'block';
        return;
    }

    errorEl.style.display = 'none';
    // Disable button while loading
    const loginBtn = errorEl.parentElement.querySelector('.btn-place-order');
    const originalText = loginBtn.textContent;
    loginBtn.textContent = '⏳ Logging in...';
    loginBtn.disabled = true;

    try {
        const res = await fetch(`${API}/api/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (data.success) {
            userToken = data.token;
            currentUser = data.user;
            localStorage.setItem('bakery_user_token', userToken);
            updateAccountUI(currentUser);
            closeUserAuthModal();
            showToast(`Welcome back, ${currentUser.name}! 🎉`, 'success');

            // If user was trying to checkout, resume checkout flow
            if (pendingCheckout && cart.length > 0) {
                pendingCheckout = false;
                setTimeout(() => openCheckoutModal(), 500);
            }
        } else {
            errorEl.textContent = '❌ ' + (data.message || 'Login failed');
            errorEl.style.display = 'block';
        }
    } catch {
        errorEl.textContent = '❌ Connection error. Please try again.';
        errorEl.style.display = 'block';
    } finally {
        loginBtn.textContent = originalText;
        loginBtn.disabled = false;
    }
}

async function userRegister() {
    const name = document.getElementById('user-reg-name').value.trim();
    const email = document.getElementById('user-reg-email').value.trim();
    const phone = document.getElementById('user-reg-phone').value.trim();
    const password = document.getElementById('user-reg-password').value;
    const errorEl = document.getElementById('auth-register-error');

    if (!name || !email || !password) {
        errorEl.textContent = '❌ Name, email, and password are required';
        errorEl.style.display = 'block';
        return;
    }

    errorEl.style.display = 'none';

    try {
        const res = await fetch(`${API}/api/user/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password })
        });

        const data = await res.json();

        if (data.success) {
            userToken = data.token;
            currentUser = data.user;
            localStorage.setItem('bakery_user_token', userToken);
            updateAccountUI(currentUser);
            closeUserAuthModal();
            showToast(`Welcome, ${currentUser.name}! Account created 🎉`, 'success');

            // Resume pending checkout
            if (pendingCheckout && cart.length > 0) {
                pendingCheckout = false;
                setTimeout(() => openCheckoutModal(), 500);
            }
        } else {
            errorEl.textContent = '❌ ' + (data.message || 'Registration failed');
            errorEl.style.display = 'block';
        }
    } catch {
        errorEl.textContent = '❌ Connection error. Please try again.';
        errorEl.style.display = 'block';
    }
}

function userLogout() {
    userToken = '';
    currentUser = null;
    localStorage.removeItem('bakery_user_token');
    updateAccountUI(null);
    document.getElementById('user-account-dropdown').style.display = 'none';
    showToast('Logged out successfully', 'success');
}

function autoFillCheckout() {
    if (!currentUser) return;
    const nameEl = document.getElementById('checkout-name');
    const emailEl = document.getElementById('checkout-email');
    const phoneEl = document.getElementById('checkout-phone');
    if (nameEl && !nameEl.value) nameEl.value = currentUser.name;
    if (emailEl && !emailEl.value) emailEl.value = currentUser.email;
    if (phoneEl && !phoneEl.value && currentUser.phone) phoneEl.value = currentUser.phone;
}

// ====== MY ORDERS ======
async function openMyOrdersModal() {
    document.getElementById('user-account-dropdown').style.display = 'none';
    document.getElementById('my-orders-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
    await loadMyOrders();
}

function closeMyOrdersModal() {
    document.getElementById('my-orders-modal').classList.remove('active');
    document.body.style.overflow = '';
}

async function refreshMyOrders() {
    await loadMyOrders();
    showToast('Orders refreshed!', 'success');
}

async function loadMyOrders() {
    const container = document.getElementById('my-orders-list');
    container.innerHTML = '<div class="my-orders-loading">⏳ Loading your orders...</div>';

    try {
        const res = await fetch(`${API}/api/user/orders`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });

        if (!res.ok) {
            container.innerHTML = '<div class="my-orders-loading">❌ Please login to view orders</div>';
            return;
        }

        const orders = await res.json();

        if (orders.length === 0) {
            container.innerHTML = `
                <div class="my-orders-empty">
                    <div class="my-orders-empty-icon">📦</div>
                    <div class="my-orders-empty-text">No orders yet</div>
                    <div class="my-orders-empty-sub">Place your first order and track it here!</div>
                </div>
            `;
            return;
        }

        container.innerHTML = orders.map((order, i) => `
            <div class="my-order-card" style="animation-delay: ${i * 0.08}s">
                <div class="my-order-header">
                    <span class="my-order-id">Order #${order.id}</span>
                    <span class="my-order-date">${formatOrderDate(order.createdAt)}</span>
                </div>

                ${renderOrderTimeline(order.status)}

                <div class="my-order-items">
                    ${order.items.map(item => `
                        <span class="my-order-item-chip">${item.image} ${item.name} ×${item.quantity} · ₹${(item.price * item.quantity).toLocaleString('en-IN')}</span>
                    `).join('')}
                </div>

                ${order.notes ? `<div class="my-order-notes">📝 ${order.notes}</div>` : ''}

                <div class="my-order-footer">
                    <div>
                        <span class="my-order-total">₹${order.total.toLocaleString('en-IN')}</span>
                        <span class="my-order-payment"> · ${getPaymentLabel(order.paymentMethod)}</span>
                    </div>
                    <div class="my-order-actions">
                        ${order.status === 'pending' ? `<button class="my-order-cancel-btn" onclick="cancelOrder(${order.id})">❌ Cancel</button>` : ''}
                        <span class="my-order-status-badge ${order.status}">${formatOrderStatus(order.status)}</span>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('Failed to load orders:', err);
        container.innerHTML = '<div class="my-orders-loading">❌ Failed to load orders</div>';
    }
}

async function cancelOrder(orderId) {
    if (!confirm(`Are you sure you want to cancel Order #${orderId}?`)) return;

    try {
        const res = await fetch(`${API}/api/user/orders/${orderId}/cancel`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${userToken}` }
        });

        const data = await res.json();

        if (res.ok) {
            showToast(`Order #${orderId} cancelled successfully`, 'success');
            await loadMyOrders(); // Refresh list
        } else {
            showToast(data.error || 'Failed to cancel order', 'error');
        }
    } catch {
        showToast('Failed to cancel order. Please try again.', 'error');
    }
}

function getPaymentLabel(method) {
    const labels = { cash: 'Cash on Delivery', upi: 'UPI / GPay', card: 'Card' };
    return labels[method] || method;
}

function renderOrderTimeline(status) {
    const steps = ['pending', 'in-progress', 'ready', 'delivered'];
    const icons = ['📝', '🔥', '✅', '📦'];
    const labels = ['Placed', 'Preparing', 'Ready', 'Delivered'];

    if (status === 'cancelled') {
        return `
            <div class="order-status-timeline">
                <div class="timeline-step cancelled">
                    <div class="timeline-dot">❌</div>
                    <span class="timeline-label">Cancelled</span>
                </div>
            </div>
        `;
    }

    const currentIndex = steps.indexOf(status);
    let html = '<div class="order-status-timeline">';

    steps.forEach((step, i) => {
        const isCompleted = i < currentIndex;
        const isActive = i === currentIndex;
        const stepClass = isCompleted ? 'completed' : isActive ? 'active' : '';

        html += `
            <div class="timeline-step ${stepClass}">
                <div class="timeline-dot">${icons[i]}</div>
                <span class="timeline-label">${labels[i]}</span>
            </div>
        `;

        // Add connecting line (not after last step)
        if (i < steps.length - 1) {
            const lineClass = i < currentIndex ? 'completed' : '';
            html += `<div class="timeline-line ${lineClass}"></div>`;
        }
    });

    html += '</div>';
    return html;
}

function formatOrderDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
    });
}

function formatOrderStatus(status) {
    return status.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

