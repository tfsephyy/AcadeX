import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HiArrowLeft, HiDownload, HiBookmark, HiShare, HiEye } from 'react-icons/hi';
import { getCapstone, recordView, downloadCapstone, toggleBookmark } from '../../api/admin';
import { useNotification } from '../../components/Notification';
import CitationGenerator from '../../components/CitationGenerator';
import Loading from '../../components/Loading';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import api from '../../api/axios';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function StudentCapstoneMainPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const notify = useNotification();
    const [capstone, setCapstone] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bookmarked, setBookmarked] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [numPages, setNumPages] = useState(null);
    const [pdfWidth, setPdfWidth] = useState(600);
    const pdfContainerRef = useRef(null);
    const viewRecorded = useRef(false);

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

            // Record view — only once per session per capstone
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
        : '—';

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* ── Top bar ── */}
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

            {/* ── Two-column layout: Info left, PDF right ── */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="min-w-0 rounded-xl border border-green-200 bg-green-50/60 shadow-sm lg:col-span-5 h-full flex flex-col overflow-hidden">
                    <div className="p-5 flex flex-col h-full min-h-0 gap-4 overflow-y-auto custom-scrollbar">
                        <h1 className="text-xl font-bold text-gray-900 leading-snug">{capstone.title}</h1>

                        <div className="flex flex-wrap gap-x-8 gap-y-2">
                            <InfoField label="Author" value={capstone.author || '—'} />
                            <InfoField label="Year" value={capstone.year || '—'} />
                            <InfoField label="Program" value={capstone.program || '—'} />
                            <InfoField label="Category" value={capstone.category || '—'} />
                            <InfoField label="Uploaded By" value={capstone.uploader?.name || '—'} />
                            <InfoField label="Date Uploaded" value={uploadedDate} />
                        </div>

                        {capstone.keywords?.length > 0 && (
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase block mb-2">Keywords</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {capstone.keywords.map((kw, i) => (
                                        <span key={i} className="px-2.5 py-1 text-xs font-medium bg-white text-green-700 rounded-full border border-green-200">
                                            {kw.name || kw}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

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

                        {/* Citation Generator */}
                        <CitationGenerator capstone={capstone} />

                        <div className="flex items-center gap-6 pt-4 border-t border-green-200 mt-auto">
                            <StatInline icon={<HiEye className="w-4 h-4" />} value={capstone.view_count || 0} label="Views" />
                            <StatInline icon={<HiDownload className="w-4 h-4" />} value={capstone.download_count || 0} label="Downloads" />
                            <StatInline icon={<HiBookmark className="w-4 h-4" />} value={capstone.bookmark_count || 0} label="Saved" />
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-0 min-w-0 lg:col-span-7 h-full" ref={pdfContainerRef}>
                    <div className="rounded-xl bg-gray-100 overflow-y-auto custom-scrollbar h-full">
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
