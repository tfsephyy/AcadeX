import axios from './axios';

// ── Dashboard ──────────────────────────────────────
export const getDashboardStats = () => axios.get('/admin/dashboard/stats');
export const getUploadedByYear = () => axios.get('/admin/dashboard/uploaded-by-year');
export const getApprovedByYear = () => axios.get('/admin/dashboard/approved-by-year');
export const getStatusDistribution = () => axios.get('/admin/dashboard/status-distribution');
export const getStudentsPerYear = () => axios.get('/admin/dashboard/students-per-year');
export const getRecentApproved = () => axios.get('/admin/dashboard/recent-approved');

// ── Capstone Management ────────────────────────────
export const getCapstones = (params = {}) => axios.get('/admin/capstones', { params });
export const uploadCapstone = (formData) => axios.post('/admin/capstones/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
});
export const storeCapstone = (data) => axios.post('/admin/capstones', data);
export const updateCapstone = (id, data) => axios.put(`/admin/capstones/${id}`, data);
export const approveCapstone = (id) => axios.post(`/admin/capstones/${id}/approve`);
export const rejectCapstone = (id) => axios.post(`/admin/capstones/${id}/reject`);
export const deleteCapstone = (id) => axios.delete(`/admin/capstones/${id}`);

// ── Archive ────────────────────────────────────────
export const getArchivedCapstones = (params = {}) => axios.get('/admin/capstones/archived', { params });
export const archiveCapstone = (id) => axios.post(`/admin/capstones/${id}/archive`);
export const unarchiveCapstone = (id) => axios.post(`/admin/capstones/${id}/unarchive`);
export const unpublishCapstone = (id) => axios.post(`/admin/capstones/${id}/unpublish`);

// ── Admin Bookmarks ────────────────────────────────
export const getAdminBookmarkedCapstones = (params = {}) => axios.get('/admin/capstones/bookmarked', { params });

// ── User Management ────────────────────────────────
export const getNewUsers = (params = {}) => axios.get('/admin/users/new', { params });
export const getStudents = (params = {}) => axios.get('/admin/users/students', { params });
export const getFaculty = (params = {}) => axios.get('/admin/users/faculty', { params });
export const getUser = (id) => axios.get(`/admin/users/${id}`);
export const approveUser = (id) => axios.post(`/admin/users/${id}/approve`);
export const denyUser = (id) => axios.post(`/admin/users/${id}/deny`);
export const removeUser = (id) => axios.delete(`/admin/users/${id}`);

// ── Published Capstones ────────────────────────────
export const getPublishedCapstones = (params = {}) => axios.get('/published', { params });
export const getPublishedYears = () => axios.get('/published/years');
export const getPublishedPrograms = () => axios.get('/published/programs');
export const getPublishedKeywords = () => axios.get('/published/keywords');
export const getPublishedCategories = () => axios.get('/published/categories');

// ── Capstone Actions (all users) ───────────────────
export const getCapstone = (id) => axios.get(`/capstones/${id}`);
export const recordView = (id) => axios.post(`/capstones/${id}/view`);
export const downloadCapstone = (id) => axios.get(`/capstones/${id}/download`, { responseType: 'blob' });
export const getCaptonePdf = (id) => `/capstones/${id}/pdf`;

// ── Notifications ──────────────────────────────────
export const getAdminNotifications = (params = {}) => axios.get('/admin/notifications', { params });
export const getUnreadNotificationCount = () => axios.get('/admin/notifications/unread-count');
export const markNotificationRead = (id) => axios.put(`/admin/notifications/${id}/read`);
export const markAllNotificationsRead = () => axios.put('/admin/notifications/mark-all-read');
export const toggleBookmark = (id) => axios.post(`/capstones/${id}/bookmark`);
export const getStudentBookmarkedCapstones = (params = {}) => axios.get('/capstones/bookmarked', { params });

// ── Activity Logs ─────────────────────────────────
export const getActivityLogs = (params = {}) => axios.get('/admin/activity-logs', { params });
export const getActivityLogTypes = () => axios.get('/admin/activity-logs/types');

// ── Faculty Capstone Management ────────────────────
export const getFacultyCapstones = (params = {}) => axios.get('/faculty/capstones', { params });
export const uploadFacultyCapstone = (formData) => axios.post('/faculty/capstones/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
});
export const storeFacultyCapstone = (data) => axios.post('/faculty/capstones', data);
export const updateFacultyCapstone = (id, data) => axios.put(`/faculty/capstones/${id}`, data);
export const deleteFacultyCapstone = (id) => axios.delete(`/faculty/capstones/${id}`);
export const getArchivedFacultyCapstones = (params = {}) => axios.get('/faculty/capstones/archived', { params });
export const archiveFacultyCapstone = (id) => axios.post(`/faculty/capstones/${id}/archive`);
export const unarchiveFacultyCapstone = (id) => axios.post(`/faculty/capstones/${id}/unarchive`);

// ── Password Reset & Email Verification ───────────
export const sendForgotPasswordCode = (email) => axios.post('/forgot-password', { email });
export const verifyResetCode = (data) => axios.post('/verify-reset-code', data);
export const resetPassword = (data) => axios.post('/reset-password', data);
export const sendVerificationCode = (email) => axios.post('/send-verification-code', { email });
export const verifyEmailCode = (data) => axios.post('/verify-email-code', data);

// ── Authenticated User Actions ────────────────────
export const changePassword = (data) => axios.post('/change-password', data);
export const updateProfile = (data) => axios.put('/profile', data);

// ── User Archive (Admin) ──────────────────────────
export const archiveUser = (id) => axios.post(`/admin/users/${id}/archive`);
export const unarchiveUser = (id) => axios.post(`/admin/users/${id}/unarchive`);
export const getArchivedUsers = (params = {}) => axios.get('/admin/users/archived', { params });
