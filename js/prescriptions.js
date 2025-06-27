// Prescriptions management functionality
import { db } from './firebase-config.js';
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    query,
    where,
    orderBy,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Import stock management functions
let reduceStock, getAvailableDrugs;
try {
    const stockModule = await import('./stocks.js');
    reduceStock = stockModule.reduceStock;
    getAvailableDrugs = stockModule.getAvailableDrugs;
} catch (error) {
    console.log('Stock module not available, continuing without stock integration');
}

// Global variables
let allPrescriptions = [];
let allDoseRecords = [];
let currentDose = null;

// Notification permission and service worker registration (for persistent web notifications)
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.warn('This browser does not support desktop notification');
        return;
    }

    if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
        } else {
            console.warn('Notification permission denied.');
        }
    } else if (Notification.permission === 'granted') {
        console.log('Notification permission already granted.');
    } else {
        console.warn('Notification permission denied. Please enable notifications in your browser settings.');
    }
}

// Function to display a web notification
function displayNotification(title, body, icon = '/path/to/your/icon.png') {
    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon });
    }
}

// Initialize prescriptions page
document.addEventListener('DOMContentLoaded', async () => {
    await requestNotificationPermission(); // Request permission on load
    await loadPrescriptionsData();
    setupEventListeners();
    setupDateFilter();
});

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('prescriptionSearch');
    const statusFilter = document.getElementById('statusFilter');
    const timeFilter = document.getElementById('timeFilter');
    const dateFilter = document.getElementById('dateFilter');
    const missedDosesDate = document.getElementById('missedDosesDate');

    if (searchInput) {
        searchInput.addEventListener('input', filterPrescriptions);
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', filterPrescriptions);
    }

    if (timeFilter) {
        timeFilter.addEventListener('change', filterPrescriptions);
    }

    if (dateFilter) {
        dateFilter.addEventListener('change', loadPrescriptionsData);
    }

    if (missedDosesDate) {
        missedDosesDate.addEventListener('change', loadMissedDoses);
    }
}

// Setup date filter with today's date
function setupDateFilter() {
    const missedDosesDate = document.getElementById('missedDosesDate');
    if (missedDosesDate) {
        const today = new Date();
        missedDosesDate.value = today.toISOString().split('T')[0];
        loadMissedDoses();
    }
}

// Load all prescriptions data
async function loadPrescriptionsData() {
    try {
        await Promise.all([
            loadPrescriptionStats(),
            loadPrescriptionsList(),
            loadCompletedTreatments()
        ]);
        checkUpcomingDosesForNotifications(); // Check for notifications after loading data
    } catch (error) {
        console.error('Error loading prescriptions data:', error);
    }
}

// Load prescription statistics
async function loadPrescriptionStats() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = Timestamp.fromDate(today);

        // Get today's dose records
        const doseRecordsSnapshot = await getDocs(
            query(
                collection(db, 'dose_records'),
                where('date', '>=', todayTimestamp)
            )
        );

        let pendingDoses = 0;
        let completedDoses = 0;
        let missedDoses = 0;
        const activePatients = new Set();

        doseRecordsSnapshot.forEach((doc) => {
            const data = doc.data();
            activePatients.add(data.studentId);

            switch (data.status) {
                case 'pending':
                    pendingDoses++;
                    break;
                case 'taken':
                    completedDoses++;
                    break;
                case 'missed':
                    missedDoses++;
                    break;
            }
        });

        // Update UI
        document.getElementById('pendingDoses').textContent = pendingDoses;
        document.getElementById('completedDoses').textContent = completedDoses;
        document.getElementById('missedDoses').textContent = missedDoses;
        document.getElementById('activePatientsCount').textContent = activePatients.size;

    } catch (error) {
        console.error('Error loading prescription stats:', error);
        // Set default values on error
        document.getElementById('pendingDoses').textContent = '0';
        document.getElementById('completedDoses').textContent = '0';
        document.getElementById('missedDoses').textContent = '0';
        document.getElementById('activePatientsCount').textContent = '0';
    }
}

