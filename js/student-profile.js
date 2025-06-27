// Student profile functionality
import { db } from './firebase-config.js';
import { 
    doc, 
    getDoc, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    orderBy,
    Timestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Import stock management functions
let getAvailableDrugs;
try {
    const stockModule = await import('./stocks.js');
    getAvailableDrugs = stockModule.getAvailableDrugs;
} catch (error) {
    console.log('Stock module not available, continuing without stock integration');
}

// Global variables
let currentStudent = null;
let currentStudentId = null;

// Initialize student profile page
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentStudentId = urlParams.get('id');
    
    if (!currentStudentId) {
        window.location.href = 'students.html';
        return;
    }
    
    await loadStudentProfile();
    await loadStudentData();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    const addPrescriptionForm = document.getElementById('addPrescriptionForm');
    
    if (addPrescriptionForm) {
        addPrescriptionForm.addEventListener('submit', handleAddPrescription);
    }
}

// Load student profile information
async function loadStudentProfile() {
    try {
        const studentDoc = await getDoc(doc(db, 'students', currentStudentId));
        
        if (!studentDoc.exists()) {
            showError('Student not found');
            window.location.href = 'students.html';
            return;
        }
        
        currentStudent = { id: studentDoc.id, ...studentDoc.data() };
        
        // Update UI with student information
        document.getElementById('studentName').textContent = currentStudent.name;
        document.getElementById('studentNameBreadcrumb').textContent = currentStudent.name;
        document.getElementById('studentDetails').textContent = `${currentStudent.class} • ${currentStudent.house}`;
        document.getElementById('studentClass').textContent = currentStudent.class;
        document.getElementById('studentHouse').textContent = currentStudent.house;
        document.getElementById('parentContact').textContent = currentStudent.parentContact || 'Not provided';
        document.getElementById('medicalInfo').textContent = currentStudent.medicalInfo || 'No medical information available';
        
        // Update prescription form
        const prescriptionStudentInput = document.getElementById('prescriptionStudent');
        if (prescriptionStudentInput) {
            prescriptionStudentInput.value = currentStudent.name;
        }
        
    } catch (error) {
        console.error('Error loading student profile:', error);
        showError('Failed to load student profile');
    }
}

// Load student-related data (prescriptions, visits, etc.)
async function loadStudentData() {
    try {
        await Promise.all([
            loadStudentStats(),
            loadMedicalHistory(),
            loadStudentPrescriptions(),
            loadAnalytics()
        ]);
    } catch (error) {
        console.error('Error loading student data:', error);
    }
}

// Load student statistics
async function loadStudentStats() {
    try {
        // Get prescriptions for this student
        const prescriptionsSnapshot = await getDocs(
            query(
                collection(db, 'prescriptions'),
                where('studentId', '==', currentStudentId)
            )
        );
        
        const totalVisits = prescriptionsSnapshot.size;
        
        // Get active prescriptions
        const activePrescriptionsSnapshot = await getDocs(
            query(
                collection(db, 'prescriptions'),
                where('studentId', '==', currentStudentId),
                where('status', '==', 'active')
            )
        );
        
        const activePrescriptions = activePrescriptionsSnapshot.size;
        
        // Get completed treatments
        const completedTreatmentsSnapshot = await getDocs(
            query(
                collection(db, 'prescriptions'),
                where('studentId', '==', currentStudentId),
                where('status', '==', 'completed')
            )
        );
        
        const completedTreatments = completedTreatmentsSnapshot.size;
        
        // Update UI
        document.getElementById('totalVisits').textContent = totalVisits;
        document.getElementById('activePrescriptions').textContent = activePrescriptions;
        document.getElementById('completedTreatments').textContent = completedTreatments;
        
    } catch (error) {
        console.error('Error loading student stats:', error);
        // Set default values on error
        document.getElementById('totalVisits').textContent = '0';
        document.getElementById('activePrescriptions').textContent = '0';
        document.getElementById('completedTreatments').textContent = '0';
    }
}

