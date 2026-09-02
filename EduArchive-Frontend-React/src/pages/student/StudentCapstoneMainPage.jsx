import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    HiArrowLeft, HiDownload, HiBookmark, HiShare, HiEye,
    HiArrowsExpand, HiX, HiAcademicCap, HiExternalLink, HiShieldCheck,
} from 'react-icons/hi';
import { getCapstone, recordView, downloadCapstone, toggleBookmark } from '../../api/admin';
import { useNotification } from '../../components/Notification';
import CitationGenerator from '../../components/CitationGenerator';
import Loading from '../../components/Loading';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import api from '../../api/axios';
import { useChatbotContext } from '../../context/ChatbotContext';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function StudentCapstoneMainPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const notify = useNotification();
    const { setCapstoneContext } = useChatbotContext();
    const [capstone, setCapstone] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bookmarked, setBookmarked] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [numPages, setNumPages] = useState(null);
    const [pdfWidth, setPdfWidth] = useState(600);
    const [fullscreen, setFullscreen] = useState(false);
    const [fsNumPages, setFsNumPages] = useState(null);
    const [fsWidth, setFsWidth] = useState(900);
    const pdfContainerRef = useRef(null);
    const fsContainerRef = useRef(null);
    const viewRecorded = useRef(false);

    // Push capstone context into chatbot when capstone loads, clear on unmount
    useEffect(() => {
        if (capstone) {
            setCapstoneContext({ id: capstone.id, title: capstone.title });
        }
        return () => setCapstoneContext(null);
    }, [capstone?.id]);

    useEffect(() => {
        viewRecorded.current = false;
        fetchCapstone();
    }, [id]);

    useEffect(() => {
        const updateWidth = () => {
            if (pdfContainerRef.current) {
                setPdfWidth(pdfContainerRef.current.clientWidth - 2);
            }
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, [loading]);

    // Fullscreen PDF width
    useEffect(() => {
        if (!fullscreen) return;
        const updateFsWidth = () => {
            if (fsContainerRef.current) {
                setFsWidth(Math.min(fsContainerRef.current.clientWidth - 48, 1100));
            }
        };
        updateFsWidth();
        window.addEventListener('resize', updateFsWidth);
        return () => window.removeEventListener('resize', updateFsWidth);
    }, [fullscreen]);

    // Lock body scroll when fullscreen open
    useEffect(() => {
        document.body.style.overflow = fullscreen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [fullscreen]);

    // Escape key closes fullscreen
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') setFullscreen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [pdfUrl]);

    const fetchCapstone = async () => {
        try {
            setLoading(true);
            const res = await getCapstone(id);
            const data = res.data.data;
            setCapstone(data);
            setBookmarked(data.is_bookmarked ?? false);

            // Record view â€” only once per session per capstone
            const viewKey = `eduarchive_viewed_${id}`;
            if (!viewRecorded.current && !sessionStorage.getItem(viewKey)) {
                viewRecorded.current = true;
                try {
                    await recordView(id);
                    sessionStorage.setItem(viewKey, '1');
                    setCapstone(prev => ({ ...prev, view_count: (prev.view_count || 0) + 1 }));
                } catch {}
            }

            try {
                const pdfRes = await api.get(`/capstones/${id}/pdf`, { responseType: 'blob' });
                const blob = new Blob([pdfRes.data], { type: 'application/pdf' });
                setPdfUrl(URL.createObjectURL(blob));
            } catch {
                console.error('Could not load PDF blob');
            }
        } catch (err) {
            notify.error('Failed to load capstone.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        try {
            const res = await downloadCapstone(id);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', capstone.pdf_original_name || `${capstone.title}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            setCapstone(prev => ({ ...prev, download_count: (prev.download_count || 0) + 1 }));
            notify.success('Download started.');
        } catch (err) {
            notify.error('Download failed.');
        }
    };

    const handleBookmark = async () => {
        try {
            const res = await toggleBookmark(id);
            setBookmarked(res.data.data.bookmarked);
            setCapstone(prev => ({ ...prev, bookmark_count: res.data.data.bookmark_count }));
            notify.success(res.data.data.bookmarked ? 'Bookmarked!' : 'Bookmark removed.');
        } catch (err) {
            notify.error('Bookmark action failed.');
        }
    };

    const handleShare = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            notify.success('Link copied to clipboard!');
        }).catch(() => {
            notify.info('Share URL: ' + url);
        });
    };

    if (loading) return <Loading text="Loading capstone..." />;
    if (!capstone) return <div className="text-center py-16 text-gray-500">Capstone not found.</div>;

    const uploadedDate = capstone.created_at
        ? new Date(capstone.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'â€”';

    const refs = capstone.referenced_capstones ?? capstone.referencedCapstones ?? [];

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* â”€â”€ Top bar â”€â”€ */}
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 pb-4">
                <button onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    <HiArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={handleDownload} className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B5E20] text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors shadow-sm">
                        <HiDownload className="w-4 h-4" /> Download
                    </button>
                    <button onClick={handleBookmark} className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors shadow-sm ${bookmarked ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                        <HiBookmark className="w-4 h-4" /> {bookmarked ? 'Saved' : 'Save'}
                    </button>
                    <button onClick={handleShare} className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm">
                        <HiShare className="w-4 h-4" /> Share
                    </button>
                </div>
            </div>

            {/* â”€â”€ Two-column layout: Info left, PDF right â”€â”€ */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="min-w-0 rounded-xl border border-green-200 bg-green-50/60 shadow-sm lg:col-span-5 h-full flex flex-col overflow-hidden">
                    <div className="p-5 flex flex-col h-full min-h-0 gap-4 overflow-y-auto custom-scrollbar">

                        {/* Title + Published badge */}
                        <div className="flex items-start gap-2 flex-wrap">
                            <h1 className="text-xl font-bold text-gray-900 leading-snug flex-1">{capstone.title}</h1>
                            <PublishedBadge published={capstone.is_published} />
                        </div>

                        {/* Metadata */}
                        <div className="flex flex-wrap gap-x-8 gap-y-2">
                            <InfoField label="Author" value={capstone.author || '—'} />
                            <InfoField label="Year" value={capstone.year || '—'} />
                            <InfoField label="Program" value={capstone.program || '—'} />
                            <InfoField label="Category" value={capstone.category || '—'} />
                            <InfoField label="Adviser" value={capstone.adviser?.name || '—'} />
                            <InfoField label="Uploaded By" value={capstone.uploader?.name || '—'} />
                            <InfoField label="Date Uploaded" value={uploadedDate} />
                        </div>

                        {/* Copyright Status */}
                        {capstone.copyright_status && (
                            <div className="flex items-center gap-2">
                                <HiShieldCheck className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <label className="text-[11px] font-semibold text-gray-500 uppercase">Copyright</label>
                                <CopyrightBadge status={capstone.copyright_status} />
                            </div>
                        )}

                        {/* IMRAD Section */}
                        <div>
                            <label className="text-[11px] font-semibold text-gray-500 uppercase block mb-1.5">IMRAD File</label>
                            {capstone.imrad_path ? (
                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-cyan-50 border border-cyan-200">
                                    <HiExternalLink className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                                    <span className="text-xs text-cyan-800 font-medium flex-1 truncate">
                                        {capstone.imrad_original_name || 'IMRAD Document'}
                                    </span>
                                    <span className="text-[10px] text-cyan-600 bg-cyan-100 px-2 py-0.5 rounded-full font-semibold">Available</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                                    <span className="text-xs text-gray-400 italic">Not Available</span>
                                </div>
                            )}
                        </div>

                        {/* Keywords / Tags */}
                        {capstone.keywords?.length > 0 && (
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase block mb-2">Keywords / Tags</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {capstone.keywords.map((kw, i) => (
                                        <span key={i} className="px-2.5 py-1 text-xs font-medium bg-white text-green-700 rounded-full border border-green-200">
                                            {kw.name || kw}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Abstract â€” collapsible */}
                        {capstone.abstract && (
                            <details className="group">
                                <summary className="text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none flex items-center gap-1">
                                    Abstract
                                    <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </summary>
                                <p className="text-sm text-gray-700 leading-relaxed text-justify indent-8 mt-2">
                                    {capstone.abstract.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()}
                                </p>
                            </details>
                        )}

                        {/* Referenced Capstones (cited works) */}
                        {refs.length > 0 && (
                            <details className="group">
                                <summary className="text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none flex items-center gap-1">
                                    <HiAcademicCap className="w-3.5 h-3.5" />
                                    Referenced Capstones ({refs.length})
                                    <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </summary>
                                <div className="mt-2 flex flex-col gap-2">
                                    {refs.map((ref) => (
                                        <ReferencedCard key={ref.id} item={ref} onOpen={() => navigate(`/student/capstones/${ref.id}`)} />
                                    ))}
                                </div>
                            </details>
                        )}

                        {/* Citation Generator */}
                        <CitationGenerator capstone={capstone} />

                        {/* Stats bar */}
                        <div className="flex items-center gap-6 pt-4 border-t border-green-200 mt-auto">
                            <StatInline icon={<HiEye className="w-4 h-4" />} value={capstone.view_count || 0} label="Views" />
                            <StatInline icon={<HiDownload className="w-4 h-4" />} value={capstone.download_count || 0} label="Downloads" />
                            <StatInline icon={<HiBookmark className="w-4 h-4" />} value={capstone.bookmark_count || 0} label="Saved" />
                        </div>
                    </div>
                </div>

                {/* PDF Viewer */}
                <div className="flex-1 min-h-0 min-w-0 lg:col-span-7 h-full flex flex-col gap-2" ref={pdfContainerRef}>
                    {/* PDF toolbar */}
                    <div className="shrink-0 flex items-center justify-between px-1">
                        <span className="text-xs text-gray-500 font-medium">
                            {numPages ? `${numPages} page${numPages !== 1 ? 's' : ''}` : ''}
                        </span>
                        {pdfUrl && (
                            <button
                                onClick={() => setFullscreen(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                            >
                                <HiArrowsExpand className="w-3.5 h-3.5" />
                                Fullscreen
                            </button>
                        )}
                    </div>
                    <div className="flex-1 min-h-0 rounded-xl bg-gray-100 overflow-y-auto custom-scrollbar">
                        {pdfUrl ? (
                            <Document
                                file={pdfUrl}
                                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                                loading={<div className="flex items-center justify-center py-20"><Loading text="Loading PDF..." /></div>}
                                error={<div className="text-center py-20 text-gray-500">Failed to load PDF.</div>}
                            >
                                {Array.from(new Array(numPages), (_, i) => (
                                    <Page
                                        key={`page_${i + 1}`}
                                        pageNumber={i + 1}
                                        width={pdfWidth}
                                        className="mb-1"
                                        renderTextLayer={true}
                                        renderAnnotationLayer={true}
                                    />
                                ))}
                            </Document>
                        ) : (
                            <div className="flex items-center justify-center py-20 text-gray-400">
                                No PDF available.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* â”€â”€ Fullscreen PDF Modal â”€â”€ */}
            {fullscreen && (
                <div className="fixed inset-0 z-[999] flex flex-col bg-gray-950/95 backdrop-blur-sm">
                    {/* FS header */}
                    <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-3 bg-gray-900 border-b border-gray-700 shadow-lg">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className="text-white font-semibold text-sm truncate max-w-sm lg:max-w-lg">{capstone.title}</span>
                            {fsNumPages && (
                                <span className="shrink-0 text-gray-400 text-xs">{fsNumPages} page{fsNumPages !== 1 ? 's' : ''}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={handleDownload}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#1B5E20] rounded-lg hover:bg-green-700 transition-colors"
                            >
                                <HiDownload className="w-3.5 h-3.5" /> Download
                            </button>
                            <button
                                onClick={() => setFullscreen(false)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
                                title="Close (Esc)"
                            >
                                <HiX className="w-3.5 h-3.5" /> Close
                            </button>
                        </div>
                    </div>

                    {/* FS scrollable PDF area */}
                    <div ref={fsContainerRef} className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarColor: '#4b5563 #111827' }}>
                        <div className="flex justify-center py-6 px-4">
                            <Document
                                file={pdfUrl}
                                onLoadSuccess={({ numPages }) => setFsNumPages(numPages)}
                                loading={<div className="flex items-center justify-center py-20"><Loading text="Loading PDF..." /></div>}
                                error={<div className="text-center py-20 text-gray-400">Failed to load PDF.</div>}
                            >
                                {Array.from(new Array(fsNumPages), (_, i) => (
                                    <Page
                                        key={`fs_page_${i + 1}`}
                                        pageNumber={i + 1}
                                        width={fsWidth}
                                        className="mb-3 shadow-2xl"
                                        renderTextLayer={true}
                                        renderAnnotationLayer={true}
                                    />
                                ))}
                            </Document>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function PublishedBadge({ published }) {
    return (
        <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
            published
                ? 'bg-green-100 text-green-700 border-green-300'
                : 'bg-gray-100 text-gray-500 border-gray-300'
        }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${published ? 'bg-green-500' : 'bg-gray-400'}`} />
            {published ? 'Published' : 'Unpublished'}
        </span>
    );
}

function ReferencedCard({ item, onOpen }) {
    return (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white border border-green-100 hover:border-green-300 transition-colors group">
            <HiAcademicCap className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">{item.title}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                    {[item.author, item.year, item.program].filter(Boolean).join(' Â· ')}
                </p>
            </div>
            <button
                onClick={onOpen}
                className="shrink-0 text-gray-400 group-hover:text-green-600 transition-colors"
                title="Open capstone"
            >
                <HiExternalLink className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

function InfoField({ label, value }) {
    return (
        <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase block mb-0.5">{label}</label>
            <p className="text-sm text-gray-800 font-medium">{value}</p>
        </div>
    );
}

function StatInline({ icon, value, label }) {
    return (
        <div className="flex items-center gap-1.5 text-gray-600">
            <span className="text-green-600">{icon}</span>
            <span className="font-bold text-gray-900">{value}</span>
            <span className="text-xs text-gray-500">{label}</span>
        </div>
    );
}

const COPYRIGHT_BADGE_STYLES = {
    copyrighted:  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', dot: 'bg-purple-500', label: 'Copyrighted' },
    pending:      { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300',  dot: 'bg-amber-500',  label: 'Pending' },
    unprotected:  { bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-300',   dot: 'bg-gray-400',   label: 'Unprotected' },
};

function CopyrightBadge({ status }) {
    const s = COPYRIGHT_BADGE_STYLES[status];
    if (!s) return null;
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${s.bg} ${s.text} ${s.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
        </span>
    );
}
