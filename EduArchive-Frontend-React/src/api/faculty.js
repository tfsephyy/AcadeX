import axios from './axios';

// ── Faculty Capstone Management ────────────────────
export const getFacultyCapstones = (params = {}) => axios.get('/faculty/capstones', { params });
export const getFacultyPendingCapstones = (params = {}) => axios.get('/faculty/capstones/pending', { params });
export const getFacultyCapstoneFilterOptions = () => axios.get('/faculty/capstones/filter-options');
export const uploadFacultyCapstone = (formData) => axios.post('/faculty/capstones/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
});
export const uploadFacultyResource = (formData) => axios.post('/faculty/capstones/upload-resource', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
});
export const storeFacultyCapstone = (data) => axios.post('/faculty/capstones', data);
export const updateFacultyCapstone = (id, data) => axios.put(`/faculty/capstones/${id}`, data);
export const approveFacultyCapstone = (id, data = {}) => axios.post(`/faculty/capstones/${id}/approve`, data);
export const rejectFacultyCapstone = (id, data = {}) => axios.post(`/faculty/capstones/${id}/reject`, data);
export const deleteFacultyCapstone = (id) => axios.delete(`/faculty/capstones/${id}`);
export const getArchivedFacultyCapstones = (params = {}) => axios.get('/faculty/capstones/archived', { params });
export const archiveFacultyCapstone = (id) => axios.post(`/faculty/capstones/${id}/archive`);
export const unarchiveFacultyCapstone = (id) => axios.post(`/faculty/capstones/${id}/unarchive`);
