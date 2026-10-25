/* ==========================================================================
   MODUL 8: LAPORAN KEUANGAN & PENGATURAN SISTEM
   ========================================================================== */
document.getElementById('btn-generate-report').addEventListener('click', () => {
    const type = document.getElementById('report-type').value;
    
    document.getElementById('report-print-area').style.display = 'block';
    document.getElementById('btn-print-report').style.display = 'inline-block';
    document.getElementById('btn-export-csv-report').style.display = 'inline-block';
    
    const container = document.getElementById('report-output-container');
    const title = document.getElementById('report-print-title');
    const period = document.getElementById('report-print-period');
    
    period.textContent = 'Periode: Keseluruhan Data';
    
    if (type === 'peserta') {
        title.textContent = 'LAPORAN TAGIHAN PESERTA';
        container.innerHTML = generateReportTablePeserta();
    } else if (type === 'keluarga') {
        title.textContent = 'LAPORAN TAGIHAN PER KELUARGA';
        container.innerHTML = generateReportTableKeluarga();
    } else if (type === 'penerimaan') {
        title.textContent = 'LAPORAN PENERIMAAN KAS';
        container.innerHTML = generateReportTablePenerimaan();
    } else if (type === 'pengeluaran') {
        title.textContent = 'LAPORAN PENGELUARAN OPERASIONAL';
        container.innerHTML = generateReportTablePengeluaran();
    } else if (type === 'buku_kas') {
        title.textContent = 'LAPORAN BUKU KAS (ARUS KAS)';
        container.innerHTML = generateReportTableBukuKas();
    } else {
        title.textContent = 'REKAPITULASI KESELURUHAN PERJALANAN';
        container.innerHTML = generateReportRekapitulasi();
    }
});

document.getElementById('btn-print-report').addEventListener('click', () => {
    window.print();
});

function generateReportTablePeserta() {
    let html = `<table class="table"><thead><tr>
        <th>ID</th><th>Nama</th><th>Keluarga</th><th>Total Tagihan</th><th>Telah Dibayar</th><th>Sisa</th><th>Kelebihan</th><th>Status</th>
        </tr></thead><tbody>`;
    db.participants.forEach(p => {
        const s = calcParticipantStats(p.id);
        html += `<tr>
            <td><small>${p.id}</small></td>
            <td>${escapeHTML(p.name)}</td>
            <td>${escapeHTML(p.family)}</td>
            <td>${formatRp(s.totalTagihan)}</td>
            <td>${formatRp(s.totalDibayar)}</td>
            <td class="text-danger">${formatRp(s.sisa)}</td>
            <td class="text-info">${formatRp(s.kelebihan)}</td>
            <td>${s.status}</td>
        </tr>`;
    });
    return html + `</tbody></table>`;
}

function generateReportTableKeluarga() {
    const families = [...new Set(db.participants.map(p => p.family))].sort();
    let html = '';
    let grandTagihan = 0, grandDibayar = 0, grandSisa = 0;
    
    families.forEach(f => {
        const stats = calcFamilyStats(f);
        grandTagihan += stats.totalTagihan;
        grandDibayar += stats.totalDibayar;
        grandSisa += stats.sisa;
        
        html += `
        <h4 style="margin-top: 20px; background: #f1f5f9; padding: 10px;">Keluarga: ${escapeHTML(f)}</h4>
        <table class="table table-sm">
            <thead><tr><th>Nama Anggota</th><th>Tagihan</th><th>Dibayar</th><th>Sisa</th><th>Status</th></tr></thead>
            <tbody>
        `;
        stats.members.forEach(m => {
            const ms = calcParticipantStats(m.id);
            html += `<tr>
                <td>${escapeHTML(m.name)}</td>
                <td>${formatRp(ms.totalTagihan)}</td>
                <td>${formatRp(ms.totalDibayar)}</td>
                <td>${formatRp(ms.sisa)}</td>
                <td>${ms.status}</td>
            </tr>`;
        });
        html += `<tr style="font-weight:bold; background:#fff">
            <td class="text-right">TOTAL KELUARGA</td>
            <td>${formatRp(stats.totalTagihan)}</td>
            <td class="text-success">${formatRp(stats.totalDibayar)}</td>
            <td class="text-danger">${formatRp(stats.sisa)}</td>
            <td></td>
        </tr></tbody></table>`;
    });
    
    html += `<div style="margin-top:20px; padding:15px; border:2px solid #000;">
        <h3>GRAND TOTAL SELURUH KELUARGA</h3>
        <p>Total Tagihan: <strong>${formatRp(grandTagihan)}</strong></p>
        <p>Total Dibayar: <strong class="text-success">${formatRp(grandDibayar)}</strong></p>
        <p>Total Sisa Tagihan: <strong class="text-danger">${formatRp(grandSisa)}</strong></p>
    </div>`;
    return html;
}

