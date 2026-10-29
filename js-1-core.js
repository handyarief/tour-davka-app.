/* ==========================================================================
   KONEKSI SUPABASE
   ========================================================================== */
const supabaseUrl = 'https://wdhfthzuihakjlygttcw.supabase.co'; // Sudah diperbaiki sesuai dashboard
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkaGZ0aHp1aWhha2pseWd0dGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NzUxMTEsImV4cCI6MjA4NDI1MTExMX0.GFQfFILjDekr0ugH9-Ux3GhV9Zi3jmnzY5z4YtqV_Bw'; 
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

/* ==========================================================================
   PRELOAD LOGO WATERMARK (BASE64 AGAR AMAN SAAT RENDER JPG / PRINT)
   ========================================================================== */
window.davkaLogoDataUrl = 'logo.png';

(function preloadDavkaLogo() {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || 300;
            canvas.height = img.naturalHeight || 300;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            window.davkaLogoDataUrl = canvas.toDataURL('image/png');
        } catch (e) {
            window.davkaLogoDataUrl = 'logo.png';
        }
    };
    img.src = 'logo.png';
})();

function getWatermarkHTML(isLarge = false) {
    const logoSrc = window.davkaLogoDataUrl || 'logo.png';
    return `
        <div class="nota-watermark-layer" aria-hidden="true">
            <div class="nota-watermark-inner ${isLarge ? 'watermark-lg' : ''}">
                <img src="${logoSrc}" alt="Davka Tour Official Watermark" class="nota-watermark-logo">
                <div class="nota-watermark-stamp">DOKUMEN ASLI &bull; DAVKA TOUR</div>
            </div>
        </div>
    `;
}

/* ==========================================================================
   INISIALISASI & MANAJEMEN DATA (FULL ONLINE SUPABASE)
   ========================================================================== */
// Struktur Data Dasar di Memori
let db = {
    participants: [],
    costs: [],
    payments: [],
    expenses: [],
    categories: [
        'Tiket Kereta Berangkat', 'Tiket Kereta Pulang', 'Tiket Kereta PP', 'Sewa Bus/Transportasi', 
        'Penginapan/Hotel', 'Pembelian Kaos', 'Tiket Wisata', 'Konsumsi/Makan Minum', 
        'Parkir & Tol', 'Administrasi', 'Lain-lain', 'Diskon/Penyesuaian'
    ]
};

// Memuat data dari Supabase Cloud
async function loadData() {
    try {
        const [resPart, resCost, resPay, resExp, resCat] = await Promise.all([
            supabaseClient.from('participants').select('*'),
            supabaseClient.from('costs').select('*'),
            supabaseClient.from('payments').select('*'),
            supabaseClient.from('expenses').select('*'),
            supabaseClient.from('categories').select('*') // REVISI: Menghapus .catch() yang memicu TypeError
        ]);

        if (resPart.error) console.error('Error load participants:', resPart.error.message);
        if (resCost.error) console.error('Error load costs:', resCost.error.message);
        if (resPay.error) console.error('Error load payments:', resPay.error.message);
        if (resExp.error) console.error('Error load expenses:', resExp.error.message);

        if (resPart.data && resPart.data.length > 0) {
            db.participants = resPart.data.map(p => ({
                id: p.id,
                name: p.name || p.nama || '',
                family: p.family || p.keluarga || 'None',
                shirt: p.shirt || p.ukuran_kaos || '',
                status: p.status || 'Aktif',
                regDate: p.regDate || p.reg_date || p.created_at || new Date().toISOString()
            }));
        }

        if (resCost.data && resCost.data.length > 0) {
            db.costs = resCost.data.map(c => ({
                id: c.id,
                participantId: c.participantId || c.participant_id || '',
                category: c.category || c.kategori || '',
                price: Number(c.price || c.harga || 0),
                qty: Number(c.qty || 1),
                total: Number(c.total || c.harga || 0),
                notes: c.notes || c.catatan || ''
            }));
        }

        if (resPay.data && resPay.data.length > 0) {
            db.payments = resPay.data.map(p => {
                let parsedAlloc = p.allocations || p.alokasi || [];
                if (typeof parsedAlloc === 'string') {
                    try { parsedAlloc = JSON.parse(parsedAlloc); } catch(e) { parsedAlloc = []; }
                }
                return {
                    id: p.id,
                    date: p.date || p.tanggal || '',
                    name: p.name || p.pembayar || '',
                    amount: Number(p.amount || p.nominal || 0),
                    method: p.method || p.metode || 'Transfer',
                    ref: p.ref || p.referensi || '',
                    notes: p.notes || p.catatan || '',
                    allocations: parsedAlloc
                };
            });
        }

        if (resExp.data && resExp.data.length > 0) {
            db.expenses = resExp.data.map(e => ({
                id: e.id,
                date: e.date || e.tanggal || '',
                category: e.category || e.kategori || '',
                desc: e.desc || e.keterangan || '',
                vendor: e.vendor || e.penerima || '',
                amount: Number(e.amount || e.nominal || 0),
                method: e.method || e.metode || 'Transfer',
                ref: e.ref || '',
                notes: e.notes || ''
            }));
        }

        if (resCat.data && resCat.data.length > 0) {
            db.categories = resCat.data.map(cat => cat.name || cat.kategori);
        }

        console.log("Data berhasil dimuat 100% dari Supabase Cloud!");
    } catch (e) {
        showToast('Gagal memuat data dari internet.', 'danger');
        console.error('Load Data Exception:', e);
    }
}

