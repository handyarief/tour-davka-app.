/* ==========================================================================
   KONEKSI SUPABASE
   ========================================================================== */
const supabaseUrl = 'https://wdhfthzuihakjlygttcw.supabase.co'; // Sudah diperbaiki sesuai dashboard
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkaGZ0aHp1aWhha2pseWd0dGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NzUxMTEsImV4cCI6MjA4NDI1MTExMX0.GFQfFILjDekr0ugH9-Ux3GhV9Zi3jmnzY5z4YtqV_Bw'; 
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

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
            // UPDATE: Menambahkan deteksi error untuk operasi di background
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

// Format Rupiah
function formatRp(angka) {
    if (isNaN(angka) || angka === null || angka === '') return 'Rp0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(angka));
}

// Format Tanggal
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ==========================================================================
   PERHITUNGAN INTI (CORE CALCULATOR)
   ========================================================================== */
function calcParticipantStats(participantId) {
    const pCosts = db.costs.filter(c => c.participantId === participantId);
    const totalTagihan = pCosts.reduce((sum, c) => sum + c.total, 0);

    let totalDibayar = 0;
    db.payments.forEach(pay => {
        if (pay.allocations) {
            const alloc = pay.allocations.find(a => a.participantId === participantId);
            if (alloc) totalDibayar += alloc.amount;
        }
    });

    const sisa = totalTagihan - totalDibayar;
    let kelebihan = 0;
    let sisaTagihanAktif = 0;
    let status = 'BELUM BAYAR';
    let badgeClass = 'badge-danger';

    if (sisa === 0 && totalTagihan > 0) {
        status = 'LUNAS';
        badgeClass = 'badge-success';
    } else if (sisa < 0) {
        status = 'KELEBIHAN BAYAR';
        badgeClass = 'badge-info';
        kelebihan = Math.abs(sisa);
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

    return { totalTagihan, totalDibayar, sisa: sisaTagihanAktif, kelebihan, status, badgeClass, rawSisa: sisa };
}

function calcFamilyStats(familyName) {
    const members = db.participants.filter(p => p.family === familyName);
    let fTagihan = 0, fDibayar = 0, fSisa = 0, fKelebihan = 0;
    
    members.forEach(m => {
        const stats = calcParticipantStats(m.id);
        fTagihan += stats.totalTagihan;
        fDibayar += stats.totalDibayar;
        fSisa += stats.sisa;
        fKelebihan += stats.kelebihan;
    });

    const rawNetSisa = fTagihan - fDibayar;
    let status = 'BELUM BAYAR';
    let badgeClass = 'badge-danger';

    if (fTagihan === 0 && fDibayar === 0) {
        status = 'BELUM ADA TAGIHAN';
        badgeClass = 'badge-secondary';
    } else if (fSisa === 0 && fKelebihan === 0 && fTagihan > 0) {
        status = 'LUNAS';
        badgeClass = 'badge-success';
    } else if (fSisa === 0 && fKelebihan > 0) {
        status = 'KELEBIHAN BAYAR';
        badgeClass = 'badge-info';
    } else if (fSisa > 0 && fDibayar > 0) {
        status = 'CICILAN';
        badgeClass = 'badge-warning';
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
        detailFamily: typeof currentDetailFamily !== 'undefined' ? currentDetailFamily : null
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
    'view-family-detail': 'Detail Keluarga'
};

function activateViewDOM(viewId, options = {}) {
    const { pushHistory = true, detailId = null, detailFamily = null } = options;

    if (typeof currentDetailId !== 'undefined') {
        currentDetailId = detailId;
    }
    if (typeof currentDetailFamily !== 'undefined') {
        currentDetailFamily = detailFamily;
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
            detailFamily: e.state.detailFamily || null
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
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
