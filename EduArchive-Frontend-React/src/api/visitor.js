import axios from './axios';

// ── Visitor capstone list & filters ──────────────────────────
export const getVisitorCapstones  = (params = {}) => axios.get('/visitor/capstones', { params });
export const getVisitorYears      = () => axios.get('/visitor/capstones/years');
export const getVisitorPrograms   = () => axios.get('/visitor/capstones/programs');
export const getVisitorCategories = () => axios.get('/visitor/capstones/categories');
export const getVisitorAdvisers   = () => axios.get('/visitor/capstones/advisers');
export const getVisitorKeywords   = () => axios.get('/visitor/capstones/keywords');
export const getVisitorSuggest    = (q) => axios.get('/visitor/capstones/suggest', { params: { q } });

// ── Single capstone ──────────────────────────────────────────
export const getVisitorCapstone = (id) => axios.get(`/visitor/capstones/${id}`);

// ── PDF / IMRAD serving ──────────────────────────────────────
export const loadVisitorPdf = async (id) => {
    const res = await axios.get(`/visitor/capstones/${id}/pdf`, { responseType: 'blob' });
    return URL.createObjectURL(res.data);
};

export const loadVisitorImrad = async (id) => {
    const res = await axios.get(`/visitor/capstones/${id}/imrad`, { responseType: 'blob' });
    return URL.createObjectURL(res.data);
};

// ── Bookmarks (shared route — available to all authenticated users) ──
export const toggleVisitorBookmark  = (id)  => axios.post(`/capstones/${id}/bookmark`);
export const getVisitorBookmarks    = ()     => axios.get('/capstones/bookmarked');
