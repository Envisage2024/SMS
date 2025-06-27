// Utility functions for the Sickbay Management System
import { db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    query, 
    where, 
    orderBy,
    limit
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Search students by name
export async function searchStudents(searchTerm) {
    try {
        if (!searchTerm || searchTerm.length < 2) {
            return [];
        }
        
        const searchTermLower = searchTerm.toLowerCase();
        
        // Get all students (since Firestore doesn't support case-insensitive search natively)
        const studentsSnapshot = await getDocs(
            query(collection(db, 'students'), orderBy('name'))
        );
        
        const results = [];
        studentsSnapshot.forEach((doc) => {
            const student = { id: doc.id, ...doc.data() };
            
            // Check if name contains the search term (case-insensitive)
            if (student.name.toLowerCase().includes(searchTermLower)) {
                results.push(student);
            }
        });
        
        // Limit results to prevent overwhelming the UI
        return results.slice(0, 10);
        
    } catch (error) {
        console.error('Error searching students:', error);
        return [];
    }
}

// Search students with additional filters
export async function searchStudentsAdvanced(searchTerm, filters = {}) {
    try {
        const { className, house, status } = filters;
        
        // Build query constraints
        const constraints = [orderBy('name')];
        
        if (className) {
            constraints.push(where('class', '==', className));
        }
        
        if (house) {
            constraints.push(where('house', '==', house));
        }
        
        if (status) {
            constraints.push(where('status', '==', status));
        }
        
        const studentsSnapshot = await getDocs(
            query(collection(db, 'students'), ...constraints)
        );
        
        let results = [];
        studentsSnapshot.forEach((doc) => {
            results.push({ id: doc.id, ...doc.data() });
        });
        
        // Apply text search filter if provided
        if (searchTerm && searchTerm.length >= 2) {
            const searchTermLower = searchTerm.toLowerCase();
            results = results.filter(student =>
                student.name.toLowerCase().includes(searchTermLower)
            );
        }
        
        return results;
        
    } catch (error) {
        console.error('Error in advanced student search:', error);
        return [];
    }
}

// Get student by ID
export async function getStudentById(studentId) {
    try {
        const studentDoc = await getDoc(doc(db, 'students', studentId));
        
        if (studentDoc.exists()) {
            return { id: studentDoc.id, ...studentDoc.data() };
        } else {
            return null;
        }
        
    } catch (error) {
        console.error('Error getting student by ID:', error);
        return null;
    }
}

// Format date consistently across the application
export function formatDate(timestamp, options = {}) {
    if (!timestamp) return 'Unknown date';
    
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        
        const formatOptions = { ...defaultOptions, ...options };
        
        return date.toLocaleDateString('en-US', formatOptions);
        
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid date';
    }
}

