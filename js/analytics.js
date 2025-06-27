import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { checkAuth, updateUserInfo } from './auth.js';
import { formatDate, formatDateTime, showNotification } from './utils.js';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBPbc82p3XWtzH0X4Ougj9MPeDiJF9vzYk",
  authDomain: "sms-db-7b1c7.firebaseapp.com",
  databaseURL: "https://sms-db-7b1c7-default-rtdb.firebaseio.com",
  projectId: "sms-db-7b1c7",
  storageBucket: "sms-db-7b1c7.firebasestorage.app",
  messagingSenderId: "848657966289",
  appId: "1:848657966289:web:3d4ab0afabc6bc9b57d1f0",
  measurementId: "G-45LBM5CTZ0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global variables
let allStudents = [];
let allPrescriptions = [];
let allDoseRecords = [];
let allStockData = [];
let currentDateRange = { start: null, end: null };
let charts = {};

// Chart configuration
const chartColors = {
    primary: '#10b981',
    secondary: '#34d399',
    accent: '#059669',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    success: '#22c55e',
    gradient: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5']
};

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
    initializeDateRange();
    loadAllData();
    
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

    // Date range inputs
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    if (startDate && endDate) {
        startDate.addEventListener('change', validateDateRange);
        endDate.addEventListener('change', validateDateRange);
    }
}

function initializeDateRange() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    document.getElementById('startDate').value = startOfMonth.toISOString().split('T')[0];
    document.getElementById('endDate').value = today.toISOString().split('T')[0];
    
    currentDateRange = {
        start: startOfMonth,
        end: today
    };
}

function validateDateRange() {
    const startDate = new Date(document.getElementById('startDate').value);
    const endDate = new Date(document.getElementById('endDate').value);
    
    if (startDate > endDate) {
        showNotification('Start date cannot be after end date', 'error');
        return false;
    }
    
    if (endDate > new Date()) {
        showNotification('End date cannot be in the future', 'error');
        return false;
    }
    
    return true;
}

async function loadAllData() {
    showLoading(true);
    
    try {
        // Load all necessary data
        await Promise.all([
            loadStudentsData(),
            loadPrescriptionsData(),
            loadDoseRecordsData(),
            loadStockData()
        ]);
        
        // Generate analytics after all data is loaded
        await loadAnalytics();
        
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification('Error loading analytics data', 'error');
    } finally {
        showLoading(false);
    }
}

