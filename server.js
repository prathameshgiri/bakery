const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// AUTHENTICATION
// ============================================================

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'shiv123';
const AUTH_TOKEN = 'shivbakery_admin_token_2026';

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        res.json({ success: true, token: AUTH_TOKEN, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
});

app.get('/api/auth/verify', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token === AUTH_TOKEN) {
        res.json({ valid: true });
    } else {
        res.status(401).json({ valid: false });
    }
});

// Auth middleware for admin routes
function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token === AUTH_TOKEN) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
}

// ============================================================
// USER (CUSTOMER) AUTHENTICATION
// ============================================================

// Demo user passwords - all existing customers have password '1234'
const userPasswords = {
    'priya@example.com': '1234',
    'rahul@example.com': '1234',
    'anjali@example.com': '1234',
    'amit@example.com': '1234',
    'neha@example.com': '1234',
    'vikram@example.com': '1234',
};

// Simple token generation for users
function generateUserToken(email) {
    return 'user_' + Buffer.from(email + ':' + Date.now()).toString('base64');
}

// Active user sessions: token -> { email, name, customerId }
const userSessions = {};

app.post('/api/user/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const emailLower = email.toLowerCase().trim();
    const customer = customers.find(c => c.email.toLowerCase() === emailLower);

    if (!customer) {
        return res.status(401).json({ success: false, message: 'No account found with this email' });
    }

    const storedPassword = userPasswords[emailLower];
    if (password !== storedPassword) {
        return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    const token = generateUserToken(emailLower);
    userSessions[token] = { email: emailLower, name: customer.name, customerId: customer.id };

    res.json({
        success: true,
        token,
        user: { name: customer.name, email: customer.email, phone: customer.phone }
    });
});

app.post('/api/user/register', (req, res) => {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const emailLower = email.toLowerCase().trim();

    // Check if already exists
    if (customers.find(c => c.email.toLowerCase() === emailLower)) {
        return res.status(400).json({ success: false, message: 'An account with this email already exists. Please login.' });
    }

    // Create customer
    const customer = {
        id: nextCustomerId++,
        name,
        email: emailLower,
        phone: phone || '',
        totalOrders: 0,
        totalSpent: 0,
        createdAt: new Date().toISOString().split('T')[0]
    };
    customers.push(customer);
    userPasswords[emailLower] = password;

    const token = generateUserToken(emailLower);
    userSessions[token] = { email: emailLower, name: customer.name, customerId: customer.id };

    res.status(201).json({
        success: true,
        token,
        user: { name: customer.name, email: customer.email, phone: customer.phone }
    });
});

app.get('/api/user/verify', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const session = userSessions[token];
    if (session) {
        const customer = customers.find(c => c.email.toLowerCase() === session.email);
        res.json({
            valid: true,
            user: customer ? { name: customer.name, email: customer.email, phone: customer.phone } : session
        });
    } else {
        res.status(401).json({ valid: false });
    }
});

// Get orders for the logged-in user
app.get('/api/user/orders', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const session = userSessions[token];
    if (!session) {
        return res.status(401).json({ error: 'Please login to view your orders' });
    }

    // Find orders by customer name (case-insensitive)
    const userOrders = orders
        .filter(o => o.customerName.toLowerCase() === session.name.toLowerCase())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(userOrders);
});

// ============================================================
// REAL-TIME: Server-Sent Events (SSE)
// ============================================================

let sseClients = [];

app.get('/api/events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    res.write('data: {"type":"connected","message":"SSE connected"}\n\n');

    sseClients.push(res);

    req.on('close', () => {
        sseClients = sseClients.filter(client => client !== res);
    });
});

function broadcastEvent(type, data) {
    const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    sseClients.forEach(client => {
        client.write(`data: ${payload}\n\n`);
    });
}

// ============================================================
// IN-MEMORY DATA STORE (Prices in ₹ INR)
// ============================================================

let nextProductId = 13;
let nextOrderId = 1001;
let nextCustomerId = 7;
let nextMessageId = 1;

// Contact messages from shop contact form
const contactMessages = [];

// ============================================================
// CONTACT MESSAGES API
// ============================================================

app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const msg = {
        id: nextMessageId++,
        name,
        email,
        message,
        read: false,
        createdAt: new Date().toISOString()
    };

    contactMessages.push(msg);
    broadcastEvent('new_message', msg);
    res.status(201).json({ success: true, message: 'Message sent successfully!' });
});