// Menyimpan data secara otomatis ke Supabase Cloud (Full Online)
async function saveData() {
    try {
        // Sinkronisasi Kategori ke Supabase jika tabel 'categories' ada
        if (db.categories && db.categories.length > 0) {
            const catPayload = db.categories.map(c => ({ name: c }));
            const { error } = await supabaseClient.from('categories').upsert(catPayload, { onConflict: 'name' });
            if (error) console.error('Gagal sinkronisasi background kategori:', error.message);
        }
    } catch (e) {
        console.error('Gagal sinkronisasi background', e);
    }
}

// Membuat ID Unik
function generateId(prefix = 'ID') {
    return prefix + '-' + Date.now().toString() + '-' + Math.floor(Math.random() * 1000);
}

// Format Rupiah (Tampilan Teks / Tabel)
function formatRp(angka) {
    if (isNaN(angka) || angka === null || angka === '') return 'Rp0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(angka));
}

// Format Rupiah Khusus Kolom Input Form (Contoh: Rp. 200.000)
function formatRpInput(val, allowZero = false) {
    if (val === null || val === undefined || val === '') return allowZero ? 'Rp. 0' : '';
    const str = String(val).trim();
    const isNegative = str.startsWith('-');
    const digits = str.replace(/[^0-9]/g, '');
    if (!digits) {
        if (isNegative) return '-';
        return allowZero ? 'Rp. 0' : '';
    }
    const num = parseInt(digits, 10);
    if (isNaN(num)) return allowZero ? 'Rp. 0' : '';
    if (num === 0) return allowZero ? 'Rp. 0' : '';
    const formatted = num.toLocaleString('id-ID');
    return (isNegative ? '-Rp. ' : 'Rp. ') + formatted;
}

// Mengambil Nilai Angka Murni dari Kolom Input Berformat Rp. 200.000
function parseRpInput(val) {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const str = String(val).trim();
    const isNegative = str.startsWith('-');
    const digits = str.replace(/[^0-9]/g, '');
    if (!digits) return 0;
    const num = parseInt(digits, 10) || 0;
    return isNegative ? -num : num;
}