function generateReportTablePenerimaan() {
    let data = db.payments; 
    let total = 0;
    let html = `<table class="table"><thead><tr>
        <th>Tanggal</th><th>Pembayar</th><th>Penerimaan</th><th>Metode</th><th>Catatan</th>
        </tr></thead><tbody>`;
    data.sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(p => {
        total += p.amount;
        html += `<tr>
            <td>${formatDate(p.date)}</td>
            <td>${escapeHTML(p.name)}</td><td class="text-bold text-success">${formatRp(p.amount)}</td>
            <td>${escapeHTML(p.method)}</td><td>${escapeHTML(p.notes)}</td>
        </tr>`;
    });
    html += `<tr style="font-weight:bold"><td colspan="2" class="text-right">TOTAL PENERIMAAN:</td><td colspan="3">${formatRp(total)}</td></tr>`;
    return html + `</tbody></table>`;
}

function generateReportTablePengeluaran() {
    let data = db.expenses;
    let total = 0;
    let html = `<table class="table"><thead><tr>
        <th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th>Vendor</th><th>Pengeluaran</th><th>Metode</th>
        </tr></thead><tbody>`;
    data.sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(e => {
        total += e.amount;
        html += `<tr>
            <td>${formatDate(e.date)}</td><td>${escapeHTML(e.category)}</td>
            <td>${escapeHTML(e.desc)}</td><td>${escapeHTML(e.vendor)}</td>
            <td class="text-bold text-danger">${formatRp(e.amount)}</td><td>${escapeHTML(e.method)}</td>
        </tr>`;
    });
    html += `<tr style="font-weight:bold"><td colspan="4" class="text-right">TOTAL PENGELUARAN:</td><td colspan="2">${formatRp(total)}</td></tr>`;
    return html + `</tbody></table>`;
}

function generateReportTableBukuKas() {
    let transactions = [];
    db.payments.forEach(p => transactions.push({ date: p.date, type: 'IN', ref: p.name, desc: p.notes, amount: p.amount }));
    db.expenses.forEach(e => transactions.push({ date: e.date, type: 'OUT', ref: e.vendor, desc: e.desc, amount: e.amount }));
    
    transactions.sort((a,b) => new Date(a.date) - new Date(b.date));
    
    let saldoAwal = 0;
    let kasMasuk = 0;
    let kasKeluar = 0;
    let htmlRows = '';
    let saldoBerjalan = 0;
    
    transactions.forEach(t => {
        if(t.type === 'IN') {
            kasMasuk += t.amount;
            saldoBerjalan += t.amount;
        } else {
            kasKeluar += t.amount;
            saldoBerjalan -= t.amount;
        }
        
        htmlRows += `<tr>
            <td>${formatDate(t.date)}</td>
            <td>${t.type === 'IN' ? 'Penerimaan Peserta' : 'Pengeluaran Operasional'}</td>
            <td>${escapeHTML(t.ref)} - ${escapeHTML(t.desc)}</td>
            <td class="text-success">${t.type === 'IN' ? formatRp(t.amount) : ''}</td>
            <td class="text-danger">${t.type === 'OUT' ? formatRp(t.amount) : ''}</td>
            <td><strong>${formatRp(saldoBerjalan)}</strong></td>
        </tr>`;
    });

    let html = `
    <div style="display:flex; justify-content:space-between; margin-bottom: 20px; background:#f1f5f9; padding:15px; border-radius:8px;">
        <div><h4>Saldo Awal</h4><h2 class="text-primary">${formatRp(saldoAwal)}</h2></div>
        <div><h4>Total Masuk</h4><h2 class="text-success">+ ${formatRp(kasMasuk)}</h2></div>
        <div><h4>Total Keluar</h4><h2 class="text-danger">- ${formatRp(kasKeluar)}</h2></div>
        <div><h4>Saldo Akhir</h4><h2 class="text-primary">${formatRp(saldoAwal + kasMasuk - kasKeluar)}</h2></div>
    </div>
    <table class="table"><thead><tr>
        <th>Tanggal</th><th>Jenis Transaksi</th><th>Keterangan</th><th>Debet (Masuk)</th><th>Kredit (Keluar)</th><th>Saldo</th>
    </tr></thead><tbody>
        <tr><td colspan="5" class="text-right"><strong>SALDO AWAL:</strong></td><td><strong>${formatRp(saldoAwal)}</strong></td></tr>
        ${htmlRows}
    </tbody></table>`;
    return html;
}

