// students.js
import { db } from './firebase-config.js';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  deleteDoc,
  doc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let allStudents = [];
let filteredStudents = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadStudents();
  setupEventListeners();
  populateFilterOptions();
});

function setupEventListeners() {
  document.getElementById('studentSearch')?.addEventListener('input', filterStudents);
  document.getElementById('classFilter')?.addEventListener('change', filterStudents);
  document.getElementById('houseFilter')?.addEventListener('change', filterStudents);
  document.getElementById('addStudentForm')?.addEventListener('submit', handleAddStudent);
}

async function loadStudents() {
  try {
    const snapshot = await getDocs(query(collection(db, 'students'), orderBy('name')));
    allStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    filteredStudents = [...allStudents];
    displayStudents();
  } catch (error) {
    console.error('Failed to load students:', error);
    showError('Could not load students.');
  }
}

function displayStudents() {
  const grid = document.getElementById('studentsGrid');
  if (!grid) return;

  if (filteredStudents.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fas fa-users"></i>
        <p>No students found</p>
        <button onclick="showAddStudentModal()" class="btn btn-primary">
          <i class="fas fa-plus"></i> Add First Student
        </button>
      </div>`;
    return;
  }

  grid.innerHTML = filteredStudents.map(student => `
    <div class="student-card" onclick="viewStudentProfile('${student.id}')">
      <div class="student-header">
        <div>
          <div class="student-name">${student.name}</div>
          <div class="student-details">${student.class} • ${student.house}</div>
        </div>
        <button class="btn btn-danger delete-btn" onclick="deleteStudent(event, '${student.id}')">
          <i class="fas fa-trash-alt"></i> Delete
        </button>
      </div>
      <div class="student-info">
        <p><i class="fas fa-phone"></i> ${student.parentContact || 'No contact'}</p>
        <p><i class="fas fa-notes-medical"></i> ${student.medicalInfo ? 'Has medical info' : 'No medical info'}</p>
      </div>
    </div>
  `).join('');
}

function filterStudents() {
  const search = document.getElementById('studentSearch')?.value.toLowerCase() || '';
  const classVal = document.getElementById('classFilter')?.value || '';
  const houseVal = document.getElementById('houseFilter')?.value || '';

  filteredStudents = allStudents.filter(student => {
    return student.name.toLowerCase().includes(search) &&
      (!classVal || student.class === classVal) &&
      (!houseVal || student.house === houseVal);
  });

  displayStudents();
}

function populateFilterOptions() {
  const classFilter = document.getElementById('classFilter');
  const houseFilter = document.getElementById('houseFilter');

  if (classFilter) {
    const classes = [...new Set(allStudents.map(s => s.class))].sort();
    classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      classFilter.appendChild(opt);
    });
  }

  if (houseFilter) {
    const houses = ['Kabalega', 'Lubambula', 'Lumumba', 'Mboya', 'Muteesa', 'Muyingo', 'Walusimbi'];
    houses.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      houseFilter.appendChild(opt);
    });
  }
}

function showAddStudentModal() {
  const modal = document.getElementById('addStudentModal');
  modal.style.display = 'block';
  document.getElementById('addStudentForm').reset();
}

function closeAddStudentModal() {
  document.getElementById('addStudentModal').style.display = 'none';
}

async function handleAddStudent(e) {
  e.preventDefault();
  const formData = {
    name: document.getElementById('studentName').value.trim(),
    class: document.getElementById('studentClass').value,
    house: document.getElementById('studentHouse').value,
    parentContact: document.getElementById('parentContact').value.trim(),
    medicalInfo: document.getElementById('medicalInfo').value.trim(),
    createdAt: Timestamp.now(),
    status: 'active'
  };

  if (!formData.name || !formData.class || !formData.house) {
    showError('Please fill in all required fields.');
    return;
  }

  try {
    await addDoc(collection(db, 'students'), formData);
    await loadStudents();
    closeAddStudentModal();
    showSuccess('Student added successfully!');
  } catch (error) {
    console.error('Add error:', error);
    showError('Failed to add student.');
  }
}

async function deleteStudent(event, studentId) {
  event.stopPropagation();
  if (!confirm('Are you sure you want to delete this student?')) return;

  try {
    await deleteDoc(doc(db, 'students', studentId));
    showSuccess('Student deleted.');
    await loadStudents();
  } catch (error) {
    console.error('Delete error:', error);
    showError('Failed to delete student.');
  }
}

function showSuccess(message) {
  const div = document.createElement('div');
  div.className = 'notification success';
  div.innerHTML = `<i class="fas fa-check-circle"></i> <span>${message}</span>`;
  Object.assign(div.style, {
    position: 'fixed', top: '20px', right: '20px', background: '#10b981',
    color: 'white', padding: '1rem 1.5rem', borderRadius: '0.5rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 1001, display: 'flex', gap: '0.5rem'
  });
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function showError(message) {
  const div = document.createElement('div');
  div.className = 'notification error';
  div.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span>${message}</span>`;
  Object.assign(div.style, {
    position: 'fixed', top: '20px', right: '20px', background: '#ef4444',
    color: 'white', padding: '1rem 1.5rem', borderRadius: '0.5rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 1001, display: 'flex', gap: '0.5rem'
  });
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 5000);
}

// Expose functions to global scope
window.showAddStudentModal = showAddStudentModal;
window.closeAddStudentModal = closeAddStudentModal;
window.viewStudentProfile = viewStudentProfile;
window.deleteStudent = deleteStudent;