// Event Listener Global Auto-Format Input Kolom Harga (Rp. 200.000)
document.addEventListener('input', function(e) {
    if (e.target && e.target.classList && e.target.classList.contains('rp-input')) {
        const el = e.target;
        if (el.readOnly) return;
        const isTableAlloc = el.classList.contains('alloc-input') || el.classList.contains('shared-input');
        const rawVal = el.value;
        const digits = rawVal.replace(/[^0-9]/g, '');
        if (!digits) {
            if (rawVal.trim() === '-') {
                el.value = '-';
            } else {
                el.value = '';
            }
            return;
        }
        const num = parseInt(digits, 10);
        if (num === 0) {
            el.value = isTableAlloc ? 'Rp. 0' : '';
        } else {
            el.value = formatRpInput(rawVal, isTableAlloc);
        }
    }
}, true);

document.addEventListener('blur', function(e) {
    if (e.target && e.target.classList && e.target.classList.contains('rp-input')) {
        const el = e.target;
        const isTableAlloc = el.classList.contains('alloc-input') || el.classList.contains('shared-input');
        if (isTableAlloc && !el.value.trim()) {
            el.value = 'Rp. 0';
        } else if (el.value.trim() === '-') {
            el.value = '';
        }
    }
}, true);

document.addEventListener('focus', function(e) {
    if (e.target && e.target.classList && e.target.classList.contains('rp-input')) {
        const el = e.target;
        if (el.readOnly) return;
        if (el.value === 'Rp. 0') {
            el.value = '';
        }
    }
}, true);

// Format Tanggal
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ==========================================================================
   PERHITUNGAN INTI (CORE CALCULATOR — SINKRON INDIVIDU & KELUARGA)
   ========================================================================== */
function getRawParticipantTotals(participantId) {
    const pCosts = db.costs.filter(c => c.participantId === participantId);
    const totalTagihan = pCosts.reduce((sum, c) => sum + c.total, 0);

    let totalDibayar = 0;
    let hasExplicitManual = false;
    let hasAllocation = false;

    db.payments.forEach(pay => {
        if (pay.allocations && Array.isArray(pay.allocations)) {
            const alloc = pay.allocations.find(a => a.participantId === participantId);
            if (alloc && alloc.amount > 0) {
                hasAllocation = true;
                totalDibayar += Number(alloc.amount || 0);

                if (alloc.allocMethod === 'manual') {
                    hasExplicitManual = true;
                } else if (!alloc.allocMethod) {
                    // Deteksi untuk data lama yang belum memiliki properti allocMethod:
                    // Jika nominal alokasi antar peserta dalam transaksi yang sama berbeda > Rp 5, berarti diinput Manual per Peserta.
                    // Jika semua peserta dalam 1 transaksi mendapat nominal sama rata (selisih <= Rp 5), berarti Bagi Rata.
                    if (pay.allocations.length === 1) {
                        const pObj = db.participants.find(x => x.id === participantId);
                        const famCount = pObj ? db.participants.filter(x => x.family === pObj.family && x.status === 'Aktif').length : 1;
                        if (famCount === 1) hasExplicitManual = true;
                    } else if (pay.allocations.length > 1) {
                        const amounts = pay.allocations.map(a => Number(a.amount || 0));
                        const maxAmt = Math.max(...amounts);
                        const minAmt = Math.min(...amounts);
                        if ((maxAmt - minAmt) > 5) {
                            hasExplicitManual = true;
                        }
                    }
                }
            }
        }
    });

    return { totalTagihan, rawTotalDibayar: totalDibayar, hasExplicitManual, hasAllocation };
}