function generateReportRekapitulasi() {
    let sumTagihan = 0, sumPenerimaan = 0, sumPengeluaran = 0, sumTeralokasi = 0, sumSisa = 0, sumKelebihan = 0;
    db.participants.forEach(p => {
        const s = calcParticipantStats(p.id);
        sumTagihan += s.totalTagihan;
        sumTeralokasi += s.totalDibayar;
        sumSisa += s.sisa;
        sumKelebihan += s.kelebihan;
    });
    db.payments.forEach(p => sumPenerimaan += p.amount);
    db.expenses.forEach(e => sumPengeluaran += e.amount);
    
    const danaMenganggur = sumPenerimaan - sumTeralokasi;
    const saldoKas = sumPenerimaan - sumPengeluaran;
    const surplusDefisit = sumTagihan - sumPengeluaran;
    
    return `
    <table style="width:100%; border-collapse:collapse; margin-bottom:30px;">
        <tr><td style="padding:10px; border-bottom:1px solid #ccc;">Total Peserta Terdaftar</td><td class="text-right text-bold">${db.participants.length}</td></tr>
        <tr><td style="padding:10px; border-bottom:1px solid #ccc;">Total Tagihan Peserta</td><td class="text-right text-bold">${formatRp(sumTagihan)}</td></tr>
        <tr><td style="padding:10px; border-bottom:1px solid #ccc;">Total Penerimaan Kas</td><td class="text-right text-bold text-success">${formatRp(sumPenerimaan)}</td></tr>
        <tr><td style="padding:10px; border-bottom:1px solid #ccc;">Dana Telah Dialokasikan</td><td class="text-right text-bold">${formatRp(sumTeralokasi)}</td></tr>
        <tr><td style="padding:10px; border-bottom:1px solid #ccc;">Dana Belum Dialokasikan</td><td class="text-right text-bold text-warning">${formatRp(danaMenganggur)}</td></tr>
        <tr><td style="padding:10px; border-bottom:1px solid #ccc;">Total Sisa Harus Ditagih</td><td class="text-right text-bold text-danger">${formatRp(sumSisa)}</td></tr>
        <tr><td style="padding:10px; border-bottom:1px solid #ccc;">Total Kelebihan Pembayaran</td><td class="text-right text-bold text-info">${formatRp(sumKelebihan)}</td></tr>
        <tr><td style="padding:10px; border-bottom:1px solid #ccc;">Total Pengeluaran Aktual</td><td class="text-right text-bold text-danger">${formatRp(sumPengeluaran)}</td></tr>
        <tr><td style="padding:10px; border-bottom:2px solid #000; background:#f1f5f9;"><strong>SALDO KAS BERJALAN</strong></td><td class="text-right text-bold text-primary" style="background:#f1f5f9;">${formatRp(saldoKas)}</td></tr>
        <tr><td style="padding:10px;">Perkiraan Surplus/Defisit (Tagihan - Pengeluaran)</td><td class="text-right text-bold ${surplusDefisit >= 0 ? 'text-success' : 'text-danger'}">${formatRp(surplusDefisit)}</td></tr>
    </table>
    `;
}