async function loadStudentsData() {
    try {
        const snapshot = await getDocs(collection(db, 'students'));
        allStudents = [];
        snapshot.forEach((doc) => {
            allStudents.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

async function loadPrescriptionsData() {
    try {
        const snapshot = await getDocs(collection(db, 'prescriptions'));
        allPrescriptions = [];
        snapshot.forEach((doc) => {
            allPrescriptions.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Error loading prescriptions:', error);
    }
}

async function loadDoseRecordsData() {
    try {
        const snapshot = await getDocs(collection(db, 'dose_records'));
        allDoseRecords = [];
        snapshot.forEach((doc) => {
            allDoseRecords.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Error loading dose records:', error);
    }
}

async function loadStockData() {
    try {
        const snapshot = await getDocs(collection(db, 'stocks'));
        allStockData = [];
        snapshot.forEach((doc) => {
            allStockData.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error('Error loading stock data:', error);
    }
}

function setDateRange(period) {
    const today = new Date();
    let startDate;
    
    switch (period) {
        case 'today':
            startDate = new Date(today);
            break;
        case 'week':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 7);
            break;
        case 'month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            break;
        case 'quarter':
            startDate = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
            break;
        case 'year':
            startDate = new Date(today.getFullYear(), 0, 1);
            break;
        default:
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    
    document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
    document.getElementById('endDate').value = today.toISOString().split('T')[0];
    
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    currentDateRange = { start: startDate, end: today };
    loadAnalytics();
}

async function loadAnalytics() {
    if (!validateDateRange()) return;
    
    showLoading(true);
    
    try {
        // Update date range from inputs
        currentDateRange = {
            start: new Date(document.getElementById('startDate').value),
            end: new Date(document.getElementById('endDate').value + 'T23:59:59')
        };
        
        // Generate all analytics
        await Promise.all([
            generateKeyMetrics(),
            generateVisitsChart(),
            generateDiseasesChart(),
            generateMedicationChart(),
            generateAgeGroupChart(),
            generateHouseHealthChart(),
            generateRecoveryTimeChart(),
            generateDetailedTables(),
            generateHealthAlerts()
        ]);
        
    } catch (error) {
        console.error('Error generating analytics:', error);
        showNotification('Error generating analytics', 'error');
    } finally {
        showLoading(false);
    }
}

function getFilteredData() {
    const startTime = currentDateRange.start.getTime();
    const endTime = currentDateRange.end.getTime();
    
    // Filter data based on date range
    const filteredPrescriptions = allPrescriptions.filter(prescription => {
        const createdAt = prescription.createdAt?.toDate?.() || new Date(prescription.createdAt);
        return createdAt.getTime() >= startTime && createdAt.getTime() <= endTime;
    });
    
    const filteredDoseRecords = allDoseRecords.filter(dose => {
        const date = dose.date?.toDate?.() || new Date(dose.date);
        return date.getTime() >= startTime && date.getTime() <= endTime;
    });
    
    return { filteredPrescriptions, filteredDoseRecords };
}

async function generateKeyMetrics() {
    const { filteredPrescriptions, filteredDoseRecords } = getFilteredData();
    
    // Calculate metrics
    const totalVisits = filteredPrescriptions.length;
    const uniqueDiseases = new Set(filteredPrescriptions.map(p => p.condition || p.diagnosis || 'Unknown')).size;
    const totalMedications = filteredDoseRecords.filter(d => d.status === 'taken').length;
    const recoveryRate = calculateRecoveryRate(filteredPrescriptions);
    
    // Calculate changes from previous period
    const previousPeriodData = getPreviousPeriodData();
    const visitsChange = calculatePercentageChange(totalVisits, previousPeriodData.visits);
    const diseasesChange = calculatePercentageChange(uniqueDiseases, previousPeriodData.diseases);
    const medicationsChange = calculatePercentageChange(totalMedications, previousPeriodData.medications);
    const recoveryChange = calculatePercentageChange(recoveryRate, previousPeriodData.recovery);
    
    // Update UI with animations
    animateCounter('totalVisits', totalVisits);
    animateCounter('uniqueDiseases', uniqueDiseases);
    animateCounter('totalMedications', totalMedications);
    animateCounter('recoveryRate', recoveryRate, '%');
    
    updateChangeIndicator('visitsChange', visitsChange);
    updateChangeIndicator('diseasesChange', diseasesChange);
    updateChangeIndicator('medicationsChange', medicationsChange);
    updateChangeIndicator('recoveryChange', recoveryChange);
}

function calculateRecoveryRate(prescriptions) {
    const completedPrescriptions = prescriptions.filter(p => p.status === 'completed').length;
    return prescriptions.length > 0 ? Math.round((completedPrescriptions / prescriptions.length) * 100) : 0;
}

function getPreviousPeriodData() {
    const periodLength = currentDateRange.end.getTime() - currentDateRange.start.getTime();
    const previousStart = new Date(currentDateRange.start.getTime() - periodLength);
    const previousEnd = new Date(currentDateRange.start.getTime());
    
    const previousPrescriptions = allPrescriptions.filter(prescription => {
        const createdAt = prescription.createdAt?.toDate?.() || new Date(prescription.createdAt);
        return createdAt.getTime() >= previousStart.getTime() && createdAt.getTime() <= previousEnd.getTime();
    });
    
    const previousDoseRecords = allDoseRecords.filter(dose => {
        const date = dose.date?.toDate?.() || new Date(dose.date);
        return date.getTime() >= previousStart.getTime() && date.getTime() <= previousEnd.getTime();
    });
    
    return {
        visits: previousPrescriptions.length,
        diseases: new Set(previousPrescriptions.map(p => p.condition || p.diagnosis || 'Unknown')).size,
        medications: previousDoseRecords.filter(d => d.status === 'taken').length,
        recovery: calculateRecoveryRate(previousPrescriptions)
    };
}

function calculatePercentageChange(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
}

function animateCounter(elementId, targetValue, suffix = '') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    let currentValue = 0;
    const increment = targetValue / 50;
    const duration = 1000;
    const stepTime = duration / 50;
    
    const timer = setInterval(() => {
        currentValue += increment;
        if (currentValue >= targetValue) {
            currentValue = targetValue;
            clearInterval(timer);
        }
        element.textContent = Math.round(currentValue) + suffix;
    }, stepTime);
}

function updateChangeIndicator(elementId, change) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.textContent = `${change >= 0 ? '+' : ''}${change}%`;
    element.className = 'metric-change ' + (change >= 0 ? 'positive' : 'negative');
}

async function generateVisitsChart() {
    const { filteredPrescriptions } = getFilteredData();
    const chartType = document.getElementById('visitsChartType')?.value || 'daily';
    
    // Group data by time period
    const groupedData = groupDataByTimePeriod(filteredPrescriptions, chartType);
    
    const ctx = document.getElementById('visitsChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (charts.visits) {
        charts.visits.destroy();
    }
    
    charts.visits = new Chart(ctx, {
        type: 'line',
        data: {
            labels: groupedData.labels,
            datasets: [{
                label: 'Visits',
                data: groupedData.data,
                borderColor: chartColors.primary,
                backgroundColor: chartColors.primary + '20',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: chartColors.primary,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#d1d5db'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#d1d5db'
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutCubic'
            }
        }
    });
}

async function generateDiseasesChart() {
    const { filteredPrescriptions } = getFilteredData();
    const limit = parseInt(document.getElementById('diseasesLimit')?.value || '5');
    
    // Count diseases/conditions
    const diseaseCount = {};
    filteredPrescriptions.forEach(prescription => {
        const condition = prescription.condition || prescription.diagnosis || 'Unknown';
        diseaseCount[condition] = (diseaseCount[condition] || 0) + 1;
    });
    
    // Get top diseases
    const sortedDiseases = Object.entries(diseaseCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit);
    
    const ctx = document.getElementById('diseasesChart');
    if (!ctx) return;
    
    if (charts.diseases) {
        charts.diseases.destroy();
    }
    
    charts.diseases = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedDiseases.map(([disease]) => disease),
            datasets: [{
                data: sortedDiseases.map(([, count]) => count),
                backgroundColor: chartColors.gradient.slice(0, sortedDiseases.length),
                borderColor: '#1f2937',
                borderWidth: 2,
                hoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#d1d5db',
                        padding: 15,
                        usePointStyle: true
                    }
                }
            },
            animation: {
                animateRotate: true,
                duration: 1500
            }
        }
    });
}

async function generateMedicationChart() {
    const { filteredDoseRecords } = getFilteredData();
    const view = document.getElementById('medicationView')?.value || 'frequency';
    
    let medicationData = {};
    
    if (view === 'frequency') {
        // Count prescription frequency
        filteredDoseRecords.forEach(dose => {
            const medication = dose.drugName || 'Unknown';
            medicationData[medication] = (medicationData[medication] || 0) + 1;
        });
    } else if (view === 'quantity') {
        // Sum quantities
        filteredDoseRecords.forEach(dose => {
            const medication = dose.drugName || 'Unknown';
            const quantity = parseDosageAmount(dose.dosage) || 1;
            medicationData[medication] = (medicationData[medication] || 0) + quantity;
        });
    } else if (view === 'category') {
        // Group by category from stock data
        const categoryMap = {};
        allStockData.forEach(stock => {
            categoryMap[stock.name] = stock.category || 'Other';
        });
        
        filteredDoseRecords.forEach(dose => {
            const category = categoryMap[dose.drugName] || 'Other';
            medicationData[category] = (medicationData[category] || 0) + 1;
        });
    }
    
    const sortedMedications = Object.entries(medicationData)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
    
    const ctx = document.getElementById('medicationChart');
    if (!ctx) return;
    
    if (charts.medication) {
        charts.medication.destroy();
    }
    
    charts.medication = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedMedications.map(([med]) => med),
            datasets: [{
                label: view === 'frequency' ? 'Times Prescribed' : view === 'quantity' ? 'Total Quantity' : 'Prescriptions',
                data: sortedMedications.map(([, count]) => count),
                backgroundColor: chartColors.gradient,
                borderColor: chartColors.primary,
                borderWidth: 1,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#d1d5db'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#d1d5db',
                        maxRotation: 45
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutBounce'
            }
        }
    });
}

async function generateAgeGroupChart() {
    const ageGroups = {
        '13-15': 0,
        '16-18': 0,
        '19-21': 0,
        '22+': 0
    };
    
    allStudents.forEach(student => {
        const age = calculateAge(student.dateOfBirth);
        if (age <= 15) ageGroups['13-15']++;
        else if (age <= 18) ageGroups['16-18']++;
        else if (age <= 21) ageGroups['19-21']++;
        else ageGroups['22+']++;
    });
    
    const ctx = document.getElementById('ageGroupChart');
    if (!ctx) return;
    
    if (charts.ageGroup) {
        charts.ageGroup.destroy();
    }
    
    charts.ageGroup = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: Object.keys(ageGroups),
            datasets: [{
                data: Object.values(ageGroups),
                backgroundColor: chartColors.gradient,
                borderColor: '#1f2937',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#d1d5db',
                        padding: 15
                    }
                }
            },
            scales: {
                r: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#d1d5db'
                    }
                }
            }
        }
    });
}