app.get('/api/messages', requireAuth, (req, res) => {
    const sorted = [...contactMessages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(sorted);
});

app.patch('/api/messages/:id/read', requireAuth, (req, res) => {
    const msg = contactMessages.find(m => m.id === parseInt(req.params.id));
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    msg.read = true;
    res.json(msg);
});

app.delete('/api/messages/:id', requireAuth, (req, res) => {
    const index = contactMessages.findIndex(m => m.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Message not found' });
    contactMessages.splice(index, 1);
    res.json({ success: true });
});

const products = [
    { id: 1, name: 'Sourdough Bread', category: 'Breads', price: 250, cost: 100, image: '🍞', stock: 45, description: 'Classic artisan sourdough with a crispy crust', active: true },
    { id: 2, name: 'Chocolate Croissant', category: 'Pastries', price: 180, cost: 70, image: '🥐', stock: 32, description: 'Buttery croissant with rich dark chocolate', active: true },
    { id: 3, name: 'Red Velvet Cake', category: 'Cakes', price: 1800, cost: 600, image: '🎂', stock: 8, description: 'Classic red velvet with cream cheese frosting', active: true },
    { id: 4, name: 'Blueberry Muffin', category: 'Pastries', price: 150, cost: 50, image: '🧁', stock: 28, description: 'Loaded with fresh blueberries', active: true },
    { id: 5, name: 'Cinnamon Roll', category: 'Pastries', price: 200, cost: 70, image: '🍥', stock: 20, description: 'Warm cinnamon roll with vanilla glaze', active: true },
    { id: 6, name: 'Baguette', category: 'Breads', price: 180, cost: 60, image: '🥖', stock: 38, description: 'Traditional French baguette', active: true },
    { id: 7, name: 'Tiramisu', category: 'Cakes', price: 2200, cost: 750, image: '🍰', stock: 5, description: 'Italian coffee-flavored layered dessert', active: true },
    { id: 8, name: 'Chocolate Chip Cookie', category: 'Cookies', price: 120, cost: 40, image: '🍪', stock: 60, description: 'Chewy cookies with premium chocolate chips', active: true },
    { id: 9, name: 'Whole Wheat Loaf', category: 'Breads', price: 220, cost: 80, image: '🍞', stock: 25, description: 'Healthy whole wheat bread', active: true },
    { id: 10, name: 'Strawberry Tart', category: 'Pastries', price: 250, cost: 100, image: '🥧', stock: 15, description: 'Crispy tart with fresh strawberries and cream', active: true },
    { id: 11, name: 'Macarons (6pc)', category: 'Cookies', price: 600, cost: 200, image: '🍬', stock: 18, description: 'Assorted French macarons', active: true },
    { id: 12, name: 'Birthday Cake', category: 'Cakes', price: 2800, cost: 1000, image: '🎂', stock: 3, description: 'Custom birthday cake with fondant decoration', active: true },
];

const customers = [
    { id: 1, name: 'Priya Sharma', email: 'priya@example.com', phone: '98765-43210', totalOrders: 12, totalSpent: 18500, createdAt: '2025-09-15' },
    { id: 2, name: 'Rahul Verma', email: 'rahul@example.com', phone: '98765-43211', totalOrders: 8, totalSpent: 12400, createdAt: '2025-10-01' },
    { id: 3, name: 'Anjali Gupta', email: 'anjali@example.com', phone: '98765-43212', totalOrders: 15, totalSpent: 28000, createdAt: '2025-08-20' },
    { id: 4, name: 'Amit Patel', email: 'amit@example.com', phone: '98765-43213', totalOrders: 5, totalSpent: 8200, createdAt: '2025-11-10' },
    { id: 5, name: 'Neha Singh', email: 'neha@example.com', phone: '98765-43214', totalOrders: 20, totalSpent: 35000, createdAt: '2025-07-05' },
    { id: 6, name: 'Vikram Joshi', email: 'vikram@example.com', phone: '98765-43215', totalOrders: 3, totalSpent: 5400, createdAt: '2025-12-01' },
];

const orders = [];

// Historical revenue data
const revenueHistory = [
    { month: 'Sep', revenue: 245000, orders: 85 },
    { month: 'Oct', revenue: 312000, orders: 102 },
    { month: 'Nov', revenue: 398000, orders: 124 },
    { month: 'Dec', revenue: 520000, orders: 178 },
    { month: 'Jan', revenue: 468000, orders: 148 },
    { month: 'Feb', revenue: 215000, orders: 64 },
];

// ============================================================
// DASHBOARD ROUTES (protected)
// ============================================================

app.get('/api/dashboard/stats', requireAuth, (req, res) => {
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const inProgressOrders = orders.filter(o => o.status === 'in-progress').length;
    const readyOrders = orders.filter(o => o.status === 'ready').length;
    const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
    const totalCustomers = customers.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalProducts = products.filter(p => p.active).length;

    res.json({
        totalRevenue,
        totalOrders,
        pendingOrders,
        inProgressOrders,
        readyOrders,
        deliveredOrders,
        totalCustomers,
        avgOrderValue: Math.round(avgOrderValue),
        totalProducts,
        lowStockProducts: products.filter(p => p.stock < 10).length
    });
});

app.get('/api/dashboard/revenue-history', requireAuth, (req, res) => {
    res.json(revenueHistory);
});

app.get('/api/dashboard/top-products', requireAuth, (req, res) => {
    const productSales = {};
    orders.forEach(order => {
        order.items.forEach(item => {
            if (!productSales[item.name]) {
                productSales[item.name] = { name: item.name, image: item.image, totalSold: 0, totalRevenue: 0 };
            }
            productSales[item.name].totalSold += item.quantity;
            productSales[item.name].totalRevenue += item.price * item.quantity;
        });
    });

    const topProducts = Object.values(productSales)
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 5);

    res.json(topProducts);
});

app.get('/api/dashboard/recent-orders', requireAuth, (req, res) => {
    const recent = [...orders]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
    res.json(recent);
});

// ============================================================
// PRODUCT ROUTES
// ============================================================

app.get('/api/products', (req, res) => {
    const { category, search, active } = req.query;
    let filtered = [...products];

    if (category && category !== 'all') {
        filtered = filtered.filter(p => p.category === category);
    }
    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
        );
    }
    if (active !== undefined) {
        filtered = filtered.filter(p => p.active === (active === 'true'));
    }

    res.json(filtered);
});

