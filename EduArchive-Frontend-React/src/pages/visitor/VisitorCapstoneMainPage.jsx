import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    HiArrowLeft, HiArrowsExpand, HiX, HiExternalLink,
    HiShieldCheck, HiLockClosed, HiBookmark, HiShare,
    HiOutlineBookmark, HiAcademicCap, HiOutlineFolder, HiOutlineDocumentText,
} from 'react-icons/hi';
import { getVisitorCapstone, loadVisitorImrad, toggleVisitorBookmark } from '../../api/visitor';
import { useNotification } from '../../components/useNotification';
import AuthorDetailsModal from '../../components/AuthorDetailsModal';
import CitationGenerator from '../../components/CitationGenerator';
import Loading from '../../components/Loading';
import PdfLoadState from '../../components/PdfLoadState';
import { pdfjs } from 'react-pdf';
import Document from '../../components/ProgressivePdfDocument';
import PdfZoomControls from '../../components/PdfZoomControls';
import ViewportPdfPage from '../../components/ViewportPdfPage';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import api from '../../api/axios';
import { usePdfBlob } from '../../components/usePdfBlob';
import { useChatbotContext } from '../../context/useChatbotContext';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export default function VisitorCapstoneMainPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const notify = useNotification();
    const { setCapstoneContext } = useChatbotContext();

    const [capstone, setCapstone]       = useState(null);
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState(null);
    const [showAuthors, setShowAuthors] = useState(false);
    const [bookmarked, setBookmarked]   = useState(false);

    // PDF state
    const [imradUrl, setImradUrl]       = useState(null);
    const [imradError, setImradError]   = useState(null);
    const [activePdf, setActivePdf]     = useState(null); // null | 'capstone' | 'imrad'
    const canSeeCapstonePdf = Boolean(capstone?.visitor_can_see_pdf && capstone?.pdf_available);
    const {
        url: pdfUrl,
        file: pdfFile,
        status: pdfStatus,
        progress: pdfProgress,
        error: pdfError,
        retry: retryPdf,
        onLoadProgress: onPdfLoadProgress,
        onLoadSuccess: onPdfLoadSuccess,
        onLoadError: onPdfLoadError,
    } = usePdfBlob(`/visitor/capstones/${id}/pdf`, { enabled: canSeeCapstonePdf });
    const [numPages, setNumPages]       = useState(null);
    const [loadAllText, setLoadAllText] = useState(false);
    const [pdfWidth, setPdfWidth]       = useState(600);
    const [fullscreen, setFullscreen]   = useState(false);
    const [fsNumPages, setFsNumPages]   = useState(null);
    const [fsWidth, setFsWidth]         = useState(900);
    const [fsZoom, setFsZoom] = useState(1);

    const pdfContainerRef = useRef(null);
    const fsContainerRef  = useRef(null);
    const navigateToPdfPage = ({ pageNumber, pageIndex }) => {
        const targetPage = pageNumber ?? (pageIndex + 1);
        const container = fullscreen ? fsContainerRef.current : pdfContainerRef.current;
        container?.querySelector(`[data-document-page="${targetPage}"]`)?.scrollIntoView({ block: 'start' });
    };
    // The primary PDF blob URL is owned by usePdfBlob; only the IMRAD URL is local.
    const blobUrlsRef = useRef({ imrad: null });

    // ── Width handling ─────────────────────────────────────
    useEffect(() => {
        const update = () => { if (pdfContainerRef.current) setPdfWidth(pdfContainerRef.current.clientWidth - 2); };
        update();
        const observer = new ResizeObserver(update);
        if (pdfContainerRef.current) observer.observe(pdfContainerRef.current);
        return () => observer.disconnect();
    }, [loading]);

    useEffect(() => {
        if (!fullscreen) return;
        const update = () => { if (fsContainerRef.current) setFsWidth(Math.min(fsContainerRef.current.clientWidth - 48, 1100)); };
        update();
        const observer = new ResizeObserver(update);
        if (fsContainerRef.current) observer.observe(fsContainerRef.current);
        return () => observer.disconnect();
    }, [fullscreen]);

    useEffect(() => {
        document.body.style.overflow = fullscreen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [fullscreen]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') setFullscreen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Cleanup the IMRAD blob URL only on unmount
    useEffect(() => {
        return () => {
            if (blobUrlsRef.current.imrad) URL.revokeObjectURL(blobUrlsRef.current.imrad);
        };
    }, []);

    // ── Fetch capstone ─────────────────────────────────────
    useEffect(() => { fetchCapstone(); }, [id]);

    useEffect(() => {
        if (capstone) {
            setCapstoneContext({
                id: capstone.id,
                title: capstone.title,
                author: capstone.author,
                year: capstone.year,
                program: capstone.program,
                category: capstone.category,
                abstract: capstone.abstract,
                keywords: capstone.keywords,
            });
        }
        return () => setCapstoneContext(null);
    }, [capstone?.id, setCapstoneContext]);

    const fetchCapstone = async () => {
        try {
            setLoading(true);
            setError(null);
            setCapstone(null);
            const res  = await getVisitorCapstone(id);
            const data = res.data.data;
            setCapstone(data);
            setBookmarked(data.is_bookmarked ?? false);

            // Metadata is ready; choose the default document tab. The full PDF
            // downloads independently and never blocks this page.
            if (data.visitor_can_see_pdf && data.pdf_available) {
                setActivePdf('capstone');
            } else if (data.imrad_available) {
                setActivePdf('imrad');
                tryLoadImrad();
            }
        } catch {
            setError('This capstone could not be found or you do not have access to it.');
        } finally {
            setLoading(false);
        }
    };

    const tryLoadImrad = async () => {
        try {
            setImradError(null);
            const r = await loadVisitorImrad(id);
            blobUrlsRef.current.imrad = r;
            setImradUrl(r);
            setActivePdf('imrad');
        } catch {
            setImradError('The IMRAD document could not be loaded.');
        }
    };

    // ── Toggle between capstone/IMRAD ─────────────────────
    const switchToImrad = async () => {
        if (imradUrl) { setActivePdf('imrad'); setNumPages(null); return; }
        await tryLoadImrad();
    };
    const switchToCapstone = () => { setActivePdf('capstone'); setNumPages(null); };

    const handleViewResource = async (resource) => {
        try {
            const res = await api.get(`/capstones/${id}/resources/${resource.id}/view`, { responseType: 'blob' });
            const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank', 'noopener,noreferrer');
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch {
            notify.error('Could not open resource file.');
        }
    };

    // ── Bookmark ───────────────────────────────────────────
    const handleBookmark = async () => {
        try {
            await toggleVisitorBookmark(id);
            setBookmarked(prev => !prev);
            notify.success(bookmarked ? 'Bookmark removed.' : 'Saved to your folder!');
        } catch {
            notify.error('Bookmark action failed.');
        }
    };

    // ── Share ──────────────────────────────────────────────
    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href)
            .then(() => notify.success('Link copied to clipboard!'))
            .catch(() => notify.info('Share URL: ' + window.location.href));
    };

    // ── Helpers ────────────────────────────────────────────
    const currentUrl = activePdf === 'capstone' ? pdfUrl : imradUrl;

    if (loading) return <Loading text="Loading capstone..." />;
    if (error || !capstone) return (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-6" role="alert">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                {error || 'This capstone could not be found or you do not have access to it.'}
            </p>
            <div className="flex items-center gap-2">
                <button onClick={fetchCapstone} className="px-4 py-2 bg-[#1B5E20] text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors">
                    Retry
                </button>
                <button onClick={() => navigate(-1)} className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
                    Go back
                </button>
            </div>
        </div>
    );

    const uploadedDate = capstone.created_at
        ? new Date(capstone.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : '—';

    const isImradOnly    = capstone.visitor_imrad_only;
    const canSeePdf      = capstone.visitor_can_see_pdf;

    return (
        <div className="space-y-4">
            <AuthorDetailsModal open={showAuthors} onClose={() => setShowAuthors(false)} capstone={capstone} />

            {/* ── Top bar ── */}
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 pb-4">
                <button onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 text-sm transition-colors hover:opacity-80"
                    style={{ color: 'var(--color-text-muted)' }}>
                    <HiArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="flex flex-wrap items-center gap-2">
                    {/* View Authors */}
                    <button onClick={() => setShowAuthors(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
                        style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}>
                        <HiAcademicCap className="w-4 h-4" /> View Authors Details
                    </button>
                    {/* Save */}
                    <button onClick={handleBookmark}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors shadow-sm ${bookmarked ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                        {bookmarked ? <HiBookmark className="w-4 h-4" /> : <HiOutlineBookmark className="w-4 h-4" />}
                        {bookmarked ? 'Saved' : 'Save'}
                    </button>
                    {/* Share */}
                    <button onClick={handleShare}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
                        style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}>
                        <HiShare className="w-4 h-4" /> Share
                    </button>
                    {/* No download button for visitors */}
                </div>
            </div>

            {/* ── IMRAD-only notice banner ── */}
            {isImradOnly && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-cyan-50 border-cyan-200 text-cyan-800">
                    <HiLockClosed className="w-5 h-5 flex-shrink-0 text-cyan-600" />
                    <p className="text-sm font-medium">This capstone is available for IMRAD viewing only. The full capstone document is restricted.</p>
                </div>
            )}

            {/* ── Two-column layout ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

                {/* Left: Info */}
                <div className="min-w-0 rounded-xl border shadow-sm lg:col-span-5"
                    style={{ borderColor: isImradOnly ? '#a5f3fc' : 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                    <div className="p-5 flex flex-col gap-4">

                        {/* Title */}
                        <div className="record-title-row flex items-start gap-2 flex-wrap">
                            <h1
                                className={`text-xl font-bold leading-snug flex-1 transition-colors ${canSeePdf && activePdf === 'imrad' ? 'cursor-pointer text-[#1B5E20] underline decoration-dotted underline-offset-2 hover:text-green-800' : ''}`}
                                style={!(canSeePdf && activePdf === 'imrad') ? { color: 'var(--color-text)' } : {}}
                                onClick={canSeePdf && activePdf === 'imrad' ? switchToCapstone : undefined}
                                title={canSeePdf && activePdf === 'imrad' ? 'Click to view original capstone PDF' : undefined}
                            >
                                {capstone.title}
                            </h1>
                            {capstone.publication_status === 'published' && (
                                <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-green-100 text-green-700 border-green-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Published
                                </span>
                            )}
                        </div>

                        {/* Metadata */}
                        <div className="flex flex-wrap gap-x-8 gap-y-2">
                            <InfoField label="Uploaded By" value={capstone.uploader?.name || '-'} />
                        <InfoField label="Author"   value={capstone.author   || '-'} />
                            <InfoField label="Year"     value={capstone.year     || '—'} />
                            <InfoField label="Program"  value={capstone.program  || '—'} />
                            <InfoField label="Category" value={capstone.category || '—'} />
                            {(capstone.adviser_name || capstone.adviser?.name) && <InfoField label="Adviser" value={capstone.adviser_name || capstone.adviser.name} />}
                            <InfoField label="Date Uploaded" value={uploadedDate} />
                        </div>

                        {/* Copyright */}
                        {capstone.copyright_status && (
                            <div className="flex items-center gap-2">
                                <HiShieldCheck className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <label className="text-[11px] font-semibold text-gray-500 uppercase">Copyright</label>
                                <CopyrightBadge status={capstone.copyright_status} />
                            </div>
                        )}

                        {/* IMRAD chip */}
                        {capstone.imrad_available && (
                            <div>
                                <label className="text-[11px] font-semibold text-gray-500 uppercase block mb-1.5">IMRAD File</label>
                                {canSeePdf ? (
                                    // Can toggle between capstone PDF and IMRAD
                                    <button
                                        onClick={activePdf === 'imrad' ? switchToCapstone : switchToImrad}
                                        className={`w-full flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left ${activePdf === 'imrad' ? 'bg-cyan-100 border-cyan-400 ring-2 ring-cyan-300' : 'bg-cyan-50 border-cyan-200 hover:bg-cyan-100 hover:border-cyan-300'}`}
                                        title={activePdf === 'imrad' ? 'Click to view original capstone PDF' : 'Click to view IMRAD PDF'}
                                    >
                                        <HiExternalLink className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                                        <span className="text-xs text-cyan-800 font-medium flex-1 truncate">
                                            {capstone.imrad_original_name || 'IMRAD Document'}
                                        </span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${activePdf === 'imrad' ? 'bg-cyan-500 text-white' : 'bg-cyan-100 text-cyan-600'}`}>
                                            {activePdf === 'imrad' ? 'Viewing' : 'View'}
                                        </span>
                                    </button>
                                ) : (
                                    // IMRAD-only — informational (already loaded)
                                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-cyan-100 border border-cyan-400">
                                        <HiExternalLink className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                                        <span className="text-xs text-cyan-800 font-medium flex-1 truncate">
                                            {capstone.imrad_original_name || 'IMRAD Document'}
                                        </span>
                                        <span className="text-[10px] bg-cyan-500 text-white px-2 py-0.5 rounded-full font-semibold">Viewing</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Capstone PDF restricted notice */}
                        {isImradOnly && (
                            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200" style={{ background: 'var(--color-bg-tertiary)' }}>
                                <HiLockClosed className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="text-xs text-gray-400 italic">Full capstone PDF is restricted</span>
                            </div>
                        )}

                        {/* Keywords */}
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

                        {/* Additional Resources — visible when capstone is published OR copyrighted */}
                        {capstone.resources?.length > 0 && (capstone.publication_status === 'published' || capstone.copyright_status === 'copyrighted') && (
                            <details className="group">
                                <summary className="text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none flex items-center gap-1">
                                    <HiOutlineFolder className="w-3.5 h-3.5" />
                                    Additional Resources ({capstone.resources.length})
                                    <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </summary>
                                <div className="mt-2 flex flex-col gap-1.5">
                                    {capstone.resources.map((res) => (
                                        <div key={res.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-green-100 hover:border-green-300 transition-colors">
                                            <HiOutlineDocumentText className="w-4 h-4 text-green-500 shrink-0" />
                                            <p className="flex-1 text-xs font-medium text-gray-800 truncate" title={res.file_original_name || res.name}>
                                                {res.name || res.file_original_name}
                                            </p>
                                            <button
                                                onClick={() => handleViewResource(res)}
                                                className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                                                title="Open in new tab"
                                            >
                                                <HiExternalLink className="w-3 h-3" /> View
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}

                        {/* Abstract */}
                        {capstone.abstract && (
                            <details className="group">
                                <summary className="text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none flex items-center gap-1">
                                    Abstract
                                    <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </summary>
                                <p className="text-sm leading-relaxed text-justify indent-8 mt-2" style={{ color: 'var(--color-text)' }}>
                                    {capstone.abstract.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()}
                                </p>
                            </details>
                        )}

                        {/* Citation */}
                        <CitationGenerator capstone={capstone} />
                    </div>
                </div>

                {/* Right: PDF Viewer */}
                <div
                    className="min-w-0 lg:col-span-7 flex flex-col gap-2 lg:sticky lg:top-0"
                    style={{ height: 'calc(100vh - 140px)' }}
                    ref={pdfContainerRef}
                >
                    {/* Toolbar */}
                    <div className="shrink-0 flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                {numPages ? `${numPages} page${numPages !== 1 ? 's' : ''}` : ''}
                            </span>
                            {numPages > 1 && <button type="button" onClick={() => setLoadAllText(true)} disabled={loadAllText}
                                className="text-xs text-gray-500 underline disabled:no-underline"
                                title="Load text on every page for your browser's Find command. Large documents may take longer.">
                                {loadAllText ? 'All-page text enabled' : 'Load all page text'}
                            </button>}
                            {activePdf === 'imrad' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200">
                                    IMRAD View
                                </span>
                            )}
                        </div>
                        {currentUrl && (
                            <button onClick={() => setFullscreen(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                                <HiArrowsExpand className="w-3.5 h-3.5" /> Fullscreen
                            </button>
                        )}
                    </div>

                    <div className="flex-1 min-h-0 rounded-xl bg-gray-100 overflow-y-auto custom-scrollbar">
                        {activePdf === 'capstone' ? (
                            pdfUrl && pdfStatus !== 'error' ? (
                                <Document key={String(capstone?.id) + ":" + activePdf} documentId={capstone?.id ? `${capstone.id}:${activePdf}` : null} progressActive={!fullscreen}
                                    onItemClick={navigateToPdfPage}
                                    file={pdfFile}
                                    onLoadProgress={onPdfLoadProgress}
                                    onLoadError={onPdfLoadError}
                                    onLoadSuccess={({ numPages }) => { onPdfLoadSuccess(); setNumPages(numPages); }}
                                    loading={<PdfLoadState status={pdfStatus} progress={pdfProgress} error={pdfError} onRetry={retryPdf} />}
                                    error={<div className="text-center py-20 text-gray-500">The document was downloaded but could not be rendered.</div>}
                                >
                                    {Array.from(new Array(numPages), (_, i) => (
                                        <ViewportPdfPage key={`page_${i + 1}`} loadText={loadAllText} pageNumber={i + 1} width={pdfWidth} className="mb-1"
                                            renderTextLayer={true} renderAnnotationLayer={true} />
                                    ))}
                                </Document>
                            ) : (
                                <PdfLoadState status={pdfStatus} progress={pdfProgress} error={pdfError} onRetry={retryPdf}
                                    emptyText="The full document is not available for your account." />
                            )
                        ) : activePdf === 'imrad' ? (
                            imradUrl ? (
                                <Document key={String(capstone?.id) + ":" + activePdf} documentId={capstone?.id ? `${capstone.id}:${activePdf}` : null} progressActive={!fullscreen}
                                    onItemClick={navigateToPdfPage}
                                    file={imradUrl}
                                    onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                                    loading={<div className="flex items-center justify-center py-20"><Loading text="Rendering IMRAD PDF..." /></div>}
                                    error={<div className="text-center py-20 text-gray-500">Failed to render IMRAD PDF.</div>}
                                >
                                    {Array.from(new Array(numPages), (_, i) => (
                                        <ViewportPdfPage key={`page_${i + 1}`} loadText={loadAllText} pageNumber={i + 1} width={pdfWidth} className="mb-1"
                                            renderTextLayer={true} renderAnnotationLayer={true} />
                                    ))}
                                </Document>
                            ) : (
                                <PdfLoadState status={imradError ? 'error' : 'loading'} error={imradError}
                                    onRetry={tryLoadImrad} emptyText="No IMRAD document is available." />
                            )
                        ) : (
                            <PdfLoadState status="idle" emptyText="No document is available for your account." />
                        )}
                    </div>
                </div>
            </div>

            {/* ── Fullscreen ── */}
            {fullscreen && (
                <div className="fixed inset-0 z-[999] flex flex-col bg-gray-950/95 backdrop-blur-sm">
                    <div className="pdf-fullscreen-header shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-gray-900 border-b border-gray-700 shadow-lg">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className="text-white font-semibold text-sm truncate max-w-sm lg:max-w-lg">{capstone.title}</span>
                            {activePdf === 'imrad' && (
                                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-700 text-cyan-100 border border-cyan-600">IMRAD</span>
                            )}
                            {fsNumPages && <span className="shrink-0 text-gray-400 text-xs">{fsNumPages} page{fsNumPages !== 1 ? 's' : ''}</span>}
                        </div>
                        <PdfZoomControls zoom={fsZoom} onChange={setFsZoom} />
                        <button onClick={() => setFullscreen(false)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
                            title="Close (Esc)">
                            <HiX className="w-3.5 h-3.5" /> Close
                        </button>
                    </div>
                    <div ref={fsContainerRef} className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarColor: '#4b5563 #111827' }}>
                        <div className="flex justify-center min-w-max py-6 px-4">
                            {currentUrl && !(activePdf === 'capstone' && pdfStatus === 'error') ? (
                                <Document key={String(capstone?.id) + ":" + activePdf} documentId={capstone?.id ? `${capstone.id}:${activePdf}` : null}
                                    onItemClick={navigateToPdfPage}
                                    file={activePdf === 'capstone' ? pdfFile : currentUrl}
                                    onLoadProgress={activePdf === 'capstone' ? onPdfLoadProgress : undefined}
                                    onLoadError={activePdf === 'capstone' ? onPdfLoadError : undefined}
                                    onLoadSuccess={({ numPages }) => { if (activePdf === 'capstone') onPdfLoadSuccess(); setFsNumPages(numPages); }}
                                    loading={<div className="flex items-center justify-center py-20"><Loading text="Rendering PDF..." /></div>}
                                    error={<div className="text-center py-20 text-gray-400">Failed to render PDF.</div>}
                                >
                                    {Array.from(new Array(fsNumPages), (_, i) => (
                                        <ViewportPdfPage key={`fs_page_${i + 1}`} loadText={loadAllText} pageNumber={i + 1} width={Math.max(1, Math.round(fsWidth * fsZoom))} className="mb-3 shadow-2xl"
                                            renderTextLayer={true} renderAnnotationLayer={true} />
                                    ))}
                                </Document>
                            ) : (
                                <PdfLoadState status={activePdf === 'imrad' ? (imradError ? 'error' : 'loading') : pdfStatus}
                                    progress={activePdf === 'capstone' ? pdfProgress : null}
                                    error={activePdf === 'imrad' ? imradError : pdfError}
                                    onRetry={activePdf === 'imrad' ? tryLoadImrad : retryPdf}
                                    emptyText="No document is available." />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function InfoField({ label, value }) {
    return (
        <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase block mb-0.5">{label}</label>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{value}</p>
        </div>
    );
}

const COPYRIGHT_STYLES = {
    copyrighted: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', dot: 'bg-purple-500', label: 'Copyrighted' },
    pending:     { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300',  dot: 'bg-amber-500',  label: 'Pending' },
    unprotected: { bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-300',   dot: 'bg-gray-400',   label: 'Not Yet Copyrighted' },
};

function CopyrightBadge({ status }) {
    const s = COPYRIGHT_STYLES[status];
    if (!s) return null;
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${s.bg} ${s.text} ${s.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {s.label}
        </span>
    );
}
