import { auth, db } from './firebase-config.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { checkAuth, updateUserInfo } from './auth.js';
import { formatDate, formatDateTime, showNotification } from './utils.js';

let stocksData = [];
let filteredStocks = [];

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
    loadStocksData();
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            updateUserInfo(user);
        }
    });
});

function setupEventListeners() {
    // Menu toggle
    const menuBtn = document.querySelector('.menu-btn');
    const sidebar = document.querySelector('.sidebar');
    
    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // Setup search and filter debouncing
    const stockSearch = document.getElementById('stockSearch');
    if (stockSearch) {
        let searchTimeout;
        stockSearch.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(searchStock, 300);
        });
    }

    // Setup real-time date for recent stock filter
    const recentStockDate = document.getElementById('recentStockDate');
    if (recentStockDate) {
        const today = new Date();
        recentStockDate.value = today.toISOString().split('T')[0];
        recentStockDate.max = today.toISOString().split('T')[0];
    }
}

async function loadStocksData() {
    try {
        showNotification('Loading stock data...', 'info');
        
        // Setup real-time listener for stocks
        const stocksRef = collection(db, 'stocks');
        const stocksQuery = query(stocksRef, orderBy('dateAdded', 'desc'));
        
        onSnapshot(stocksQuery, (snapshot) => {
            stocksData = [];
            snapshot.forEach((doc) => {
                stocksData.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            filteredStocks = [...stocksData];
            displayStocks();
            loadStockStatistics();
            loadLowStockAlerts();
            loadRecentStock();
        });
        
    } catch (error) {
        console.error('Error loading stocks:', error);
        showNotification('Error loading stock data', 'error');
    }
}

function displayStocks() {
    const stockGrid = document.getElementById('stockGrid');
    if (!stockGrid) return;

    if (filteredStocks.length === 0) {
        stockGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-boxes"></i>
                <h3>No stock items found</h3>
                <p>Add your first stock item to get started</p>
                <button class="btn btn-primary" onclick="showAddStockModal()">
                    <i class="fas fa-plus"></i> Add Stock
                </button>
            </div>
        `;
        return;
    }

    stockGrid.innerHTML = filteredStocks.map(stock => {
        const stockStatus = getStockStatus(stock);
        const stockValue = (stock.quantity * (stock.price || 0)).toFixed(2);
        const isExpiringSoon = isExpiring(stock.expiryDate);
        
        return `
            <div class="stock-card ${stockStatus.class}" data-stock-id="${stock.id}">
                <div class="stock-header">
                    <div class="stock-info">
                        <h4 class="stock-name">${stock.name}</h4>
                        <span class="stock-category">${stock.category || 'Other'}</span>
                    </div>
                    <div class="stock-actions">
                        <button class="action-btn" onclick="editStock('${stock.id}')" title="Edit Stock">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn danger" onclick="deleteStock('${stock.id}')" title="Delete Stock">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="stock-details">
                    <div class="stock-quantity">
                        <div class="quantity-info">
                            <span class="quantity-number">${stock.quantity}</span>
                            <span class="quantity-unit">${stock.unit || 'units'}</span>
                        </div>
                        <div class="status-badge ${stockStatus.class}">
                            <i class="fas ${stockStatus.icon}"></i>
                            ${stockStatus.text}
                        </div>
                    </div>
                    
                    <div class="stock-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${getStockProgress(stock)}%"></div>
                        </div>
                        <span class="progress-text">${getStockProgress(stock)}% of threshold</span>
                    </div>
                    
                    <div class="stock-meta">
                        <div class="meta-item">
                            <i class="fas fa-dollar-sign"></i>
                            <span>$${stock.price || '0.00'} each</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-calculator"></i>
                            <span>Total: $${stockValue}</span>
                        </div>
                        ${stock.expiryDate ? `
                            <div class="meta-item ${isExpiringSoon ? 'expiry-warning' : ''}">
                                <i class="fas fa-calendar-alt"></i>
                                <span>Expires: ${formatDate(stock.expiryDate)}</span>
                            </div>
                        ` : ''}
                        <div class="meta-item">
                            <i class="fas fa-clock"></i>
                            <span>Added: ${formatDate(stock.dateAdded)}</span>
                        </div>
                    </div>
                    
                    ${stock.description ? `
                        <div class="stock-description">
                            <p>${stock.description}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function getStockStatus(stock) {
    const lowThreshold = stock.lowStockThreshold || 20;
    
    if (stock.quantity === 0) {
        return { class: 'out-of-stock', icon: 'fa-times-circle', text: 'Out of Stock' };
    } else if (stock.quantity <= (lowThreshold * 0.5)) {
        return { class: 'critical-stock', icon: 'fa-exclamation-triangle', text: 'Critical' };
    } else if (stock.quantity <= lowThreshold) {
        return { class: 'low-stock', icon: 'fa-exclamation', text: 'Low Stock' };
    } else {
        return { class: 'in-stock', icon: 'fa-check-circle', text: 'In Stock' };
    }
}

function getStockProgress(stock) {
    const lowThreshold = stock.lowStockThreshold || 20;
    const maxThreshold = lowThreshold * 5; // Assume full stock is 5x the low threshold
    return Math.min(100, Math.max(0, (stock.quantity / maxThreshold) * 100));
}

function isExpiring(expiryDate) {
    if (!expiryDate) return false;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysDiff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    return daysDiff <= 30 && daysDiff >= 0;
}

async function loadStockStatistics() {
    try {
        const totalDrugs = stocksData.length;
        const totalStock = stocksData.reduce((sum, stock) => sum + stock.quantity, 0);
        const lowStockCount = stocksData.filter(stock => {
            const threshold = stock.lowStockThreshold || 20;
            return stock.quantity <= threshold;
        }).length;
        const stockValue = stocksData.reduce((sum, stock) => sum + (stock.quantity * (stock.price || 0)), 0);

        document.getElementById('totalDrugs').textContent = totalDrugs;
        document.getElementById('totalStock').textContent = totalStock.toLocaleString();
        document.getElementById('lowStockCount').textContent = lowStockCount;
        document.getElementById('stockValue').textContent = `$${stockValue.toFixed(2)}`;
        
    } catch (error) {
        console.error('Error loading stock statistics:', error);
    }
}

function loadLowStockAlerts() {
    const lowStockList = document.getElementById('lowStockList');
    if (!lowStockList) return;

    const lowStockItems = stocksData.filter(stock => {
        const threshold = stock.lowStockThreshold || 20;
        return stock.quantity <= threshold;
    }).sort((a, b) => a.quantity - b.quantity);

    if (lowStockItems.length === 0) {
        lowStockList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <p>No low stock alerts</p>
            </div>
        `;
        return;
    }

    lowStockList.innerHTML = lowStockItems.map(stock => {
        const status = getStockStatus(stock);
        return `
            <div class="alert-item ${status.class}">
                <div class="alert-info">
                    <h4>${stock.name}</h4>
                    <p>${stock.quantity} ${stock.unit || 'units'} remaining</p>
                    <span class="alert-category">${stock.category || 'Other'}</span>
                </div>
                <div class="alert-status">
                    <span class="status-badge ${status.class}">
                        <i class="fas ${status.icon}"></i>
                        ${status.text}
                    </span>
                    <button class="btn btn-sm btn-primary" onclick="editStock('${stock.id}')">
                        <i class="fas fa-plus"></i> Restock
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function loadRecentStock() {
    const recentStockList = document.getElementById('recentStockList');
    if (!recentStockList) return;

    const recentDate = document.getElementById('recentStockDate')?.value;
    const filterDate = recentDate ? new Date(recentDate) : new Date();
    filterDate.setHours(0, 0, 0, 0);

    const recentItems = stocksData.filter(stock => {
        const stockDate = new Date(stock.dateAdded);
        stockDate.setHours(0, 0, 0, 0);
        return stockDate >= filterDate;
    }).sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));

    if (recentItems.length === 0) {
        recentStockList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar"></i>
                <p>No items added on this date</p>
            </div>
        `;
        return;
    }

    recentStockList.innerHTML = recentItems.map(stock => `
        <div class="recent-item">
            <div class="recent-info">
                <h4>${stock.name}</h4>
                <p>${stock.quantity} ${stock.unit || 'units'} added</p>
                <span class="recent-time">${formatDateTime(stock.dateAdded)}</span>
            </div>
            <div class="recent-value">
                <span class="value-amount">$${((stock.quantity * (stock.price || 0)).toFixed(2))}</span>
                <span class="value-label">Total Value</span>
            </div>
        </div>
    `).join('');
}

function searchStock() {
    const searchTerm = document.getElementById('stockSearch')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('stockCategoryFilter')?.value || 'all';
    const statusFilter = document.getElementById('stockStatusFilter')?.value || 'all';

    filteredStocks = stocksData.filter(stock => {
        const matchesSearch = stock.name.toLowerCase().includes(searchTerm) ||
                            (stock.description || '').toLowerCase().includes(searchTerm) ||
                            (stock.supplier || '').toLowerCase().includes(searchTerm);
        
        const matchesCategory = categoryFilter === 'all' || stock.category === categoryFilter;
        
        let matchesStatus = true;
        if (statusFilter !== 'all') {
            const status = getStockStatus(stock);
            if (statusFilter === 'in-stock') {
                matchesStatus = status.class === 'in-stock';
            } else if (statusFilter === 'low-stock') {
                matchesStatus = status.class === 'low-stock' || status.class === 'critical-stock';
            } else if (statusFilter === 'out-of-stock') {
                matchesStatus = status.class === 'out-of-stock';
            }
        }

        return matchesSearch && matchesCategory && matchesStatus;
    });

    displayStocks();
}

function filterStock() {
    searchStock();
}

function filterLowStock() {
    loadLowStockAlerts();
}

function filterRecentStock() {
    loadRecentStock();
}

function showAddStockModal() {
    const modal = document.getElementById('addStockModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('addStockForm').reset();
    }
}

function closeAddStockModal() {
    const modal = document.getElementById('addStockModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function handleAddStock(event) {
    event.preventDefault();
    
    try {
        const formData = new FormData(event.target);
        const stockData = {
            name: document.getElementById('drugName').value.trim(),
            category: document.getElementById('drugCategory').value,
            quantity: parseInt(document.getElementById('drugQuantity').value),
            unit: document.getElementById('drugUnit').value,
            price: parseFloat(document.getElementById('drugPrice').value) || 0,
            lowStockThreshold: parseInt(document.getElementById('lowStockThreshold').value) || 20,
            expiryDate: document.getElementById('expiryDate').value || null,
            supplier: document.getElementById('supplier').value.trim() || null,
            description: document.getElementById('drugDescription').value.trim() || null,
            dateAdded: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };

        // Check if drug already exists
        const existingStock = stocksData.find(stock => 
            stock.name.toLowerCase() === stockData.name.toLowerCase()
        );

        if (existingStock) {
            // Update existing stock
            const stockRef = doc(db, 'stocks', existingStock.id);
            await updateDoc(stockRef, {
                quantity: existingStock.quantity + stockData.quantity,
                lastUpdated: new Date().toISOString(),
                ...(stockData.price > 0 && { price: stockData.price }),
                ...(stockData.supplier && { supplier: stockData.supplier }),
                ...(stockData.expiryDate && { expiryDate: stockData.expiryDate })
            });
            
            showNotification(`Added ${stockData.quantity} ${stockData.unit} to existing ${stockData.name} stock`, 'success');
        } else {
            // Add new stock
            await addDoc(collection(db, 'stocks'), stockData);
            showNotification(`${stockData.name} added to stock successfully`, 'success');
        }

        closeAddStockModal();
        
    } catch (error) {
        console.error('Error adding stock:', error);
        showNotification('Error adding stock', 'error');
    }
}

function editStock(stockId) {
    const stock = stocksData.find(s => s.id === stockId);
    if (!stock) return;

    // Populate edit form
    document.getElementById('editStockId').value = stockId;
    document.getElementById('editDrugName').value = stock.name;
    document.getElementById('editDrugCategory').value = stock.category || '';
    document.getElementById('editDrugQuantity').value = stock.quantity;
    document.getElementById('editDrugUnit').value = stock.unit || 'tablets';
    document.getElementById('editDrugPrice').value = stock.price || '';
    document.getElementById('addQuantity').value = '';

    // Show edit modal
    const modal = document.getElementById('editStockModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeEditStockModal() {
    const modal = document.getElementById('editStockModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function handleEditStock(event) {
    event.preventDefault();
    
    try {
        const stockId = document.getElementById('editStockId').value;
        const currentQuantity = parseInt(document.getElementById('editDrugQuantity').value);
        const additionalQuantity = parseInt(document.getElementById('addQuantity').value) || 0;
        const newTotalQuantity = currentQuantity + additionalQuantity;

        const updateData = {
            name: document.getElementById('editDrugName').value.trim(),
            category: document.getElementById('editDrugCategory').value,
            quantity: newTotalQuantity,
            unit: document.getElementById('editDrugUnit').value,
            price: parseFloat(document.getElementById('editDrugPrice').value) || 0,
            lastUpdated: new Date().toISOString()
        };

        const stockRef = doc(db, 'stocks', stockId);
        await updateDoc(stockRef, updateData);

        if (additionalQuantity > 0) {
            showNotification(`Added ${additionalQuantity} units. Total: ${newTotalQuantity}`, 'success');
        } else {
            showNotification('Stock updated successfully', 'success');
        }

        closeEditStockModal();
        
    } catch (error) {
        console.error('Error updating stock:', error);
        showNotification('Error updating stock', 'error');
    }
}

async function deleteStock(stockId) {
    if (!confirm('Are you sure you want to delete this stock item? This action cannot be undone.')) {
        return;
    }

    try {
        await deleteDoc(doc(db, 'stocks', stockId));
        showNotification('Stock item deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting stock:', error);
        showNotification('Error deleting stock item', 'error');
    }
}

// Function to reduce stock when medication is taken
export async function reduceStock(drugName, quantity = 1) {
    try {
        const stock = stocksData.find(s => s.name.toLowerCase() === drugName.toLowerCase());
        if (!stock) {
            console.warn(`Stock not found for drug: ${drugName}`);
            return false;
        }

        if (stock.quantity < quantity) {
            showNotification(`Insufficient stock for ${drugName}. Only ${stock.quantity} units available.`, 'error');
            return false;
        }

        const stockRef = doc(db, 'stocks', stock.id);
        await updateDoc(stockRef, {
            quantity: stock.quantity - quantity,
            lastUpdated: new Date().toISOString()
        });

        // Check if stock is now low
        const newQuantity = stock.quantity - quantity;
        const lowThreshold = stock.lowStockThreshold || 20;
        
        if (newQuantity <= lowThreshold && stock.quantity > lowThreshold) {
            showNotification(`${drugName} is now running low in stock (${newQuantity} units remaining)`, 'warning');
        }

        return true;
    } catch (error) {
        console.error('Error reducing stock:', error);
        return false;
    }
}

// Function to get available drugs for prescription
export function getAvailableDrugs() {
    return stocksData.filter(stock => stock.quantity > 0).map(stock => ({
        id: stock.id,
        name: stock.name,
        category: stock.category,
        quantity: stock.quantity,
        unit: stock.unit,
        price: stock.price
    }));
}

// Export functions for use in other modules
window.showAddStockModal = showAddStockModal;
window.closeAddStockModal = closeAddStockModal;
window.handleAddStock = handleAddStock;
window.editStock = editStock;
window.closeEditStockModal = closeEditStockModal;
window.handleEditStock = handleEditStock;
window.deleteStock = deleteStock;
window.searchStock = searchStock;
window.filterStock = filterStock;
window.filterLowStock = filterLowStock;
window.filterRecentStock = filterRecentStock;