app.get('/api/products/:id', (req, res) => {
    const product = products.find(p => p.id === parseInt(req.params.id));
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
});

app.post('/api/products', requireAuth, (req, res) => {
    const { name, category, price, cost, image, stock, description } = req.body;
    if (!name || !category || !price) {
        return res.status(400).json({ error: 'Name, category, and price are required' });
    }

    const product = {
        id: nextProductId++,
        name,
        category,
        price: parseFloat(price),
        cost: parseFloat(cost) || 0,
        image: image || '🍩',
        stock: parseInt(stock) || 0,
        description: description || '',
        active: true
    };

    products.push(product);
    broadcastEvent('product_added', product);
    res.status(201).json(product);
});

app.put('/api/products/:id', requireAuth, (req, res) => {
    const product = products.find(p => p.id === parseInt(req.params.id));
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { name, category, price, cost, image, stock, description, active } = req.body;
    if (name) product.name = name;
    if (category) product.category = category;
    if (price !== undefined) product.price = parseFloat(price);
    if (cost !== undefined) product.cost = parseFloat(cost);
    if (image) product.image = image;
    if (stock !== undefined) product.stock = parseInt(stock);
    if (description !== undefined) product.description = description;
    if (active !== undefined) product.active = active;

    res.json(product);
});

