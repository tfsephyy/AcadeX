import { useState } from 'react';
import { HiOutlineClipboardCopy, HiOutlineDownload, HiOutlineDocumentText } from 'react-icons/hi';

/**
 * CitationGenerator — generates APA 7th and MLA 9th citations
 * for capstone projects based on extracted metadata.
 */
export default function CitationGenerator({ capstone }) {
    const [tab, setTab] = useState('apa'); // 'apa' | 'mla'
    const [copied, setCopied] = useState(false);

    if (!capstone) return null;

    const title = capstone.title || 'Untitled';
    const year = capstone.year || 'n.d.';
    const authorRaw = capstone.author || 'Unknown Author';
    const school = 'Mindoro State University';

    // ── Parse author names ──────────────────────────────
    const parseAuthors = (raw) => {
        // Split by comma, "&", "and"
        const parts = raw
            .split(/,\s*(?=[A-Z])|\s+(?:and|&)\s+/i)
            .map(a => a.trim())
            .filter(a => a.length > 0);

        return parts.map(name => {
            // Handle "Last, First Middle" format already
            if (name.includes(',')) {
                const [last, ...rest] = name.split(',').map(s => s.trim());
                return { last, first: rest.join(' ') };
            }
            // Handle "First Middle Last" format
            const words = name.split(/\s+/);
            if (words.length === 1) return { last: words[0], first: '' };
            const last = words[words.length - 1];
            const first = words.slice(0, -1).join(' ');
            return { last, first };
        });
    };

    const authors = parseAuthors(authorRaw);

    // ── APA 7th Edition ─────────────────────────────────
    const toSentenceCase = (str) => {
        // Capitalize first letter, lowercase the rest, preserve after colon
        return str.replace(/^(.)(.*)$/, (_, first, rest) => {
            let result = first.toUpperCase() + rest.toLowerCase();
            // Re-capitalize after colon + space
            result = result.replace(/:\s*([a-z])/g, (m, c) => ': ' + c.toUpperCase());
            return result;
        });
    };

    const formatApaAuthor = (author) => {
        if (!author.first) return author.last;
        // Convert first name(s) to initials: "Jamaica Rhea" → "J. R."
        const initials = author.first
            .split(/\s+/)
            .map(n => n.charAt(0).toUpperCase() + '.')
            .join(' ');
        return `${author.last}, ${initials}`;
    };

    const getApaAuthors = () => {
        if (authors.length === 1) return formatApaAuthor(authors[0]);
        if (authors.length === 2) {
            return `${formatApaAuthor(authors[0])} & ${formatApaAuthor(authors[1])}`;
        }
        // 3+ authors: all names separated by commas, & before last
        const formatted = authors.map(formatApaAuthor);
        return formatted.slice(0, -1).join(', ') + ', & ' + formatted[formatted.length - 1];
    };

    const apaCitation = `${getApaAuthors()} (${year}). ${toSentenceCase(title)} [Unpublished capstone project]. ${school}.`;

    // ── MLA 9th Edition ─────────────────────────────────
    const toTitleCase = (str) => {
        const minor = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'in', 'of', 'up', 'as'];
        return str.replace(/\w\S*/g, (word, index) => {
            if (index !== 0 && minor.includes(word.toLowerCase())) {
                return word.toLowerCase();
            }
            return word.charAt(0).toUpperCase() + word.substr(1).toLowerCase();
        });
    };

    const getMlaAuthors = () => {
        if (authors.length === 1) {
            const a = authors[0];
            return a.first ? `${a.last}, ${a.first}` : a.last;
        }
        if (authors.length === 2) {
            const a1 = authors[0];
            const a2 = authors[1];
            const first = a1.first ? `${a1.last}, ${a1.first}` : a1.last;
            const second = a2.first ? `${a2.first} ${a2.last}` : a2.last;
            return `${first}, and ${second}`;
        }
        // 3+ authors: first author + "et al."
        const a = authors[0];
        return a.first ? `${a.last}, ${a.first}, et al` : `${a.last}, et al`;
    };

    const mlaCitation = `${getMlaAuthors()}. ${toTitleCase(title)}. ${school}, ${year}. Unpublished capstone project.`;

    const currentCitation = tab === 'apa' ? apaCitation : mlaCitation;
    const currentLabel = tab === 'apa' ? 'APA 7th Edition' : 'MLA 9th Edition';

    // ── Actions ─────────────────────────────────────────
    const handleCopy = () => {
        navigator.clipboard.writeText(currentCitation).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => {});
    };

    const handleDownload = () => {
        const content = `${currentLabel} Citation\n${'─'.repeat(40)}\n\n${currentCitation}\n`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `citation_${tab}_${(title || 'capstone').replace(/\s+/g, '_').substring(0, 30)}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    // ── Render citation with italic title ───────────────
    const renderCitation = () => {
        const citation = currentCitation;
        const titleText = tab === 'apa' ? toSentenceCase(title) : toTitleCase(title);
        const parts = citation.split(titleText);

        if (parts.length < 2) {
            return <span>{citation}</span>;
        }

        return (
            <span>
                {parts[0]}<em className="font-medium">{titleText}</em>{parts.slice(1).join(titleText)}
            </span>
        );
    };

    return (
        <details className="group">
            <summary className="text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none flex items-center gap-1">
                <HiOutlineDocumentText className="w-3.5 h-3.5" />
                Citation
                <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </summary>

            <div className="mt-3 rounded-lg border border-green-200 bg-white overflow-hidden">
                {/* Tab switcher */}
                <div className="flex border-b border-green-200">
                    <button
                        onClick={() => { setTab('apa'); setCopied(false); }}
                        className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors ${
                            tab === 'apa'
                                ? 'bg-green-50 text-green-700 border-b-2 border-green-600'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        APA 7th Edition
                    </button>
                    <button
                        onClick={() => { setTab('mla'); setCopied(false); }}
                        className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors ${
                            tab === 'mla'
                                ? 'bg-green-50 text-green-700 border-b-2 border-green-600'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        MLA 9th Edition
                    </button>
                </div>

                {/* Citation text */}
                <div className="p-4">
                    <div className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                        {renderCitation()}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-3">
                        <button
                            onClick={handleCopy}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                copied
                                    ? 'bg-green-100 text-green-700 border border-green-300'
                                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                        >
                            <HiOutlineClipboardCopy className="w-3.5 h-3.5" />
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                            onClick={handleDownload}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
                        >
                            <HiOutlineDownload className="w-3.5 h-3.5" />
                            Download
                        </button>
                    </div>
                </div>
            </div>
        </details>
    );
}