async function generateHouseHealthChart() {
    const houses = ['Kabalega', 'Lubambula', 'Lumumba', 'Mboya', 'Muteesa', 'Muyingo', 'Walusimbi'];
    const { filteredPrescriptions } = getFilteredData();
    
    const houseData = {};
    houses.forEach(house => {
        houseData[house] = 0;
    });
    
    // Count visits by house
    filteredPrescriptions.forEach(prescription => {
        const student = allStudents.find(s => s.id === prescription.studentId);
        if (student && student.house) {
            houseData[student.house] = (houseData[student.house] || 0) + 1;
        }
    });
    
    const ctx = document.getElementById('houseHealthChart');
    if (!ctx) return;
    
    if (charts.houseHealth) {
        charts.houseHealth.destroy();
    }
    
    charts.houseHealth = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: houses,
            datasets: [{
                label: 'Health Visits',
                data: houses.map(house => houseData[house]),
                borderColor: chartColors.primary,
                backgroundColor: chartColors.primary + '30',
                borderWidth: 3,
                pointBackgroundColor: chartColors.primary,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    pointLabels: {
                        color: '#d1d5db'
                    },
                    ticks: {
                        color: '#d1d5db'
                    }
                }
            }
        }
    });
}

async function generateRecoveryTimeChart() {
    const { filteredPrescriptions } = getFilteredData();
    
    const recoveryTimes = {
        '1-3 days': 0,
        '4-7 days': 0,
        '1-2 weeks': 0,
        '2+ weeks': 0
    };
    
    filteredPrescriptions.filter(p => p.status === 'completed').forEach(prescription => {
        const startDate = prescription.startDate?.toDate?.() || new Date(prescription.startDate);
        const completedDate = prescription.completedAt?.toDate?.() || new Date(prescription.completedAt);
        const daysDiff = Math.ceil((completedDate - startDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 3) recoveryTimes['1-3 days']++;
        else if (daysDiff <= 7) recoveryTimes['4-7 days']++;
        else if (daysDiff <= 14) recoveryTimes['1-2 weeks']++;
        else recoveryTimes['2+ weeks']++;
    });
    
    const ctx = document.getElementById('recoveryTimeChart');
    if (!ctx) return;
    
    if (charts.recoveryTime) {
        charts.recoveryTime.destroy();
    }
    
    charts.recoveryTime = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(recoveryTimes),
            datasets: [{
                label: 'Number of Cases',
                data: Object.values(recoveryTimes),
                backgroundColor: chartColors.gradient,
                borderColor: chartColors.primary,
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#d1d5db'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#d1d5db'
                    }
                }
            }
        }
    });
}

