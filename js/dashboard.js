// Dashboard functionality
import { db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    query, 
    where, 
    orderBy,
    Timestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Dashboard data loading
document.addEventListener('DOMContentLoaded', loadDashboardData);

async function loadDashboardData() {
    try {
        await Promise.all([
            loadStatistics(),
            loadRecentActivities(),
            loadPendingActions(),
            loadHealthChart()
        ]);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Load statistics
async function loadStatistics() {
    try {
        // Get total students
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const totalStudents = studentsSnapshot.size;
        
        // Get active prescriptions
        const prescriptionsSnapshot = await getDocs(
            query(collection(db, 'prescriptions'), where('status', '==', 'active'))
        );
        const activePrescriptions = prescriptionsSnapshot.size;
        
        // Get today's date for missed doses calculation
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = Timestamp.fromDate(today);
        
        // Get missed doses for today
        const missedDosesSnapshot = await getDocs(
            query(
                collection(db, 'dose_records'),
                where('date', '>=', todayTimestamp),
                where('status', '==', 'missed')
            )
        );
        const missedDoses = missedDosesSnapshot.size;
        
        // Get completed doses for today
        const completedDosesSnapshot = await getDocs(
            query(
                collection(db, 'dose_records'),
                where('date', '>=', todayTimestamp),
                where('status', '==', 'taken')
            )
        );
        const completedToday = completedDosesSnapshot.size;
        
        // Update UI
        document.getElementById('totalStudents').textContent = totalStudents;
        document.getElementById('activePrescriptions').textContent = activePrescriptions;
        document.getElementById('missedDoses').textContent = missedDoses;
        document.getElementById('completedToday').textContent = completedToday;
        
    } catch (error) {
        console.error('Error loading statistics:', error);
        // Set default values on error
        document.getElementById('totalStudents').textContent = '0';
        document.getElementById('activePrescriptions').textContent = '0';
        document.getElementById('missedDoses').textContent = '0';
        document.getElementById('completedToday').textContent = '0';
    }
}

// Load recent activities
async function loadRecentActivities() {
    try {
        const activitiesContainer = document.getElementById('recentActivities');
        
        // Get recent dose records
        const recentDosesSnapshot = await getDocs(
            query(
                collection(db, 'dose_records'),
                orderBy('timestamp', 'desc')
            )
        );
        
        if (recentDosesSnapshot.empty) {
            activitiesContainer.innerHTML = `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-info-circle"></i>
                    </div>
                    <div class="activity-info">
                        <p class="activity-text">No recent activities</p>
                        <span class="activity-time">Start managing prescriptions to see activities</span>
                    </div>
                </div>
            `;
            return;
        }
        
        const activities = [];
        for (const doc of recentDosesSnapshot.docs) {
            const data = doc.data();
            activities.push(data);
            if (activities.length >= 5) break; // Limit to 5 recent activities
        }
        
        activitiesContainer.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas fa-pills"></i>
                </div>
                <div class="activity-info">
                    <p class="activity-text">${activity.studentName} - ${activity.drugName} (${activity.time})</p>
                    <span class="activity-time">${formatTimestamp(activity.timestamp)}</span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading recent activities:', error);
        const activitiesContainer = document.getElementById('recentActivities');
        activitiesContainer.innerHTML = `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="activity-info">
                    <p class="activity-text">Error loading activities</p>
                    <span class="activity-time">Please refresh the page</span>
                </div>
            </div>
        `;
    }
}

// Load pending actions
async function loadPendingActions() {
    try {
        const pendingContainer = document.getElementById('pendingActions');
        
        // Get today's pending doses
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = Timestamp.fromDate(today);
        
        const pendingDosesSnapshot = await getDocs(
            query(
                collection(db, 'dose_records'),
                where('date', '>=', todayTimestamp),
                where('status', '==', 'pending')
            )
        );
        
        if (pendingDosesSnapshot.empty) {
            pendingContainer.innerHTML = `
                <div class="pending-item">
                    <i class="fas fa-check-circle"></i>
                    <span>No pending actions</span>
                </div>
            `;
            return;
        }
        
        const pendingCount = pendingDosesSnapshot.size;
        
        pendingContainer.innerHTML = `
            <div class="pending-item">
                <i class="fas fa-clock"></i>
                <span>${pendingCount} pending dose${pendingCount > 1 ? 's' : ''} for today</span>
            </div>
            <div class="pending-item">
                <i class="fas fa-arrow-right"></i>
                <span><a href="prescriptions.html">View Prescriptions</a></span>
            </div>
        `;
        
    } catch (error) {
        console.error('Loading pending actions:', error);
        const pendingContainer = document.getElementById('pendingActions');
        pendingContainer.innerHTML = `
            <div class="pending-item">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Loading pending actions</span>
            </div>
        `;
    }
}

// Load health chart (placeholder)
async function loadHealthChart() {
    try {
        const canvas = document.getElementById('healthChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw placeholder chart
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#64748b';
        ctx.font = '16px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Health Statistics Chart', canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillText('(Chart implementation available with Chart.js)', canvas.width / 2, canvas.height / 2 + 10);
        
    } catch (error) {
        console.error('Error loading health chart:', error);
    }
}

// Helper function to format timestamp
function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown time';
    
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString();
    } catch (error) {
        return 'Invalid date';
    }
}

// Export functions for external use
export { loadDashboardData };