// Load prescriptions list
async function loadPrescriptionsList() {
    try {
        const prescriptionsContainer = document.getElementById('prescriptionsList');

        // Get today's dose records
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = Timestamp.fromDate(today);

        const doseRecordsSnapshot = await getDocs(
            query(
                collection(db, 'dose_records'),
                where('date', '>=', todayTimestamp),
                orderBy('studentName')
            )
        );

        if (doseRecordsSnapshot.empty) {
            prescriptionsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-prescription-bottle-alt"></i>
                    <p>No prescriptions for today</p>
                </div>
            `;
            return;
        }

        // Group dose records by student
        const studentDoses = {};
        doseRecordsSnapshot.forEach((doc) => {
            const data = { id: doc.id, ...doc.data() };
            const studentId = data.studentId;

            if (!studentDoses[studentId]) {
                studentDoses[studentId] = {
                    studentName: data.studentName,
                    studentId: data.studentId,
                    doses: []
                };
            }

            studentDoses[studentId].doses.push(data);
        });

        // Display grouped prescriptions with progress bars
        prescriptionsContainer.innerHTML = Object.values(studentDoses).map(student => {
            // Calculate student's overall progress for today
            const totalDoses = student.doses.length;
            const takenDoses = student.doses.filter(dose => dose.status === 'taken').length;
            const progressPercentage = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

            return `
            <div class="prescription-item">
                <div class="prescription-info">
                    <div class="prescription-student">${student.studentName}</div>
                    <div class="prescription-details">
                        ${student.doses.length} dose${student.doses.length > 1 ? 's' : ''} scheduled for today
                    </div>
                    <div class="dose-progress">
                        <div class="dose-progress-header">
                            <span class="dose-progress-label">Today's Progress</span>
                            <span class="dose-progress-percentage">${progressPercentage}%</span>
                        </div>
                        <div class="dose-progress-bar">
                            <div class="dose-progress-fill" style="width: ${progressPercentage}%"></div>
                        </div>
                    </div>
                </div>
                <div class="prescription-actions">
                    ${student.doses.map(dose => `
                        <button class="dose-button ${dose.time} ${dose.status}"
                                onclick="manageDose('${dose.id}', '${dose.time}', '${dose.status}')"
                                ${dose.status === 'taken' || dose.status === 'missed' ? 'disabled' : ''}>
                            ${dose.time.charAt(0).toUpperCase() + dose.time.slice(1)}
                            ${dose.status === 'taken' ? '✓' : dose.status === 'missed' ? '✗' : ''}
                        </button>
                    `).join('')}
                </div>
            </div>`;
        }).join('');

        allDoseRecords = [];
        doseRecordsSnapshot.forEach((doc) => {
            allDoseRecords.push({ id: doc.id, ...doc.data() });
        });

    } catch (error) {
        console.error('Error loading prescriptions list:', error);
        const prescriptionsContainer = document.getElementById('prescriptionsList');
        prescriptionsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading prescriptions</p>
            </div>
        `;
    }
}

// Load missed doses for a specific date
async function loadMissedDoses() {
    try {
        const missedDosesList = document.getElementById('missedDosesList');
        const dateInput = document.getElementById('missedDosesDate');

        if (!dateInput.value) return;

        const selectedDate = new Date(dateInput.value);
        selectedDate.setHours(0, 0, 0, 0);
        const dateTimestamp = Timestamp.fromDate(selectedDate);

        const nextDay = new Date(selectedDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayTimestamp = Timestamp.fromDate(nextDay);

        const missedDosesSnapshot = await getDocs(
            query(
                collection(db, 'dose_records'),
                where('date', '>=', dateTimestamp),
                where('date', '<', nextDayTimestamp),
                where('status', '==', 'missed'),
                orderBy('studentName')
            )
        );

        if (missedDosesSnapshot.empty) {
            missedDosesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <p>No missed doses for ${selectedDate.toLocaleDateString()}</p>
                </div>
            `;
            return;
        }

        const missedDoses = [];
        missedDosesSnapshot.forEach((doc) => {
            missedDoses.push({ id: doc.id, ...doc.data() });
        });

        missedDosesList.innerHTML = missedDoses.map(dose => `
            <div class="missed-dose-item">
                <div class="dose-info">
                    <strong>${dose.studentName}</strong>
                    <span>${dose.drugName} - ${dose.time}</span>
                </div>
                <div class="dose-status">
                    <span class="status-badge missed">Missed</span>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading missed doses:', error);
        const missedDosesList = document.getElementById('missedDosesList');
        missedDosesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading missed doses</p>
            </div>
        `;
    }
}

// Load completed treatments
async function loadCompletedTreatments() {
    try {
        const completedTreatmentsList = document.getElementById('completedTreatmentsList');

        const completedPrescriptionsSnapshot = await getDocs(
            query(
                collection(db, 'prescriptions'),
                where('status', '==', 'completed'),
                orderBy('createdAt', 'desc')
            )
        );

        if (completedPrescriptionsSnapshot.empty) {
            completedTreatmentsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-double"></i>
                    <p>No completed treatments yet</p>
                </div>
            `;
            return;
        }

        const completedTreatments = [];
        completedPrescriptionsSnapshot.forEach((doc) => {
            completedTreatments.push({ id: doc.id, ...doc.data() });
        });

        completedTreatmentsList.innerHTML = completedTreatments.map(treatment => `
            <div class="completed-treatment-item">
                <div class="treatment-info">
                    <strong>${treatment.studentName}</strong>
                    <span>${treatment.drugName} - ${treatment.duration} days</span>
                    <small>Completed on ${formatDate(treatment.completedAt || treatment.createdAt)}</small>
                </div>
                <div class="treatment-status">
                    <span class="status-badge completed">Completed</span>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading completed treatments:', error);
        const completedTreatmentsList = document.getElementById('completedTreatmentsList');
        completedTreatmentsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading completed treatments</p>
            </div>
        `;
    }
}

// Filter prescriptions based on search and filters
function filterPrescriptions() {
    // This function would filter the displayed prescriptions
    // Implementation depends on the current display structure
    console.log('Filtering prescriptions...');
}

// Manage dose (show modal for marking as taken)
function manageDose(doseId, time, status) {
    if (status === 'taken' || status === 'missed') {
        return; // Already processed
    }

    const dose = allDoseRecords.find(d => d.id === doseId);
    if (!dose) return;

    currentDose = dose;
    showDoseModal();
}

// Show dose administration modal
function showDoseModal() {
    const modal = document.getElementById('doseModal');
    const doseInfo = document.getElementById('doseInfo');
    const doseTimes = document.getElementById('doseTimes');

    if (!modal || !currentDose) return;

    doseInfo.innerHTML = `
        <div class="dose-info-container">
            <h4>${currentDose.studentName}</h4>
            <p><strong>Medication:</strong> ${currentDose.drugName}</p>
            <p><strong>Scheduled Time:</strong> ${currentDose.time.charAt(0).toUpperCase() + currentDose.time.slice(1)}</p>
            <p><strong>Date:</strong> ${formatDate(currentDose.date)}</p>
        </div>
    `;

    doseTimes.innerHTML = `
        <button type="button" class="time-button selected" data-time="${currentDose.time}">
            ${currentDose.time.charAt(0).toUpperCase() + currentDose.time.slice(1)}
        </button>
    `;

    modal.style.display = 'block';
}

// Close dose modal
function closeDoseModal() {
    const modal = document.getElementById('doseModal');
    if (modal) {
        modal.style.display = 'none';
        currentDose = null;
    }
}

// Mark dose as taken
async function markDoseAsTaken() {
    if (!currentDose) return;

    try {
        const notes = document.getElementById('doseNotes').value.trim();

        // Update dose record
        await updateDoc(doc(db, 'dose_records', currentDose.id), {
            status: 'taken',
            takenAt: Timestamp.now(),
            notes: notes,
            updatedAt: Timestamp.now()
        });

        // Reduce stock if stock management is available
        if (reduceStock && currentDose.prescription && currentDose.prescription.drugName) {
            const dosageAmount = parseDosageAmount(currentDose.prescription.dosage);
            const stockReduced = await reduceStock(currentDose.prescription.drugName, dosageAmount);

            if (!stockReduced) {
                console.warn(`Could not reduce stock for ${currentDose.prescription.drugName}`);
            }
        }

        // Update prescription progress
        await updatePrescriptionProgress(currentDose.prescriptionId);

        // Reload prescriptions data
        await loadPrescriptionsData();
        closeDoseModal();
        showSuccess('Dose marked as taken successfully!');

    } catch (error) {
        console.error('Error marking dose as taken:', error);
        showError('Failed to mark dose as taken. Please try again.');
    }
}

// Parse dosage amount from dosage string (e.g., "2 tablets" -> 2)
function parseDosageAmount(dosageString) {
    if (!dosageString) return 1;
    const match = dosageString.match(/(\d+)/);
    return match ? parseInt(match[1]) : 1;
}

// Update prescription progress
async function updatePrescriptionProgress(prescriptionId) {
    try {
        // Get all dose records for this prescription
        const doseRecordsSnapshot = await getDocs(
            query(
                collection(db, 'dose_records'),
                where('prescriptionId', '==', prescriptionId)
            )
        );

        let totalDoses = 0;
        let takenDoses = 0;

        doseRecordsSnapshot.forEach((doc) => {
            const dose = doc.data();
            totalDoses++;
            if (dose.status === 'taken') {
                takenDoses++;
            }
        });

        const progressPercentage = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

        // Update prescription with progress
        await updateDoc(doc(db, 'prescriptions', prescriptionId), {
            progress: progressPercentage,
            takenDoses: takenDoses,
            totalDoses: totalDoses,
            updatedAt: Timestamp.now()
        });

        // Mark prescription as completed if progress is 100%
        if (progressPercentage >= 100) {
            await updateDoc(doc(db, 'prescriptions', prescriptionId), {
                status: 'completed',
                completedAt: Timestamp.now()
            });
        }

    } catch (error) {
        console.error('Error updating prescription progress:', error);
    }
}

// Mark dose as missed (automatically called for overdue doses)
async function markDoseAsMissed(doseId) {
    try {
        await updateDoc(doc(db, 'dose_records', doseId), {
            status: 'missed',
            missedAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error('Error marking dose as missed:', error);
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

// New: Check for upcoming doses and trigger notifications
async function checkUpcomingDosesForNotifications() {
    if (Notification.permission !== 'granted') {
        console.warn('Cannot send notifications: permission not granted.');
        return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();

    // Define time windows for doses (adjust as needed)
    const timeWindows = {
        'morning': { startHour: 8, endHour: 10 }, // E.g., notify for morning doses from 8 AM to 10 AM
        'midday': { startHour: 12, endHour: 14 }, // E.g., notify for midday doses from 12 PM to 2 PM
        'evening': { startHour: 18, endHour: 20 } // E.g., notify for evening doses from 6 PM to 8 PM
    };

    // Filter for today's pending doses
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    const upcomingDosesSnapshot = await getDocs(
        query(
            collection(db, 'dose_records'),
            where('date', '>=', todayTimestamp),
            where('status', '==', 'pending')
        )
    );

    upcomingDosesSnapshot.forEach(doc => {
        const dose = doc.data();
        const doseScheduledTime = dose.time; // 'morning', 'midday', 'evening'

        if (timeWindows[doseScheduledTime]) {
            const { startHour, endHour } = timeWindows[doseScheduledTime];

            // Check if current time is within the notification window for this dose
            // And if the dose hasn't been taken or missed yet
            if (currentHour >= startHour && currentHour < endHour) {
                // To avoid repeated notifications, you might want to store a flag
                // in localStorage or the database indicating a notification has been sent
                // for this dose on this day. For simplicity, we'll notify every check
                // if it's within the window and still pending.
                const notificationTitle = `Prescription Due: ${dose.time.charAt(0).toUpperCase() + dose.time.slice(1)} Dose`;
                const notificationBody = `${dose.studentName} needs to take ${dose.drugName}.`;

                displayNotification(notificationTitle, notificationBody);
            }
        }
    });
}

// Make functions globally available
window.manageDose = manageDose;
window.closeDoseModal = closeDoseModal;
window.markDoseAsTaken = markDoseAsTaken;

// Auto-update missed doses and check for upcoming dose notifications
setInterval(async () => {
    try {
        const now = new Date();
        const currentHour = now.getHours();

        // Logic for marking missed doses (existing)
        let cutoffTime = '';
        if (currentHour >= 10 && currentHour < 14) {
            cutoffTime = 'morning';
        } else if (currentHour >= 14 && currentHour < 19) {
            cutoffTime = 'midday';
        } else if (currentHour >= 19) {
            cutoffTime = 'evening';
        }

        if (cutoffTime) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayTimestamp = Timestamp.fromDate(today);

            const pendingDosesSnapshot = await getDocs(
                query(
                    collection(db, 'dose_records'),
                    where('date', '>=', todayTimestamp),
                    where('time', '==', cutoffTime),
                    where('status', '==', 'pending')
                )
            );

            pendingDosesSnapshot.forEach(async (doc) => {
                await markDoseAsMissed(doc.id);
            });

            if (!pendingDosesSnapshot.empty) {
                await loadPrescriptionsData();
            }
        }
        // End of missed doses logic

        // New: Check for upcoming doses for notifications
        await checkUpcomingDosesForNotifications();

    } catch (error) {
        console.error('Error in interval function (missed doses/notifications):', error);
    }
}, 60000); // Check every 1 minute for both (adjusted from 5 minutes for more frequent notifications)