function calcParticipantStats(participantId) {
    const p = db.participants.find(x => x.id === participantId);
    const raw = getRawParticipantTotals(participantId);
    const totalTagihan = raw.totalTagihan;
    let totalDibayar = raw.rawTotalDibayar;
    let isSyncedWithFamily = false;

    // Sinkronisasi otomatis dengan Keluarga jika bukan input Manual per Peserta yang disengaja berbeda
    // atau jika secara kolektif 1 keluarga sudah LUNAS / KELEBIHAN BAYAR
    if (p && p.family && p.family.toLowerCase() !== 'none') {
        const famMembers = db.participants.filter(m => m.family === p.family && m.status === 'Aktif');
        if (famMembers.length > 1) {
            let fTagihan = 0;
            let fDibayar = 0;
            famMembers.forEach(m => {
                const mRaw = getRawParticipantTotals(m.id);
                fTagihan += mRaw.totalTagihan;
                fDibayar += mRaw.rawTotalDibayar;
            });

            const famNetSisa = fTagihan - fDibayar;

            if (!raw.hasExplicitManual) {
                isSyncedWithFamily = true;
                if (fTagihan > 0 && famNetSisa <= 0) {
                    // Keluarga sudah lunas atau kelebihan bayar -> tagihan individu otomatis tertutup penuh
                    totalDibayar = totalTagihan;
                } else if (fTagihan > 0 && fDibayar > 0 && famNetSisa > 0) {
                    // Keluarga masih cicilan kolektif (via bagi rata) -> sesuaikan maksimal sebesar tagihan individu
                    totalDibayar = Math.min(totalTagihan, raw.rawTotalDibayar);
                }
            } else if (fTagihan > 0 && famNetSisa <= 0 && raw.rawTotalDibayar < totalTagihan) {
                // Meskipun pernah tercatat manual tetapi 1 keluarga sudah LUNAS / LEBIH BAYAR penuh,
                // jangan tampilkan sisa tagihan pada anggota karena sudah tertutup kelebihan bayar keluarga
                isSyncedWithFamily = true;
                totalDibayar = totalTagihan;
            }
        }
    }

    const sisa = totalTagihan - totalDibayar;
    const rawSisa = totalTagihan - raw.rawTotalDibayar;
    let kelebihan = 0;
    let sisaTagihanAktif = 0;
    let status = 'BELUM BAYAR';
    let badgeClass = 'badge-danger';

    if (sisa === 0 && totalTagihan > 0) {
        status = 'LUNAS';
        badgeClass = 'badge-success';
    } else if (sisa < 0) {
        if (raw.hasExplicitManual) {
            status = 'KELEBIHAN BAYAR';
            badgeClass = 'badge-info';
            kelebihan = Math.abs(sisa);
        } else {
            // Jika alokasi Bagi Rata, kelebihan masuk ke level Keluarga, di level Individu berstatus LUNAS
            status = 'LUNAS';
            badgeClass = 'badge-success';
            totalDibayar = totalTagihan;
        }
    } else if (sisa > 0 && totalDibayar > 0) {
        status = 'CICILAN';
        badgeClass = 'badge-warning';
        sisaTagihanAktif = sisa;
    } else if (sisa > 0) {
        sisaTagihanAktif = sisa;
    } else if (totalTagihan === 0 && totalDibayar === 0) {
        status = 'BELUM ADA TAGIHAN';
        badgeClass = 'badge-secondary';
    }

    return {
        totalTagihan,
        totalDibayar,
        rawTotalDibayar: raw.rawTotalDibayar,
        sisa: sisaTagihanAktif,
        kelebihan,
        status,
        badgeClass,
        rawSisa,
        isManualPayment: raw.hasExplicitManual,
        isSyncedWithFamily
    };
}

function calcFamilyStats(familyName) {
    const members = db.participants.filter(p => p.family === familyName);
    let fTagihan = 0, fDibayar = 0;
    
    members.forEach(m => {
        const raw = getRawParticipantTotals(m.id);
        fTagihan += raw.totalTagihan;
        fDibayar += raw.rawTotalDibayar;
    });

    // Perhitungan kolektif 1 keluarga: kelebihan bayar anggota otomatis menutupi kekurangan anggota lain
    const rawNetSisa = fTagihan - fDibayar;
    let fSisa = 0;
    let fKelebihan = 0;
    let status = 'BELUM BAYAR';
    let badgeClass = 'badge-danger';

    if (fTagihan === 0 && fDibayar === 0) {
        status = 'BELUM ADA TAGIHAN';
        badgeClass = 'badge-secondary';
    } else if (rawNetSisa === 0 && fTagihan > 0) {
        status = 'LUNAS';
        badgeClass = 'badge-success';
    } else if (rawNetSisa < 0) {
        status = 'KELEBIHAN BAYAR';
        badgeClass = 'badge-info';
        fKelebihan = Math.abs(rawNetSisa);
    } else if (rawNetSisa > 0 && fDibayar > 0) {
        status = 'CICILAN';
        badgeClass = 'badge-warning';
        fSisa = rawNetSisa;
    } else if (rawNetSisa > 0) {
        fSisa = rawNetSisa;
    }

    return { totalTagihan: fTagihan, totalDibayar: fDibayar, sisa: fSisa, kelebihan: fKelebihan, rawNetSisa, status, badgeClass, members };
}

