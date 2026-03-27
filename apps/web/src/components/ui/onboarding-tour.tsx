'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, ChevronLeft, Sparkles, PartyPopper } from 'lucide-react';

/* ─── Tour step definition ──────────────────────────── */

interface TourStep {
    /** CSS selector for the element to highlight */
    target: string;
    /** Title for the tooltip */
    title: string;
    /** Description for the tooltip */
    description: string;
    /** Position of the tooltip relative to the target */
    position: 'right' | 'bottom' | 'left' | 'top';
}

const TOUR_STEPS: TourStep[] = [
    {
        target: 'a[href="/dashboard"]',
        title: 'Dashboard',
        description: 'Halaman utama untuk melihat ringkasan monitoring jaringan, status perangkat, dan statistik penting.',
        position: 'right',
    },
    {
        target: 'a[href="/devices"]',
        title: 'Devices',
        description: 'Kelola semua perangkat jaringan Anda di sini. Tambahkan router, switch, dan perangkat lainnya untuk dimonitor.',
        position: 'right',
    },
    {
        target: 'a[href="/uptime"]',
        title: 'Uptime / SLA',
        description: 'Pantau ketersediaan dan SLA setiap perangkat. Lihat laporan uptime harian, mingguan, dan bulanan.',
        position: 'right',
    },
    {
        target: 'a[href="/web-monitor"]',
        title: 'Web Monitor',
        description: 'Monitor website dan API. Cek ketersediaan URL, response time, dan status code secara berkala.',
        position: 'right',
    },
    {
        target: 'a[href="/alerts"]',
        title: 'Alerts',
        description: 'Atur notifikasi dan peringatan otomatis ketika ada masalah pada perangkat atau layanan Anda.',
        position: 'right',
    },
    {
        target: 'a[href="/tickets"]',
        title: 'Tickets',
        description: 'Sistem tiket untuk mencatat dan melacak masalah jaringan. Buat tiket dari alert atau secara manual.',
        position: 'right',
    },
    {
        target: 'a[href="/billing"]',
        title: 'Billing',
        description: 'Kelola subscription, upgrade paket, dan lihat riwayat pembayaran Anda.',
        position: 'right',
    },
];

const TOUR_SEEN_KEY = 'netmon_onboarding_complete';

/* ─── OnboardingTour component ──────────────────────── */

