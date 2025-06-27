export async function getStudentData(studentId) {
  const response = await fetch(`/api/students/${studentId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch student data: ${response.statusText}`);
  }
  return response.json();
}