/* ==========================================================================
   KOMPONEN UI, MODAL & SISTEM NAVIGASI HISTORY (GLOBAL BACK BUTTON)
   ========================================================================== */
let isHandlingPopState = false;

function getCurrentNavState() {
    const activeSection = document.querySelector('.view-section.active');
    const viewId = activeSection ? activeSection.id : 'view-dashboard';
    return {
        viewId: viewId,
        detailId: typeof currentDetailId !== 'undefined' ? currentDetailId : null,
        detailFamily: typeof currentDetailFamily !== 'undefined' ? currentDetailFamily : null,
        detailCategory: typeof currentDetailCategory !== 'undefined' ? currentDetailCategory : null
    };
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { if(toast.parentNode) toast.remove(); }, 3000);
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const wasAlreadyOpen = modal.classList.contains('show');
    modal.classList.add('show');

    if (!wasAlreadyOpen && !isHandlingPopState) {
        const navState = getCurrentNavState();
        navState.modalId = modalId;
        history.pushState(navState, '', window.location.pathname);
    }
}

function closeModal(modalId, fromPopState = false) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const wasOpen = modal.classList.contains('show');
    modal.classList.remove('show');

    if (wasOpen && !fromPopState && !isHandlingPopState && history.state && history.state.modalId === modalId) {
        history.back();
    }
}

let confirmCallback = null;
function confirmAction(title, message, callback) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    confirmCallback = callback;
    openModal('modal-confirm');
}

document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
    closeModal('modal-confirm');
    confirmCallback = null;
});

document.getElementById('btn-confirm-ok').addEventListener('click', () => {
    closeModal('modal-confirm');
    if (confirmCallback) confirmCallback();
});

document.querySelectorAll('.btn-close, .btn-secondary').forEach(btn => {
    if(btn.id !== 'btn-confirm-cancel' && btn.id !== 'btn-close-ringkasan-footer') {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    }
});
document.getElementById('btn-close-ringkasan-footer').addEventListener('click', () => closeModal('modal-ringkasan'));

const sidebar = document.getElementById('sidebar');
const mobileMenuBtn = document.getElementById('btn-mobile-menu');
const sidebarOverlay = document.getElementById('sidebar-overlay');

function closeSidebarMobile() {
    if(window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    }
}

const viewTitles = {
    'view-dashboard': '<span class="topbar-title-main">TOUR MANAGEMENT</span><span class="topbar-title-sub">DAVKA TOUR AND TRAVEL</span>',
    'view-participants': 'Peserta & Keluarga',
    'view-costs': 'Rincian Biaya Peserta',
    'view-payments': 'Pembayaran & Cicilan',
    'view-expenses': 'Pengeluaran Operasional',
    'view-reports': 'Laporan Keuangan',
    'view-participant-detail': 'Detail Peserta',
    'view-family-detail': 'Detail Keluarga',
    'view-category-detail': 'Detail Kategori Biaya'
};

