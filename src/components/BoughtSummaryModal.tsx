import React, { useMemo, useRef, useState } from 'react';
import { X, Copy, Download, Image as ImageIcon, Check } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatMonth } from '../utils/formatters';

export interface SummaryRow {
    symbol: string;
    shares: number;
    avgPrice: number;
    amount: number;
}

interface BoughtSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** What's on screen right now -- the draft entries, or the ones just committed. */
    rows: SummaryRow[];
    month: string;
}

type Row = SummaryRow;

// The image is drawn straight onto a canvas rather than screenshotting the DOM: no extra
// dependency, and the output is identical on every browser instead of inheriting whatever
// the page happens to look like.
const drawSummary = (canvas: HTMLCanvasElement, month: string, rows: Row[], total: number) => {
    const scale = window.devicePixelRatio || 2;
    const width = 640;
    const headerHeight = 104;
    const rowHeight = 44;
    const footerHeight = 76;
    const height = headerHeight + 40 + rows.length * rowHeight + footerHeight;

    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);
    const sans = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    // Card
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Header band
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, headerHeight);

    ctx.fillStyle = '#60a5fa';
    ctx.font = `800 11px ${sans}`;
    ctx.fillText('FINSIP · BOUGHT THIS MONTH', 32, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 26px ${sans}`;
    ctx.fillText(formatMonth(month), 32, 74);

    // Column headers
    const colSymbol = 32;
    const colShares = 300;
    const colPrice = 420;
    const colAmount = width - 32;
    let y = headerHeight + 32;

    ctx.fillStyle = '#94a3b8';
    ctx.font = `700 11px ${sans}`;
    ctx.textAlign = 'left';
    ctx.fillText('SYMBOL', colSymbol, y);
    ctx.textAlign = 'right';
    ctx.fillText('SHARES', colShares, y);
    ctx.fillText('PRICE', colPrice, y);
    ctx.fillText('AMOUNT', colAmount, y);

    y += 12;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, y);
    ctx.lineTo(width - 32, y);
    ctx.stroke();

    // Rows
    rows.forEach((row, index) => {
        const rowY = y + 28 + index * rowHeight;

        if (index % 2 === 1) {
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(32, rowY - 20, width - 64, rowHeight);
        }

        ctx.textAlign = 'left';
        ctx.fillStyle = '#0f172a';
        ctx.font = `800 14px ${sans}`;
        ctx.fillText(row.symbol, colSymbol, rowY);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#475569';
        ctx.font = `600 14px ${sans}`;
        ctx.fillText(row.shares.toLocaleString(), colShares, rowY);
        ctx.fillText(row.avgPrice.toFixed(2), colPrice, rowY);

        ctx.fillStyle = '#0f172a';
        ctx.font = `800 14px ${sans}`;
        ctx.fillText(formatCurrency(row.amount).split('.')[0], colAmount, rowY);
    });

    // Total
    const totalY = y + 28 + rows.length * rowHeight + 22;
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(32, totalY - 26);
    ctx.lineTo(width - 32, totalY - 26);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = `700 11px ${sans}`;
    ctx.fillText('TOTAL INVESTED', colSymbol, totalY);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#2563eb';
    ctx.font = `800 20px ${sans}`;
    ctx.fillText(formatCurrency(total).split('.')[0], colAmount, totalY + 4);
};

const BoughtSummaryModal: React.FC<BoughtSummaryModalProps> = ({ isOpen, onClose, rows, month }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [copied, setCopied] = useState<'text' | 'image' | null>(null);

    const total = useMemo(() => rows.reduce((sum, r) => sum + r.amount, 0), [rows]);

    // Redraw whenever the modal opens with new data.
    React.useEffect(() => {
        if (isOpen && canvasRef.current && rows.length > 0) {
            drawSummary(canvasRef.current, month, rows, total);
        }
    }, [isOpen, month, rows, total]);

    if (!isOpen) return null;

    const asText = () => {
        const lines = rows.map(r =>
            `${r.symbol}  ${r.shares.toLocaleString()} @ ${r.avgPrice.toFixed(2)}  =  ${formatCurrency(r.amount).split('.')[0]}`
        );

        return [
            `Bought — ${formatMonth(month)}`,
            '',
            ...lines,
            '',
            `Total invested: ${formatCurrency(total).split('.')[0]}`,
        ].join('\n');
    };

    const flash = (kind: 'text' | 'image') => {
        setCopied(kind);
        setTimeout(() => setCopied(null), 1800);
    };

    const copyText = async () => {
        try {
            await navigator.clipboard.writeText(asText());
            flash('text');
            toast.success('Summary copied as text');
        } catch {
            toast.error('Could not copy — clipboard access was blocked');
        }
    };

    const canvasBlob = () =>
        new Promise<Blob | null>(resolve => canvasRef.current?.toBlob(resolve, 'image/png'));

    const copyImage = async () => {
        try {
            const blob = await canvasBlob();
            if (!blob) throw new Error('render failed');

            // Safari needs the ClipboardItem to exist before the await resolves, hence no
            // intermediate awaits between here and the write.
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            flash('image');
            toast.success('Summary copied as image');
        } catch {
            toast.error('Image copy is not supported here — use Download instead');
        }
    };

    const downloadImage = async () => {
        const blob = await canvasBlob();
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `finsip-${month}.png`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            >
                <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
                    <div className="min-w-0">
                        <h2 className="text-base font-bold text-slate-900 tracking-tight truncate">
                            Bought <span className="text-slate-300 font-normal">·</span>{' '}
                            <span className="text-slate-500 font-normal">{formatMonth(month)}</span>
                        </h2>
                        <p className="text-xs font-medium text-slate-400 mt-0.5">
                            Shareable summary — the image below is exactly what gets copied
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        title="Close"
                        className="shrink-0 -mr-2 -mt-1 p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {rows.length === 0 ? (
                    <div className="px-6 py-12 text-center border-t border-slate-100">
                        <p className="text-sm font-medium text-slate-400">
                            Nothing was bought in {formatMonth(month)}.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 max-h-[55vh] overflow-auto custom-scrollbar">
                            <canvas
                                ref={canvasRef}
                                className="w-full max-w-full h-auto rounded-xl border border-slate-200 shadow-sm bg-white"
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 px-6 py-4 bg-white border-t border-slate-100">
                            <button
                                onClick={copyImage}
                                className="flex-1 h-10 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                            >
                                {copied === 'image' ? <Check size={15} /> : <ImageIcon size={15} />}
                                {copied === 'image' ? 'Copied' : 'Copy image'}
                            </button>
                            <button
                                onClick={copyText}
                                className="flex-1 h-10 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                            >
                                {copied === 'text' ? <Check size={15} /> : <Copy size={15} />}
                                {copied === 'text' ? 'Copied' : 'Copy text'}
                            </button>
                            <button
                                onClick={downloadImage}
                                className="flex-1 h-10 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <Download size={15} />
                                Download
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default BoughtSummaryModal;