export function OnboardingTour() {
    const [active, setActive] = useState(false);
    const [step, setStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [mounted, setMounted] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Only run on client
    useEffect(() => setMounted(true), []);

    // Check if tour was already completed
    useEffect(() => {
        if (!mounted) return;
        const seen = localStorage.getItem(TOUR_SEEN_KEY);
        if (!seen) {
            // Small delay so the sidebar is rendered
            const timer = setTimeout(() => setActive(true), 800);
            return () => clearTimeout(timer);
        }
    }, [mounted]);

    // Update target rect when step changes
    useEffect(() => {
        if (!active) return;
        const currentStep = TOUR_STEPS[step];
        if (!currentStep) return;

        const el = document.querySelector(currentStep.target);
        if (el) {
            setTargetRect(el.getBoundingClientRect());
        } else {
            setTargetRect(null);
        }
    }, [active, step]);

    // Recalculate on scroll/resize
    useEffect(() => {
        if (!active) return;
        const update = () => {
            const currentStep = TOUR_STEPS[step];
            if (!currentStep) return;
            const el = document.querySelector(currentStep.target);
            if (el) setTargetRect(el.getBoundingClientRect());
        };
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [active, step]);

    const handleNext = useCallback(() => {
        if (step < TOUR_STEPS.length - 1) {
            setStep(s => s + 1);
        } else {
            // Tour complete
            localStorage.setItem(TOUR_SEEN_KEY, 'true');
            setActive(false);
        }
    }, [step]);

    const handlePrev = useCallback(() => {
        if (step > 0) setStep(s => s - 1);
    }, [step]);

    const handleSkip = useCallback(() => {
        localStorage.setItem(TOUR_SEEN_KEY, 'true');
        setActive(false);
    }, []);

    if (!mounted || !active) return null;

    const currentStep = TOUR_STEPS[step];
    const isLastStep = step === TOUR_STEPS.length - 1;

    // Calculate tooltip position
    let tooltipStyle: React.CSSProperties = {};
    if (targetRect) {
        const gap = 14;
        switch (currentStep.position) {
            case 'right':
                tooltipStyle = {
                    top: targetRect.top + targetRect.height / 2,
                    left: targetRect.right + gap,
                    transform: 'translateY(-50%)',
                };
                break;
            case 'bottom':
                tooltipStyle = {
                    top: targetRect.bottom + gap,
                    left: targetRect.left + targetRect.width / 2,
                    transform: 'translateX(-50%)',
                };
                break;
            case 'left':
                tooltipStyle = {
                    top: targetRect.top + targetRect.height / 2,
                    right: window.innerWidth - targetRect.left + gap,
                    transform: 'translateY(-50%)',
                };
                break;
            case 'top':
                tooltipStyle = {
                    bottom: window.innerHeight - targetRect.top + gap,
                    left: targetRect.left + targetRect.width / 2,
                    transform: 'translateX(-50%)',
                };
                break;
        }
    }

    // Spotlight hole dimensions
    const spotlightPadding = 6;
    const spotlightRadius = 10;

    return createPortal(
        <div ref={overlayRef} className="fixed inset-0 z-[9999]">
            {/* Dark overlay with spotlight hole */}
            <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                <defs>
                    <mask id="tour-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {targetRect && (
                            <rect
                                x={targetRect.left - spotlightPadding}
                                y={targetRect.top - spotlightPadding}
                                width={targetRect.width + spotlightPadding * 2}
                                height={targetRect.height + spotlightPadding * 2}
                                rx={spotlightRadius}
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>
                <rect
                    x="0" y="0" width="100%" height="100%"
                    fill="rgba(0,0,0,0.55)"
                    mask="url(#tour-mask)"
                />
            </svg>

            {/* Spotlight ring glow */}
            {targetRect && (
                <div
                    className="absolute rounded-[10px] ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent"
                    style={{
                        top: targetRect.top - spotlightPadding,
                        left: targetRect.left - spotlightPadding,
                        width: targetRect.width + spotlightPadding * 2,
                        height: targetRect.height + spotlightPadding * 2,
                        pointerEvents: 'none',
                        boxShadow: '0 0 0 4px rgba(59,130,246,0.15), 0 0 20px rgba(59,130,246,0.2)',
                    }}
                />
            )}

            {/* Click blocker */}
            <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

            {/* Tooltip */}
            {targetRect && (
                <div
                    className="absolute z-10 w-80 animate-in fade-in slide-in-from-left-2 duration-200"
                    style={tooltipStyle}
                >
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-blue-200" />
                                <span className="text-white text-sm font-bold">{currentStep.title}</span>
                            </div>
                            <span className="text-blue-200 text-xs font-medium">
                                {step + 1} / {TOUR_STEPS.length}
                            </span>
                        </div>

                        {/* Body */}
                        <div className="px-5 py-4">
                            <p className="text-sm text-gray-600 leading-relaxed">
                                {currentStep.description}
                            </p>
                        </div>

                        {/* Progress bar */}
                        <div className="px-5 pb-2">
                            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                                    style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between">
                            <button
                                onClick={handleSkip}
                                className="text-xs text-gray-400 hover:text-gray-600 transition-colors font-medium"
                            >
                                Skip Tutorial
                            </button>
                            <div className="flex items-center gap-2">
                                {step > 0 && (
                                    <button
                                        onClick={handlePrev}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                        <ChevronLeft className="h-3 w-3" />
                                        Kembali
                                    </button>
                                )}
                                <button
                                    onClick={handleNext}
                                    className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                                >
                                    {isLastStep ? (
                                        <>
                                            <PartyPopper className="h-3 w-3" />
                                            Selesai!
                                        </>
                                    ) : (
                                        <>
                                            Lanjutkan
                                            <ChevronRight className="h-3 w-3" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Arrow pointer */}
                    {currentStep.position === 'right' && (
                        <div
                            className="absolute top-1/2 -left-2 -translate-y-1/2 w-0 h-0"
                            style={{
                                borderTop: '8px solid transparent',
                                borderBottom: '8px solid transparent',
                                borderRight: '8px solid white',
                                filter: 'drop-shadow(-2px 0 2px rgba(0,0,0,0.08))',
                            }}
                        />
                    )}
                </div>
            )}
        </div>,
        document.body,
    );
}
