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

    return { totalTagihan: fTagihan, totalDibayar: fDibayar, sisa: fSisa, kelebihan: fKelebihan, members };
}

/* ==========================================================================
   KOMPONEN UI & NAVIGASI
   ========================================================================== */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { if(toast.parentNode) toast.remove(); }, 3000);
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
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
            if (modal) modal.classList.remove('show');
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

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-link').forEach(nav => nav.classList.remove('active'));
        e.target.classList.add('active');

        const targetId = e.target.getAttribute('data-target');
        document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
        
        if(targetId === 'view-dashboard') {
            document.getElementById('page-title').innerHTML = '<span class="topbar-title-main">TOUR MANAGEMENT</span><span class="topbar-title-sub">DAVKA TOUR AND TRAVEL</span>';
        } else {
            document.getElementById('page-title').textContent = e.target.textContent;
        }
        
        closeSidebarMobile();
        refreshActiveView(targetId);
    });
});

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
    }
}

function refreshAll() {
    saveData();
    const activeNav = document.querySelector('.nav-link.active');
    if (activeNav) refreshActiveView(activeNav.getAttribute('data-target'));
    if (document.getElementById('view-participant-detail').classList.contains('active')) {
        renderDetailParticipant(currentDetailId);
    }
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