function groupDataByTimePeriod(data, period) {
    const grouped = {};
    const labels = [];
    const values = [];
    
    data.forEach(item => {
        const date = item.createdAt?.toDate?.() || new Date(item.createdAt);
        let key;
        
        if (period === 'daily') {
            key = date.toISOString().split('T')[0];
        } else if (period === 'weekly') {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().split('T')[0];
        } else if (period === 'monthly') {
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
        
        grouped[key] = (grouped[key] || 0) + 1;
    });
    
    // Fill in missing dates/periods with 0
    const sortedKeys = Object.keys(grouped).sort();
    const startDate = new Date(currentDateRange.start);
    const endDate = new Date(currentDateRange.end);
    
    for (let d = new Date(startDate); d <= endDate; ) {
        let key;
        if (period === 'daily') {
            key = d.toISOString().split('T')[0];
            d.setDate(d.getDate() + 1);
        } else if (period === 'weekly') {
            key = d.toISOString().split('T')[0];
            d.setDate(d.getDate() + 7);
        } else if (period === 'monthly') {
            key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            d.setMonth(d.getMonth() + 1);
        }
        
        labels.push(formatDateLabel(key, period));
        values.push(grouped[key] || 0);
    }
    
    return { labels, data: values };
}

function formatDateLabel(dateStr, period) {
    if (period === 'daily') {
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (period === 'weekly') {
        return `Week of ${new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } else if (period === 'monthly') {
        const [year, month] = dateStr.split('-');
        return new Date(year, month - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    }
    return dateStr;
}

function parseDosageAmount(dosageString) {
    if (!dosageString) return 1;
    const match = dosageString.match(/(\d+)/);
    return match ? parseInt(match[1]) : 1;
}

function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return 0;
    const birth = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

async function generateDetailedTables() {
    generateConditionsTable();
    generateMedicationTable();
    generatePatternsTable();
}

function generateConditionsTable() {
    const { filteredPrescriptions } = getFilteredData();
    const conditionStats = {};
    
    filteredPrescriptions.forEach(prescription => {
        const condition = prescription.condition || prescription.diagnosis || 'Unknown';
        if (!conditionStats[condition]) {
            conditionStats[condition] = {
                cases: 0,
                recoveryTimes: [],
                ageGroups: { '13-15': 0, '16-18': 0, '19-21': 0, '22+': 0 },
                months: {}
            };
        }
        
        conditionStats[condition].cases++;
        
        // Calculate recovery time if completed
        if (prescription.status === 'completed') {
            const startDate = prescription.startDate?.toDate?.() || new Date(prescription.startDate);
            const completedDate = prescription.completedAt?.toDate?.() || new Date(prescription.completedAt);
            const recoveryDays = Math.ceil((completedDate - startDate) / (1000 * 60 * 60 * 24));
            conditionStats[condition].recoveryTimes.push(recoveryDays);
        }
        
        // Track age groups and seasonal patterns
        const student = allStudents.find(s => s.id === prescription.studentId);
        if (student) {
            const age = calculateAge(student.dateOfBirth);
            if (age <= 15) conditionStats[condition].ageGroups['13-15']++;
            else if (age <= 18) conditionStats[condition].ageGroups['16-18']++;
            else if (age <= 21) conditionStats[condition].ageGroups['19-21']++;
            else conditionStats[condition].ageGroups['22+']++;
        }
        
        const month = (prescription.createdAt?.toDate?.() || new Date(prescription.createdAt)).toLocaleDateString('en-US', { month: 'long' });
        conditionStats[condition].months[month] = (conditionStats[condition].months[month] || 0) + 1;
    });
    
    const tbody = document.getElementById('conditionsTableBody');
    if (!tbody) return;
    
    const totalCases = filteredPrescriptions.length;
    const sortedConditions = Object.entries(conditionStats)
        .sort(([,a], [,b]) => b.cases - a.cases);
    
    tbody.innerHTML = sortedConditions.map(([condition, stats]) => {
        const percentage = ((stats.cases / totalCases) * 100).toFixed(1);
        const avgRecoveryTime = stats.recoveryTimes.length > 0 
            ? (stats.recoveryTimes.reduce((a, b) => a + b, 0) / stats.recoveryTimes.length).toFixed(1)
            : 'N/A';
        
        const mostAffectedAge = Object.entries(stats.ageGroups)
            .sort(([,a], [,b]) => b - a)[0][0];
        
        const mostCommonMonth = Object.entries(stats.months)
            .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';
        
        return `
            <tr class="table-row">
                <td class="condition-name">${condition}</td>
                <td class="cases-count">${stats.cases}</td>
                <td class="percentage">${percentage}%</td>
                <td class="recovery-time">${avgRecoveryTime} days</td>
                <td class="age-group">${mostAffectedAge}</td>
                <td class="seasonal-pattern">${mostCommonMonth}</td>
            </tr>
        `;
    }).join('');
}

function generateMedicationTable() {
    const { filteredDoseRecords } = getFilteredData();
    const medicationStats = {};
    
    filteredDoseRecords.forEach(dose => {
        const medication = dose.drugName || 'Unknown';
        if (!medicationStats[medication]) {
            medicationStats[medication] = {
                prescribed: 0,
                taken: 0,
                totalQuantity: 0,
                conditions: {}
            };
        }
        
        medicationStats[medication].prescribed++;
        if (dose.status === 'taken') {
            medicationStats[medication].taken++;
        }
        
        const quantity = parseDosageAmount(dose.dosage) || 1;
        medicationStats[medication].totalQuantity += quantity;
        
        // Track conditions this medication is used for
        const prescription = allPrescriptions.find(p => p.id === dose.prescriptionId);
        if (prescription) {
            const condition = prescription.condition || prescription.diagnosis || 'Unknown';
            medicationStats[medication].conditions[condition] = (medicationStats[medication].conditions[condition] || 0) + 1;
        }
    });
    
    const tbody = document.getElementById('medicationTableBody');
    if (!tbody) return;
    
    const sortedMedications = Object.entries(medicationStats)
        .sort(([,a], [,b]) => b.prescribed - a.prescribed);
    
    tbody.innerHTML = sortedMedications.map(([medication, stats]) => {
        const effectivenessRate = stats.prescribed > 0 
            ? ((stats.taken / stats.prescribed) * 100).toFixed(1)
            : '0';
        
        const stockItem = allStockData.find(s => s.name === medication);
        const stockImpact = stockItem 
            ? `${((stats.totalQuantity / stockItem.quantity) * 100).toFixed(1)}% of stock`
            : 'Not tracked';
        
        const commonConditions = Object.entries(stats.conditions)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([condition]) => condition)
            .join(', ');
        
        return `
            <tr class="table-row">
                <td class="medication-name">${medication}</td>
                <td class="prescribed-count">${stats.prescribed}</td>
                <td class="quantity-count">${stats.totalQuantity}</td>
                <td class="stock-impact">${stockImpact}</td>
                <td class="effectiveness-rate">${effectivenessRate}%</td>
                <td class="common-conditions">${commonConditions || 'N/A'}</td>
            </tr>
        `;
    }).join('');
}

function generatePatternsTable() {
    const patterns = analyzeHealthPatterns();
    const tbody = document.getElementById('patternsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = patterns.map(pattern => `
        <tr class="table-row">
            <td class="pattern-name">${pattern.name}</td>
            <td class="pattern-description">${pattern.description}</td>
            <td class="pattern-frequency">${pattern.frequency}</td>
            <td class="risk-level ${pattern.riskLevel.toLowerCase()}">${pattern.riskLevel}</td>
            <td class="recommended-action">${pattern.recommendation}</td>
        </tr>
    `).join('');
}

function analyzeHealthPatterns() {
    const { filteredPrescriptions } = getFilteredData();
    const patterns = [];
    
    // Analyze seasonal patterns
    const monthlyData = {};
    filteredPrescriptions.forEach(prescription => {
        const month = (prescription.createdAt?.toDate?.() || new Date(prescription.createdAt)).getMonth();
        monthlyData[month] = (monthlyData[month] || 0) + 1;
    });
    
    const peakMonth = Object.entries(monthlyData).sort(([,a], [,b]) => b - a)[0];
    if (peakMonth && peakMonth[1] > 0) {
        const monthName = new Date(2023, peakMonth[0]).toLocaleDateString('en-US', { month: 'long' });
        patterns.push({
            name: 'Seasonal Peak',
            description: `Higher health issues in ${monthName}`,
            frequency: `${peakMonth[1]} cases`,
            riskLevel: 'Medium',
            recommendation: 'Increase preventive measures during this period'
        });
    }
    
    // Analyze house patterns
    const houseData = {};
    filteredPrescriptions.forEach(prescription => {
        const student = allStudents.find(s => s.id === prescription.studentId);
        if (student && student.house) {
            houseData[student.house] = (houseData[student.house] || 0) + 1;
        }
    });
    
    const highestHouse = Object.entries(houseData).sort(([,a], [,b]) => b - a)[0];
    if (highestHouse && highestHouse[1] > 0) {
        patterns.push({
            name: 'House Health Disparity',
            description: `${highestHouse[0]} house shows higher health issues`,
            frequency: `${highestHouse[1]} cases`,
            riskLevel: 'Medium',
            recommendation: 'Investigate environmental factors in dormitory'
        });
    }
    
    // Analyze medication compliance
    const complianceData = allDoseRecords.filter(d => {
        const doseDate = d.date?.toDate?.() || new Date(d.date);
        return doseDate >= currentDateRange.start && doseDate <= currentDateRange.end;
    });
    const missedDoses = complianceData.filter(d => d.status === 'missed').length;
    const totalDoses = complianceData.length;
    
    if (totalDoses > 0) {
        const missedPercentage = (missedDoses / totalDoses * 100).toFixed(1);
        if (missedPercentage > 20) {
            patterns.push({
                name: 'Low Medication Compliance',
                description: `${missedPercentage}% of doses are being missed`,
                frequency: `${missedDoses} missed doses`,
                riskLevel: 'High',
                recommendation: 'Implement medication reminder system'
            });
        }
    }
    
    return patterns;
}

async function generateHealthAlerts() {
    const alertsContainer = document.getElementById('healthAlerts');
    if (!alertsContainer) return;
    
    const alerts = [];
    const { filteredPrescriptions, filteredDoseRecords } = getFilteredData();
    
    // Stock alerts
    const lowStockItems = allStockData.filter(stock => 
        stock.quantity <= (stock.lowStockThreshold || 20)
    );
    
    if (lowStockItems.length > 0) {
        alerts.push({
            type: 'stock',
            level: 'warning',
            title: 'Low Stock Alert',
            message: `${lowStockItems.length} medications are running low`,
            action: 'Review stock levels and reorder'
        });
    }
    
    // High frequency conditions
    const conditionCounts = {};
    filteredPrescriptions.forEach(prescription => {
        const condition = prescription.condition || prescription.diagnosis || 'Unknown';
        conditionCounts[condition] = (conditionCounts[condition] || 0) + 1;
    });
    
    const topCondition = Object.entries(conditionCounts).sort(([,a], [,b]) => b - a)[0];
    if (topCondition && topCondition[1] > filteredPrescriptions.length * 0.3) {
        alerts.push({
            type: 'outbreak',
            level: 'danger',
            title: 'Potential Outbreak',
            message: `${topCondition[0]} accounts for ${topCondition[1]} cases (${((topCondition[1]/filteredPrescriptions.length)*100).toFixed(1)}%)`,
            action: 'Consider preventive measures and monitoring'
        });
    }
    
    // Compliance issues
    const missedDoses = filteredDoseRecords.filter(d => d.status === 'missed').length;
    const totalDoses = filteredDoseRecords.length;
    
    if (totalDoses > 0 && (missedDoses / totalDoses) > 0.25) {
        alerts.push({
            type: 'compliance',
            level: 'warning',
            title: 'Medication Compliance Issue',
            message: `${((missedDoses/totalDoses)*100).toFixed(1)}% of doses are being missed`,
            action: 'Implement reminder systems and follow-up protocols'
        });
    }
    
    alertsContainer.innerHTML = alerts.map(alert => `
        <div class="health-alert ${alert.level}">
            <div class="alert-icon">
                <i class="fas ${getAlertIcon(alert.type)}"></i>
            </div>
            <div class="alert-content">
                <h4>${alert.title}</h4>
                <p>${alert.message}</p>
                <span class="alert-action">${alert.action}</span>
            </div>
        </div>
    `).join('');
    
    if (alerts.length === 0) {
        alertsContainer.innerHTML = `
            <div class="health-alert success">
                <div class="alert-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="alert-content">
                    <h4>All Systems Normal</h4>
                    <p>No health alerts or concerns detected</p>
                    <span class="alert-action">Continue monitoring</span>
                </div>
            </div>
        `;
    }
}

function getAlertIcon(type) {
    switch (type) {
        case 'stock': return 'fa-boxes';
        case 'outbreak': return 'fa-exclamation-triangle';
        case 'compliance': return 'fa-clock';
        default: return 'fa-info-circle';
    }
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function updateVisitsChart() {
    generateVisitsChart();
}

function updateDiseasesChart() {
    generateDiseasesChart();
}

function updateMedicationChart() {
    generateMedicationChart();
}

function exportReport() {
    showNotification('Generating report...', 'info');
    
    // Create a comprehensive report
    const reportData = {
        dateRange: currentDateRange,
        metrics: {
            totalVisits: document.getElementById('totalVisits').textContent,
            uniqueDiseases: document.getElementById('uniqueDiseases').textContent,
            totalMedications: document.getElementById('totalMedications').textContent,
            recoveryRate: document.getElementById('recoveryRate').textContent
        },
        timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sickbay-analytics-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Report exported successfully', 'success');
}

function exportTable(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    let csv = '';
    const rows = table.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cols = row.querySelectorAll('th, td');
        const rowData = Array.from(cols).map(col => `"${col.textContent.replace(/"/g, '""')}"`);
        csv += rowData.join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableId}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Table exported successfully', 'success');
}