// Format timestamp to include time
export function formatDateTime(timestamp) {
    return formatDate(timestamp, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format time from timestamp
export function formatTime(timestamp) {
    if (!timestamp) return 'Unknown time';
    
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Error formatting time:', error);
        return 'Invalid time';
    }
}

// Calculate age from date of birth
export function calculateAge(dateOfBirth) {
    try {
        const dob = dateOfBirth.toDate ? dateOfBirth.toDate() : new Date(dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        
        return age;
    } catch (error) {
        console.error('Error calculating age:', error);
        return 'Unknown';
    }
}

// Validate email format
export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validate phone number format
export function validatePhone(phone) {
    // Simple validation for phone numbers (can be enhanced based on requirements)
    const phoneRegex = /^[\+]?[0-9]{10,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

// Generate unique ID (fallback if Firestore auto-generation is not used)
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Debounce function for search inputs
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Get time period based on current time
export function getCurrentTimePeriod() {
    const currentHour = new Date().getHours();
    
    if (currentHour >= 6 && currentHour < 12) {
        return 'morning';
    } else if (currentHour >= 12 && currentHour < 18) {
        return 'midday';
    } else {
        return 'evening';
    }
}

// Check if a dose is overdue
export function isDoseOverdue(doseTime, scheduledDate) {
    try {
        const now = new Date();
        const doseDate = scheduledDate.toDate ? scheduledDate.toDate() : new Date(scheduledDate);
        
        // Set the scheduled time based on dose period
        let scheduledHour;
        switch (doseTime) {
            case 'morning':
                scheduledHour = 8; // 8 AM
                break;
            case 'midday':
                scheduledHour = 13; // 1 PM
                break;
            case 'evening':
                scheduledHour = 19; // 7 PM
                break;
            default:
                return false;
        }
        
        doseDate.setHours(scheduledHour, 0, 0, 0);
        
        // Add 2 hour grace period
        const overdueTime = new Date(doseDate.getTime() + (2 * 60 * 60 * 1000));
        
        return now > overdueTime;
        
    } catch (error) {
        console.error('Error checking if dose is overdue:', error);
        return false;
    }
}

// Parse dosage string to get frequency and amount
export function parseDosage(dosageString) {
    try {
        const parts = dosageString.split('x');
        if (parts.length !== 2) {
            return { amount: 1, frequency: 1, times: ['morning'] };
        }
        
        const amount = parseInt(parts[0]) || 1;
        const frequency = parseInt(parts[1]) || 1;
        
        let times = [];
        switch (frequency) {
            case 1:
                times = ['morning'];
                break;
            case 2:
                times = ['morning', 'evening'];
                break;
            case 3:
                times = ['morning', 'midday', 'evening'];
                break;
            default:
                times = ['morning'];
        }
        
        return { amount, frequency, times };
        
    } catch (error) {
        console.error('Error parsing dosage:', error);
        return { amount: 1, frequency: 1, times: ['morning'] };
    }
}

// Get status color based on status value
export function getStatusColor(status) {
    const statusColors = {
        'active': '#10b981',
        'pending': '#f59e0b',
        'completed': '#3b82f6',
        'missed': '#ef4444',
        'taken': '#10b981',
        'overdue': '#dc2626'
    };
    
    return statusColors[status] || '#64748b';
}

// Show notification (can be used across different modules)
export function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    notification.innerHTML = `
        <i class="${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        z-index: 1001;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    
    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
            notification.remove();
            if (document.head.contains(style)) {
                document.head.removeChild(style);
            }
        }, 300);
    }, duration);
}

// Export commonly used constants
export const DOSE_TIMES = ['morning', 'midday', 'evening'];
export const HOUSES = ['Kabalega', 'Lubambula', 'Lumumba', 'Mboya', 'Muteesa', 'Muyingo', 'Walusimbi'];
export const CLASSES = [
    'F.1A', 'F.1B', 'F.1C', 'F.1D', 'F.1E', 'F.1G',
    'F.2A', 'F.2B', 'F.2C', 'F.2D', 'F.2E', 'F.2G',
    'F.3A', 'F.3B', 'F.3C', 'F.3D', 'F.3E', 'F.3G',
    'F.4A', 'F.4B', 'F.4C', 'F.4D', 'F.4E', 'F.4G',
    'F.5A', 'F.5B', 'F.5C',
    'F.6A', 'F.6B', 'F.6C'
];

export const DRUGS = [
    'Paracetamol', 'Ibuprofen', 'Amoxicillin', 'Cough Syrup',
    'Antihistamine', 'Multivitamin', 'Iron Tablets', 'Aspirin',
    'Antacid', 'Antiseptic'
];

// Default export for backward compatibility
export default {
    searchStudents,
    searchStudentsAdvanced,
    getStudentById,
    formatDate,
    formatDateTime,
    formatTime,
    calculateAge,
    validateEmail,
    validatePhone,
    generateId,
    debounce,
    getCurrentTimePeriod,
    isDoseOverdue,
    parseDosage,
    getStatusColor,
    showNotification,
    DOSE_TIMES,
    HOUSES,
    CLASSES,
    DRUGS
};