document.getElementById('btn-export-csv-report').addEventListener('click', () => {
    const type = document.getElementById('report-type').value;
    const table = document.querySelector('#report-output-container table');
    if (!table) {
        showToast('Tidak ada tabel untuk diekspor', 'warning');
        return;
    }
    
    let csv = [];
    const rows = table.querySelectorAll('tr');
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll('td, th');
        for (let j = 0; j < cols.length; j++) {
            let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, ' ').trim();
            row.push('"' + data + '"');
        }
        csv.push(row.join(','));
    }
    downloadCSV(csv.join('\n'), `Laporan_${type}_${new Date().getTime()}.csv`);
});

function downloadCSV(csvString, filename) {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// FACTORY RESET TERHUBUNG KE SUPABASE CLOUD
document.getElementById('btn-delete-all-data').addEventListener('click', () => {
    confirmAction(
        'HAPUS SEMUA DATA PERMANEN', 
        'PERINGATAN KRITIS: Apakah Anda yakin ingin menghapus SELURUH data di server Supabase?', 
        async () => {
            // UPDATE: Tambahkan penangkapan error secara paralel (menghindari aplikasi ter-reset jika koneksi putus)
            const [res1, res2, res3, res4] = await Promise.all([
                supabaseClient.from('participants').delete().neq('id', '0'),
                supabaseClient.from('costs').delete().neq('id', '0'),
                supabaseClient.from('payments').delete().neq('id', '0'),
                supabaseClient.from('expenses').delete().neq('id', '0')
            ]);
            
            if (res1.error || res2.error || res3.error || res4.error) {
                showToast('Gagal menghapus sebagian/seluruh data dari server. Silakan coba lagi.', 'danger');
                return;
            }

            db = {
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
            
            showToast('Seluruh data berhasil dihapus dari Cloud.', 'success');
            setTimeout(() => { location.reload(); }, 1500);
        }
    );
});

/* ==========================================================================
   APP LIFECYCLE (MULAI APLIKASI)
   ========================================================================== */
window.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    refreshActiveView('view-dashboard');
});

/* ==========================================================================
   PWA STANDALONE MODE (TANPA SERVICE WORKER)
   ========================================================================== */
(function injectVirtualManifest() {
    const currentPath = window.location.pathname;
    const basePath = currentPath.endsWith('.html') 
        ? currentPath.substring(0, currentPath.lastIndexOf('/') + 1) 
        : (currentPath.endsWith('/') ? currentPath : currentPath + '/');
    const baseUrl = window.location.origin + basePath;
    const iconUrl = baseUrl + "logo.png";

    const manifestJSON = {
        "id": baseUrl,
        "name": "Davka tour",
        "short_name": "Davka tour",
        "description": "Sistem Manajemen Davka Travel",
        "start_url": baseUrl,
        "scope": baseUrl,
        "display": "standalone",
        "orientation": "portrait",
        "background_color": "#ffffff",
        "theme_color": "#0369a1",
        "icons": [
            { "src": iconUrl, "sizes": "192x192", "type": "image/png", "purpose": "any" },
            { "src": iconUrl, "sizes": "512x512", "type": "image/png", "purpose": "any" },
            { "src": iconUrl, "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
        ]
    };

    const stringifiedManifest = JSON.stringify(manifestJSON);
    const blob = new Blob([stringifiedManifest], { type: 'application/manifest+json' });
    const manifestBlobUrl = URL.createObjectURL(blob);

    const linkTag = document.createElement('link');
    linkTag.rel = 'manifest';
    linkTag.href = manifestBlobUrl;
    document.head.appendChild(linkTag);
})();