// Export functions for global access
window.setDateRange = setDateRange;
window.loadAnalytics = loadAnalytics;
window.updateVisitsChart = updateVisitsChart;
window.updateDiseasesChart = updateDiseasesChart;
window.updateMedicationChart = updateMedicationChart;
window.exportReport = exportReport;
window.exportTable = exportTable;

// Date range picker integration
window.loadAnalytics = function() {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;
  loadAnalytics(start, end);
};

// Quick filters
window.setDateRange = function(type) {
  const today = new Date();
  let start, end;
  end = today.toISOString().split("T")[0];
  switch (type) {
    case "today":
      start = end;
      break;
    case "week":
      start = new Date(today.setDate(today.getDate() - 6)).toISOString().split("T")[0];
      break;
    case "month":
      start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
      break;
    case "quarter":
      const quarter = Math.floor((today.getMonth() + 3) / 3);
      start = new Date(today.getFullYear(), (quarter - 1) * 3, 1).toISOString().split("T")[0];
      break;
    case "year":
      start = new Date(today.getFullYear(), 0, 1).toISOString().split("T")[0];
      break;
    default:
      start = "";
  }
  document.getElementById("startDate").value = start;
  document.getElementById("endDate").value = end;
  loadAnalytics(start, end);
};

// Auto-load analytics for this month on page load
document.addEventListener("DOMContentLoaded", () => {
  window.setDateRange('month');
});