function activateViewDOM(viewId, options = {}) {
    const { pushHistory = true, detailId = null, detailFamily = null, detailCategory = null } = options;

    if (typeof currentDetailId !== 'undefined') {
        currentDetailId = detailId;
    }
    if (typeof currentDetailFamily !== 'undefined') {
        currentDetailFamily = detailFamily;
    }
    if (typeof currentDetailCategory !== 'undefined') {
        currentDetailCategory = detailCategory;
    }

    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
    const targetSection = document.getElementById(viewId);
    if (targetSection) targetSection.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(nav => {
        if (nav.getAttribute('data-target') === viewId) {
            nav.classList.add('active');
        } else {
            nav.classList.remove('active');
        }
    });

    const pageTitleEl = document.getElementById('page-title');
    if (viewId === 'view-dashboard') {
        pageTitleEl.innerHTML = viewTitles['view-dashboard'];
    } else {
        pageTitleEl.textContent = viewTitles[viewId] || 'Davka Tour';
    }

    closeSidebarMobile();
    refreshActiveView(viewId);

    if (pushHistory && !isHandlingPopState) {
        history.pushState({
            viewId: viewId,
            detailId: detailId,
            detailFamily: detailFamily,
            detailCategory: detailCategory,
            modalId: null
        }, '', window.location.pathname);
    }
}

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = e.currentTarget.getAttribute('data-target');
        const currentActive = document.querySelector('.view-section.active');
        const isSameView = currentActive && currentActive.id === targetId;

        activateViewDOM(targetId, { pushHistory: !isSameView });
    });
});

// Event listener Global untuk tombol Back fisik HP / Browser
window.addEventListener('popstate', (e) => {
    isHandlingPopState = true;

    // 1. Jika ada sidebar mobile yang terbuka, tutup terlebih dahulu
    if (sidebar && sidebar.classList.contains('open')) {
        closeSidebarMobile();
    }

    // 2. Jika ada modal yang sedang terbuka, tutup modal yang tidak sesuai state
    const openModals = document.querySelectorAll('.modal.show');
    if (openModals.length > 0) {
        const targetModalId = e.state ? e.state.modalId : null;
        openModals.forEach(m => {
            if (m.id !== targetModalId) {
                m.classList.remove('show');
            }
        });
    }

    // 3. Pulihkan tampilan halaman (view) sesuai riwayat sebelumnya
    if (e.state && e.state.viewId) {
        activateViewDOM(e.state.viewId, {
            pushHistory: false,
            detailId: e.state.detailId || null,
            detailFamily: e.state.detailFamily || null,
            detailCategory: e.state.detailCategory || null
        });
        if (e.state.modalId) {
            const modalToRestore = document.getElementById(e.state.modalId);
            if (modalToRestore) modalToRestore.classList.add('show');
        }
    } else {
        activateViewDOM('view-dashboard', { pushHistory: false });
    }

    isHandlingPopState = false;
});

// Inisialisasi state awal saat halaman pertama kali dibuka
if (!history.state || !history.state.viewId) {
    history.replaceState({
        viewId: 'view-dashboard',
        detailId: null,
        detailFamily: null,
        detailCategory: null,
        modalId: null
    }, '', window.location.pathname);
}

mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
});

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebarMobile);
}

function refreshActiveView(viewId) {
    switch(viewId) {
        case 'view-dashboard': renderDashboard(); break;
        case 'view-participants': renderParticipants(); break;
        case 'view-costs': renderCostsMaster(); break;
        case 'view-payments': renderPayments(); break;
        case 'view-expenses': renderExpenses(); break;
        case 'view-participant-detail': renderDetailParticipant(currentDetailId); break;
        case 'view-family-detail': renderDetailFamily(currentDetailFamily); break;
        case 'view-category-detail': renderDetailCategory(currentDetailCategory); break;
    }
}

function refreshAll() {
    saveData();
    const activeNav = document.querySelector('.nav-link.active');
    if (activeNav) refreshActiveView(activeNav.getAttribute('data-target'));
    if (document.getElementById('view-participant-detail').classList.contains('active')) {
        renderDetailParticipant(currentDetailId);
    }
    if (document.getElementById('view-family-detail') && document.getElementById('view-family-detail').classList.contains('active')) {
        renderDetailFamily(currentDetailFamily);
    }
    if (document.getElementById('view-category-detail') && document.getElementById('view-category-detail').classList.contains('active')) {
        renderDetailCategory(currentDetailCategory);
    }
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