app.delete('/api/products/:id', requireAuth, (req, res) => {
    const index = products.findIndex(p => p.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Product not found' });
    products.splice(index, 1);
    res.json({ message: 'Product deleted' });
});

app.get('/api/products/categories/list', (req, res) => {
    const categories = [...new Set(products.map(p => p.category))];
    res.json(categories);
});

// ============================================================
// ORDER ROUTES
// ============================================================

app.get('/api/orders', (req, res) => {
    const { status, search, sort } = req.query;
    let filtered = [...orders];

    if (status && status !== 'all') {
        filtered = filtered.filter(o => o.status === status);
    }
    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(o =>
            o.customerName.toLowerCase().includes(q) ||
            o.id.toString().includes(q) ||
            o.items.some(item => item.name.toLowerCase().includes(q))
        );
    }

    if (sort === 'oldest') {
        filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else {
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json(filtered);
});

app.get('/api/orders/:id', (req, res) => {
    const order = orders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
});

app.post('/api/orders', (req, res) => {
    const { customerId, customerName, items, paymentMethod, notes } = req.body;

    if (!customerName || !items || items.length === 0) {
        return res.status(400).json({ error: 'Customer name and at least one item are required' });
    }

    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const now = new Date().toISOString();

    const order = {
        id: nextOrderId++,
        customerId: customerId || null,
        customerName,
        items,
        total: Math.round(total),
        status: 'pending',
        paymentMethod: paymentMethod || 'cash',
        createdAt: now,
        updatedAt: now,
        notes: notes || ''
    };

    // Reduce stock
    items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
            product.stock = Math.max(0, product.stock - item.quantity);
        }
    });

    orders.push(order);

    // Broadcast new order to admin in real-time
    broadcastEvent('new_order', order);

    res.status(201).json(order);
});

app.put('/api/orders/:id', requireAuth, (req, res) => {
    const order = orders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const { status, notes, items, paymentMethod } = req.body;
    if (status) order.status = status;
    if (notes !== undefined) order.notes = notes;
    if (items) order.items = items;
    if (paymentMethod) order.paymentMethod = paymentMethod;
    order.updatedAt = new Date().toISOString();

    if (items) {
        order.total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    broadcastEvent('order_updated', order);
    res.json(order);
});

app.patch('/api/orders/:id/status', (req, res) => {
    const order = orders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const { status } = req.body;
    const validStatuses = ['pending', 'in-progress', 'ready', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    order.status = status;
    order.updatedAt = new Date().toISOString();

    broadcastEvent('order_status_changed', order);
    res.json(order);
});

app.delete('/api/orders/:id', requireAuth, (req, res) => {
    const index = orders.findIndex(o => o.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Order not found' });
    const deleted = orders.splice(index, 1)[0];
    broadcastEvent('order_deleted', deleted);
    res.json({ message: 'Order deleted' });
});

// ============================================================
// CUSTOMER ROUTES
// ============================================================

// User cancel order (only their own, only pending orders)
app.post('/api/user/orders/:id/cancel', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const session = userSessions[token];
    if (!session) {
        return res.status(401).json({ error: 'Please login to cancel orders' });
    }

    const order = orders.find(o => o.id === parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Check ownership
    if (order.customerName.toLowerCase() !== session.name.toLowerCase()) {
        return res.status(403).json({ error: 'You can only cancel your own orders' });
    }

    // Only allow cancelling pending orders
    if (order.status !== 'pending') {
        return res.status(400).json({ error: `Cannot cancel order — it is already ${order.status}` });
    }

    order.status = 'cancelled';
    order.updatedAt = new Date().toISOString();

    broadcastEvent('order_status_changed', order);
    res.json({ success: true, order });
});

app.get('/api/customers', (req, res) => {
    const { search } = req.query;
    let filtered = [...customers];
    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(c =>
            c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
        );
    }
    res.json(filtered);
});

app.get('/api/customers/:id', (req, res) => {
    const customer = customers.find(c => c.id === parseInt(req.params.id));
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
});

app.post('/api/customers', (req, res) => {
    const { name, email, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    // Check if customer already exists
    const existing = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return res.json(existing);

    const customer = {
        id: nextCustomerId++,
        name,
        email: email || '',
        phone: phone || '',
        totalOrders: 0,
        totalSpent: 0,
        createdAt: new Date().toISOString().split('T')[0]
    };

    customers.push(customer);
    res.status(201).json(customer);
});

// ============================================================
// SERVE FRONTEND
// ============================================================

app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
    console.log(`🧁 Shiv Bakery Management Server running at http://localhost:${PORT}`);
    console.log(`🛍️  Shop: http://localhost:${PORT}`);
    console.log(`⚙️  Admin: http://localhost:${PORT}/admin.html`);
    console.log(`� Admin Login: username=admin, password=shiv123`);
    console.log(`�📦 ${products.length} products loaded`);
    console.log(`📋 ${orders.length} orders loaded`);
    console.log(`👥 ${customers.length} customers loaded`);
});