// Load medical history
async function loadMedicalHistory() {
    try {
        const historyContainer = document.getElementById('medicalHistory');
        
        // Get prescriptions as medical history
        const prescriptionsSnapshot = await getDocs(
            query(
                collection(db, 'prescriptions'),
                where('studentId', '==', currentStudentId),
                orderBy('createdAt', 'desc')
            )
        );
        
        if (prescriptionsSnapshot.empty) {
            historyContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <p>No medical history available</p>
                </div>
            `;
            return;
        }
        
        const historyItems = [];
        prescriptionsSnapshot.forEach((doc) => {
            historyItems.push({ id: doc.id, ...doc.data() });
        });
        
        historyContainer.innerHTML = historyItems.map(item => `
            <div class="history-item">
                <div class="history-date">
                    ${formatDate(item.createdAt)}
                </div>
                <div class="history-content">
                    <h4>${item.drugName}</h4>
                    <p>Dosage: ${item.dosage} for ${item.duration} days</p>
                    <p>Status: <span class="status-badge status-${item.status}">${item.status}</span></p>
                    ${item.notes ? `<p>Notes: ${item.notes}</p>` : ''}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading medical history:', error);
        const historyContainer = document.getElementById('medicalHistory');
        historyContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading medical history</p>
            </div>
        `;
    }
}

// Load student prescriptions
async function loadStudentPrescriptions() {
    try {
        const prescriptionsContainer = document.getElementById('studentPrescriptions');
        
        // Get active prescriptions
        const prescriptionsSnapshot = await getDocs(
            query(
                collection(db, 'prescriptions'),
                where('studentId', '==', currentStudentId),
                where('status', '==', 'active'),
                orderBy('createdAt', 'desc')
            )
        );
        
        if (prescriptionsSnapshot.empty) {
            prescriptionsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-prescription-bottle-alt"></i>
                    <p>No active prescriptions</p>
                </div>
            `;
            return;
        }
        
        const prescriptions = [];
        prescriptionsSnapshot.forEach((doc) => {
            prescriptions.push({ id: doc.id, ...doc.data() });
        });
        
        prescriptionsContainer.innerHTML = prescriptions.map(prescription => `
            <div class="prescription-card">
                <div class="prescription-header">
                    <h4>${prescription.drugName}</h4>
                    <span class="prescription-status status-${prescription.status}">
                        ${prescription.status}
                    </span>
                </div>
                <div class="prescription-details">
                    <p><strong>Dosage:</strong> ${prescription.dosage}</p>
                    <p><strong>Duration:</strong> ${prescription.duration} days</p>
                    <p><strong>Started:</strong> ${formatDate(prescription.createdAt)}</p>
                    ${prescription.notes ? `<p><strong>Notes:</strong> ${prescription.notes}</p>` : ''}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading student prescriptions:', error);
        const prescriptionsContainer = document.getElementById('studentPrescriptions');
        prescriptionsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading prescriptions</p>
            </div>
        `;
    }
}

// Load analytics charts
async function loadAnalytics() {
    try {
        const visitChart = document.getElementById('visitChart');
        const complianceChart = document.getElementById('complianceChart');
        
        if (visitChart) {
            const ctx = visitChart.getContext('2d');
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, 0, visitChart.width, visitChart.height);
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('Visit Frequency Chart', visitChart.width / 2, visitChart.height / 2);
        }
        
        if (complianceChart) {
            const ctx = complianceChart.getContext('2d');
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, 0, complianceChart.width, complianceChart.height);
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('Treatment Compliance Chart', complianceChart.width / 2, complianceChart.height / 2);
        }
        
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// Switch tabs
function switchTab(tabName) {
    // Remove active class from all tabs and panes
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    
    // Add active class to selected tab and pane
    event.target.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
}

// Show add prescription modal
function showAddPrescriptionModal() {
    const modal = document.getElementById('addPrescriptionModal');
    if (modal) {
        modal.style.display = 'block';
        document.getElementById('addPrescriptionForm').reset();
        document.getElementById('prescriptionStudent').value = currentStudent.name;
        
        // Populate drug dropdown with available stock
        populateDrugDropdown();
    }
}

// Populate drug dropdown with available drugs from stock
async function populateDrugDropdown() {
    const drugSelect = document.getElementById('drugName');
    if (!drugSelect || !getAvailableDrugs) return;
    
    try {
        const availableDrugs = getAvailableDrugs();
        
        // Clear existing options except the first placeholder
        drugSelect.innerHTML = '<option value="">Select Drug</option>';
        
        // Add available drugs to dropdown
        availableDrugs.forEach(drug => {
            const option = document.createElement('option');
            option.value = drug.name;
            option.textContent = `${drug.name} (${drug.quantity} ${drug.unit || 'units'} available)`;
            drugSelect.appendChild(option);
        });
        
        if (availableDrugs.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No drugs available in stock';
            option.disabled = true;
            drugSelect.appendChild(option);
        }
        
    } catch (error) {
        console.error('Error loading available drugs:', error);
        // Fall back to manual entry
        drugSelect.innerHTML = '<option value="">Enter drug name manually</option>';
    }
}

// Close add prescription modal
function closeAddPrescriptionModal() {
    const modal = document.getElementById('addPrescriptionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Handle add prescription form submission
async function handleAddPrescription(e) {
    e.preventDefault();
    
    const formData = {
        studentId: currentStudentId,
        studentName: currentStudent.name,
        drugName: document.getElementById('drugName').value,
        duration: parseInt(document.getElementById('duration').value),
        dosage: document.getElementById('dosage').value,
        notes: document.getElementById('prescriptionNotes').value.trim(),
        status: 'active',
        createdAt: Timestamp.now(),
        startDate: Timestamp.now()
    };
    
    try {
        // Validate required fields
        if (!formData.drugName || !formData.duration || !formData.dosage) {
            showError('Please fill in all required fields.');
            return;
        }
        
        // Add prescription to Firestore
        const prescriptionRef = await addDoc(collection(db, 'prescriptions'), formData);
        
        // Create dose records for the prescription
        await createDoseRecords(prescriptionRef.id, formData);
        
        // Reload student data and close modal
        await loadStudentData();
        closeAddPrescriptionModal();
        showSuccess('Prescription added successfully!');
        
    } catch (error) {
        console.error('Error adding prescription:', error);
        showError('Failed to add prescription. Please try again.');
    }
}

// Create dose records for a prescription
async function createDoseRecords(prescriptionId, prescriptionData) {
    try {
        const { dosage, duration, startDate } = prescriptionData;
        const timesPerDay = parseInt(dosage.split('x')[1]) || 1;
        const times = ['morning', 'midday', 'evening'].slice(0, timesPerDay);
        
        for (let day = 0; day < duration; day++) {
            const doseDate = new Date(startDate.toDate());
            doseDate.setDate(doseDate.getDate() + day);
            doseDate.setHours(0, 0, 0, 0);
            
            for (const time of times) {
                await addDoc(collection(db, 'dose_records'), {
                    prescriptionId,
                    studentId: prescriptionData.studentId,
                    studentName: prescriptionData.studentName,
                    drugName: prescriptionData.drugName,
                    date: Timestamp.fromDate(doseDate),
                    time,
                    status: 'pending',
                    createdAt: Timestamp.now()
                });
            }
        }
    } catch (error) {
        console.error('Error creating dose records:', error);
    }
}

// Helper function to format date
function formatDate(timestamp) {
    if (!timestamp) return 'Unknown date';
    
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString();
    } catch (error) {
        return 'Invalid date';
    }
}

// Show success message
function showSuccess(message) {
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        z-index: 1001;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Show error message
function showError(message) {
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
    `;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        z-index: 1001;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Make functions globally available
window.switchTab = switchTab;
window.showAddPrescriptionModal = showAddPrescriptionModal;
window.closeAddPrescriptionModal = closeAddPrescriptionModal;
