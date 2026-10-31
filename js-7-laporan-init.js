/* ==========================================================================
   MODUL 8: LAPORAN KEUANGAN, PRATINJAU DOKUMEN (GAMBAR 3) & UNDUH JPG UTUH
   ========================================================================== */
function ensureReportWatermark() {
    const reportArea = document.getElementById('report-print-area');
    if (!reportArea) return;
    const oldWatermark = reportArea.querySelector('.nota-watermark-layer');
    if (oldWatermark) oldWatermark.remove();
    reportArea.insertAdjacentHTML('afterbegin', getWatermarkHTML(true));
}

document.getElementById('btn-generate-report').addEventListener('click', () => {
    const type = document.getElementById('report-type').value;
    
    document.getElementById('report-print-area').style.display = 'block';
    document.getElementById('btn-print-report').style.display = 'inline-flex';
    document.getElementById('btn-print-bluetooth').style.display = 'inline-flex';
    document.getElementById('btn-download-jpg-report').style.display = 'inline-flex';
    
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

    ensureReportWatermark();
});

// 1. FUNGSI CETAK PRINTER WI-FI / LAN / SISTEM BAWAAN (TETAP DIPERTAHANKAN 100% TANPA DIUBAH)
document.getElementById('btn-print-report').addEventListener('click', () => {
    ensureReportWatermark();
    window.print();
});

/* ==========================================================================
   SISTEM PRATINJAU (PREVIEW) SEBELUM DOWNLOAD JPG / CETAK BLUETOOTH (GAMBAR 3)
   ========================================================================== */
let currentPreviewActionMode = 'jpg'; // 'jpg' | 'bluetooth'
let currentPreviewSourceType = 'report'; // 'report' | 'ringkasan'

function fitPreviewPaperToScreen() {
    const viewport = document.getElementById('doc-preview-viewport');
    const scaler = document.getElementById('doc-preview-scaler');
    const paper = document.getElementById('doc-preview-paper');
    if (!viewport || !scaler || !paper) return;

    paper.style.transform = 'none';
    scaler.style.height = 'auto';

    // Buka lebar elemen di dalam preview agar tabel matriks terbaca penuh secara akurat
    paper.style.width = 'max-content';
    paper.style.minWidth = '720px';
    paper.style.maxWidth = 'none';

    let maxTableWidth = 720;
    paper.querySelectorAll('table').forEach(tbl => {
        if (tbl.scrollWidth > maxTableWidth) {
            maxTableWidth = tbl.scrollWidth;
        }
    });

    const fullPaperWidth = Math.max(maxTableWidth + 64, paper.scrollWidth);
    paper.style.width = `${fullPaperWidth}px`;
    paper.style.minWidth = `${fullPaperWidth}px`;

    const availableWidth = Math.max(viewport.clientWidth - 20, 260);
    if (fullPaperWidth > availableWidth) {
        const scaleRatio = availableWidth / fullPaperWidth;
        paper.style.transform = `scale(${scaleRatio})`;
        paper.style.transformOrigin = 'top center';
        const scaledHeight = Math.ceil(paper.offsetHeight * scaleRatio);
        scaler.style.height = `${scaledHeight + 20}px`;
    }
}

window.addEventListener('resize', () => {
    const modal = document.getElementById('modal-doc-preview');
    if (modal && modal.classList.contains('show')) {
        fitPreviewPaperToScreen();
    }
});

window.openDocumentPreviewModal = function(mode, source) {
    currentPreviewActionMode = mode;
    currentPreviewSourceType = source;

    const paper = document.getElementById('doc-preview-paper');
    const badge = document.getElementById('doc-preview-badge');
    const headerTitle = document.getElementById('doc-preview-header-title');
    const sizeLabel = document.getElementById('doc-preview-size-label');
    const fabIcon = document.getElementById('doc-preview-fab-icon');
    const fabLabel = document.getElementById('doc-preview-fab-label');
    const confirmBtn = document.getElementById('btn-doc-preview-confirm');

    if (!paper) return;

    // Suntikkan isi dokumen yang akan dipratinjau
    if (source === 'report') {
        ensureReportWatermark();
        const reportArea = document.getElementById('report-print-area');
        paper.innerHTML = reportArea ? reportArea.innerHTML : '';
    } else {
        const ringkasanArea = document.getElementById('ringkasan-print-area');
        paper.innerHTML = ringkasanArea ? ringkasanArea.innerHTML : '';
    }

    // Atur label & tombol sesuai aksi yang dipilih (Simpan sebagai JPG atau Cetak Bluetooth)
    if (mode === 'jpg') {
        if (badge) {
            badge.textContent = 'JPG';
            badge.className = 'doc-preview-badge';
        }
        if (headerTitle) headerTitle.textContent = 'Simpan sebagai JPG';
        if (sizeLabel) sizeLabel.textContent = 'ISO A4 ( Penuh )';
        if (fabIcon) fabIcon.innerHTML = '&#11015;';
        if (fabLabel) fabLabel.textContent = 'JPG';
        if (confirmBtn) confirmBtn.innerHTML = '&#11015; Download JPG';
    } else if (mode === 'bluetooth') {
        if (badge) {
            badge.textContent = 'BT';
            badge.className = 'doc-preview-badge badge-bt';
        }
        if (headerTitle) headerTitle.textContent = 'Pratinjau Cetak Bluetooth';
        if (sizeLabel) sizeLabel.textContent = 'Thermal / Struk';
        if (fabIcon) fabIcon.innerHTML = '&#128424;';
        if (fabLabel) fabLabel.textContent = 'CETAK';
        if (confirmBtn) confirmBtn.innerHTML = '&#128424; Cetak Bluetooth';
    }

    openModal('modal-doc-preview');
    setTimeout(fitPreviewPaperToScreen, 60);
};

async function triggerPreviewExecution(triggerBtn) {
    if (currentPreviewActionMode === 'jpg') {
        if (currentPreviewSourceType === 'report') {
            await executeDownloadReportJpg(triggerBtn);
        } else if (typeof window.executeDownloadRingkasanJpg === 'function') {
            await window.executeDownloadRingkasanJpg(triggerBtn);
        }
    } else if (currentPreviewActionMode === 'bluetooth') {
        if (currentPreviewSourceType === 'report') {
            await executeBluetoothReport(triggerBtn);
        } else if (typeof window.executeBluetoothRingkasan === 'function') {
            await window.executeBluetoothRingkasan(triggerBtn);
        }
    }
}

const btnPreviewFab = document.getElementById('btn-doc-preview-action');
if (btnPreviewFab) {
    btnPreviewFab.addEventListener('click', () => triggerPreviewExecution(btnPreviewFab));
}

const btnPreviewConfirm = document.getElementById('btn-doc-preview-confirm');
if (btnPreviewConfirm) {
    btnPreviewConfirm.addEventListener('click', () => triggerPreviewExecution(btnPreviewConfirm));
}

const btnPreviewClose = document.getElementById('btn-doc-preview-close');
if (btnPreviewClose) {
    btnPreviewClose.addEventListener('click', () => closeModal('modal-doc-preview'));
}

// 2. FUNGSI SIMPAN SEBAGAI JPG (BUKA PREVIEW DULU -> KLIK DOWNLOAD, HASIL 100% UTUH TANPA TERPOTONG)
async function executeDownloadReportJpg(triggerBtn) {
    const btn = triggerBtn || document.getElementById('btn-download-jpg-report');
    const reportArea = document.getElementById('report-print-area');
    const type = document.getElementById('report-type').value;

    ensureReportWatermark();

    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Memproses JPG...';
    }

    try {
        if (typeof html2canvas === 'function') {
            // Hitung lebar riil seluruh tabel di dalam laporan agar tidak terpotong di sebelah kanan
            let maxTableWidth = 820;
            reportArea.querySelectorAll('table').forEach(tbl => {
                if (tbl.scrollWidth > maxTableWidth) {
                    maxTableWidth = tbl.scrollWidth;
                }
            });
            const requiredWidth = Math.max(maxTableWidth + 68, 880);

            const canvas = await html2canvas(reportArea, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                width: requiredWidth,
                windowWidth: requiredWidth + 120,
                onclone: (clonedDoc) => {
                    const clonedArea = clonedDoc.getElementById('report-print-area');
                    if (clonedArea) {
                        clonedArea.style.display = 'block';
                        clonedArea.style.width = `${requiredWidth}px`;
                        clonedArea.style.minWidth = `${requiredWidth}px`;
                        clonedArea.style.maxWidth = `${requiredWidth}px`;
                        clonedArea.style.padding = '28px 32px';
                        clonedArea.style.margin = '0';
                        clonedArea.style.border = 'none';
                        clonedArea.style.boxShadow = 'none';
                        clonedArea.style.position = 'relative';
                        clonedArea.style.overflow = 'visible';
                        clonedArea.style.boxSizing = 'border-box';
                    }
                    const clonedHeader = clonedDoc.querySelector('#report-print-area .print-only-show');
                    if (clonedHeader) {
                        clonedHeader.style.display = 'block';
                        clonedHeader.style.marginBottom = '20px';
                        clonedHeader.style.paddingBottom = '12px';
                        clonedHeader.style.borderBottom = '2px solid #0f172a';
                        clonedHeader.style.position = 'relative';
                        clonedHeader.style.zIndex = '1';
                    }
                    const clonedContainer = clonedDoc.getElementById('report-output-container');
                    if (clonedContainer) {
                        clonedContainer.style.overflow = 'visible';
                        clonedContainer.style.width = '100%';
                        clonedContainer.style.padding = '0';
                        clonedContainer.style.position = 'relative';
                        clonedContainer.style.zIndex = '1';
                    }
                    clonedDoc.querySelectorAll('.report-table-wrap').forEach(wrap => {
                        wrap.style.overflow = 'visible';
                        wrap.style.width = '100%';
                    });
                    clonedDoc.querySelectorAll('#report-output-container .table').forEach(tbl => {
                        tbl.style.width = '100%';
                    });
                }
            });

            const jpgUrl = canvas.toDataURL('image/jpeg', 0.95);
            const link = document.createElement('a');
            link.download = `Laporan_${type}_${Date.now()}.jpg`;
            link.href = jpgUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast('Laporan berhasil disimpan sebagai JPG!');
        } else {
            throw new Error('Library html2canvas belum siap.');
        }
    } catch (err) {
        console.error('Download Report JPG Error:', err);
        showToast('Gagal menyimpan laporan sebagai JPG.', 'danger');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

document.getElementById('btn-download-jpg-report').addEventListener('click', () => {
    window.openDocumentPreviewModal('jpg', 'report');
});

// 3. FUNGSI CETAK PRINTER BLUETOOTH (BUKA PREVIEW DULU -> KLIK CETAK BLUETOOTH)
let btCharacteristic = null;

async function executeBluetoothReport(triggerBtn) {
    if (!navigator.bluetooth) {
        showToast('Membuka dialog printer sistem (Pilih printer Bluetooth Anda)...', 'warning');
        setTimeout(() => window.print(), 600);
        return;
    }

    const btn = triggerBtn || document.getElementById('btn-print-bluetooth');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Menghubungkan BT...';
    }

    try {
        if (!btCharacteristic) {
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [
                    '000018f0-0000-1000-8000-00805f9b34fb',
                    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
                    '49535343-fe7d-4ae5-8fa9-9fafd205e455'
                ]
            });

            const server = await device.gatt.connect();
            const services = await server.getPrimaryServices();
            for (const service of services) {
                const characteristics = await service.getCharacteristics();
                for (const char of characteristics) {
                    if (char.properties.write || char.properties.writeWithoutResponse) {
                        btCharacteristic = char;
                        break;
                    }
                }
                if (btCharacteristic) break;
            }
        }

        if (!btCharacteristic) {
            throw new Error('Karakteristik tulis printer Bluetooth tidak ditemukan.');
        }

        const receiptText = buildThermalReportText();
        const encoder = new TextEncoder();
        const dataBytes = encoder.encode(receiptText);

        const chunkSize = 100;
        for (let i = 0; i < dataBytes.length; i += chunkSize) {
            const chunk = dataBytes.slice(i, i + chunkSize);
            if (btCharacteristic.properties.writeWithoutResponse) {
                await btCharacteristic.writeValueWithoutResponse(chunk);
            } else {
                await btCharacteristic.writeValue(chunk);
            }
        }

        showToast('Berhasil mencetak ke Printer Bluetooth!');
    } catch (err) {
        console.warn('Bluetooth Print Info:', err);
        btCharacteristic = null;
        if (err.name !== 'NotFoundError') {
            showToast('Gagal koneksi langsung BT. Membuka dialog cetak sistem...', 'warning');
            setTimeout(() => window.print(), 800);
        } else {
            showToast('Pencarian printer Bluetooth dibatalkan.', 'warning');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

document.getElementById('btn-print-bluetooth').addEventListener('click', () => {
    window.openDocumentPreviewModal('bluetooth', 'report');
});

function buildThermalReportText() {
    const type = document.getElementById('report-type').value;
    const title = document.getElementById('report-print-title').textContent;
    const line = '--------------------------------\n';
    let out = '\x1B\x40'; // Init ESC/POS
    out += '\x1B\x61\x01'; // Align Center
    out += 'DAVKA TOUR MANAGEMENT\n';
    out += title + '\n';
    out += line;
    out += '\x1B\x61\x00'; // Align Left

    if (type === 'keluarga') {
        const families = [...new Set(db.participants.map(p => p.family))].sort();
        let grandTagihan = 0, grandDibayar = 0, grandSisa = 0;
        families.forEach(f => {
            const stats = calcFamilyStats(f);
            grandTagihan += stats.totalTagihan;
            grandDibayar += stats.totalDibayar;
            grandSisa += stats.sisa;
            out += `Keluarga: ${f}\n`;
            stats.members.forEach(m => {
                const ms = calcParticipantStats(m.id);
                out += `- ${m.name}: ${formatRp(ms.totalTagihan)} (Sisa: ${formatRp(ms.sisa)})\n`;
            });
            out += `Sub Tagihan : ${formatRp(stats.totalTagihan)}\n`;
            out += `Sub Dibayar : ${formatRp(stats.totalDibayar)}\n`;
            out += `Sub Sisa    : ${formatRp(stats.sisa)}\n`;
            out += line;
        });
        out += `GRAND TOTAL TAGIHAN: ${formatRp(grandTagihan)}\n`;
        out += `GRAND TOTAL DIBAYAR: ${formatRp(grandDibayar)}\n`;
        out += `GRAND TOTAL SISA   : ${formatRp(grandSisa)}\n`;
    } else {
        const rows = document.querySelectorAll('#report-output-container tr');
        rows.forEach(r => {
            const cols = Array.from(r.querySelectorAll('th, td')).map(c => c.innerText.trim());
            if (cols.length > 0) {
                out += cols.join(' | ') + '\n';
            }
        });
    }

    out += line;
    out += '\x1B\x61\x01';
    out += 'DOKUMEN ASLI - DAVKA TOUR\n\n\n\n';
    return out;
}

function generateReportTablePeserta() {
    let html = `<div class="report-table-wrap"><table class="table"><thead><tr>
        <th style="width:45px;" class="text-center">No</th>
        <th>Nama Peserta</th>
        <th>Keluarga</th>
        <th class="text-right">Total Tagihan</th>
        <th class="text-right">Telah Dibayar</th>
        <th class="text-right">Sisa</th>
        <th class="text-right">Kelebihan</th>
        <th class="text-center">Status</th>
        </tr></thead><tbody>`;
    db.participants.forEach((p, idx) => {
        const s = calcParticipantStats(p.id);
        html += `<tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${escapeHTML(p.name)}</strong></td>
            <td>${escapeHTML(p.family)}</td>
            <td class="text-right">${formatRp(s.totalTagihan)}</td>
            <td class="text-right text-success">${formatRp(s.totalDibayar)}</td>
            <td class="text-right text-danger">${formatRp(s.sisa)}</td>
            <td class="text-right text-info">${formatRp(s.kelebihan)}</td>
            <td class="text-center"><span class="badge ${s.badgeClass}">${s.status}</span></td>
        </tr>`;
    });
    return html + `</tbody></table></div>`;
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
        <div class="report-family-title">Keluarga: ${escapeHTML(f)}</div>
        <div class="report-table-wrap">
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th style="width:40px;" class="text-center">No</th>
                        <th>Nama Anggota</th>
                        <th class="text-right" style="width:130px;">Tagihan</th>
                        <th class="text-right" style="width:130px;">Dibayar</th>
                        <th class="text-right" style="width:130px;">Sisa</th>
                        <th class="text-center" style="width:140px;">Status</th>
                    </tr>
                </thead>
                <tbody>
        `;
        stats.members.forEach((m, idx) => {
            const ms = calcParticipantStats(m.id);
            html += `<tr>
                <td class="text-center">${idx + 1}</td>
                <td><strong>${escapeHTML(m.name)}</strong></td>
                <td class="text-right">${formatRp(ms.totalTagihan)}</td>
                <td class="text-right text-success">${formatRp(ms.totalDibayar)}</td>
                <td class="text-right text-danger">${formatRp(ms.sisa)}</td>
                <td class="text-center"><span class="badge ${ms.badgeClass}">${ms.status}</span></td>
            </tr>`;
        });
        html += `<tr style="font-weight:bold; background:#f8fafc;">
            <td colspan="2" class="text-right">TOTAL KELUARGA</td>
            <td class="text-right">${formatRp(stats.totalTagihan)}</td>
            <td class="text-right text-success">${formatRp(stats.totalDibayar)}</td>
            <td class="text-right text-danger">${formatRp(stats.sisa)}</td>
            <td></td>
        </tr></tbody></table></div>`;
    });
    
    html += `
    <div class="report-grand-total">
        <h3>GRAND TOTAL SELURUH KELUARGA</h3>
        <div class="report-grand-row">
            <span>Total Tagihan:</span>
            <strong>${formatRp(grandTagihan)}</strong>
        </div>
        <div class="report-grand-row">
            <span>Total Dibayar:</span>
            <strong class="text-success">${formatRp(grandDibayar)}</strong>
        </div>
        <div class="report-grand-row" style="border-top:1px solid #cbd5e1; margin-top:6px; padding-top:8px; font-size:15px;">
            <strong>Total Sisa Tagihan:</strong>
            <strong class="text-danger">${formatRp(grandSisa)}</strong>
        </div>
    </div>`;
    return html;
}

function generateReportTablePenerimaan() {
    let data = [...db.payments]; 
    let total = 0;
    let html = `<div class="report-table-wrap"><table class="table"><thead><tr>
        <th style="width:45px;" class="text-center">No</th>
        <th>Tanggal</th>
        <th>Pembayar</th>
        <th class="text-right">Penerimaan</th>
        <th>Metode</th>
        <th>Catatan</th>
        </tr></thead><tbody>`;
    data.sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach((p, idx) => {
        total += p.amount;
        html += `<tr>
            <td class="text-center">${idx + 1}</td>
            <td>${formatDate(p.date)}</td>
            <td><strong>${escapeHTML(p.name)}</strong></td>
            <td class="text-right text-bold text-success">${formatRp(p.amount)}</td>
            <td>${escapeHTML(p.method)}</td>
            <td class="col-wrap">${escapeHTML(p.notes || '-')}</td>
        </tr>`;
    });
    html += `<tr style="font-weight:bold; background:#f8fafc;">
        <td colspan="3" class="text-right">TOTAL PENERIMAAN:</td>
        <td class="text-right text-success">${formatRp(total)}</td>
        <td colspan="2"></td>
    </tr>`;
    return html + `</tbody></table></div>`;
}

function generateReportTablePengeluaran() {
    let data = [...db.expenses];
    let total = 0;
    let html = `<div class="report-table-wrap"><table class="table"><thead><tr>
        <th style="width:45px;" class="text-center">No</th>
        <th>Tanggal</th>
        <th>Kategori</th>
        <th>Keterangan</th>
        <th>Vendor</th>
        <th class="text-right">Pengeluaran</th>
        <th>Metode</th>
        </tr></thead><tbody>`;
    data.sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach((e, idx) => {
        total += e.amount;
        html += `<tr>
            <td class="text-center">${idx + 1}</td>
            <td>${formatDate(e.date)}</td>
            <td>${escapeHTML(e.category)}</td>
            <td class="col-wrap">${escapeHTML(e.desc)}</td>
            <td>${escapeHTML(e.vendor)}</td>
            <td class="text-right text-bold text-danger">${formatRp(e.amount)}</td>
            <td>${escapeHTML(e.method)}</td>
        </tr>`;
    });
    html += `<tr style="font-weight:bold; background:#f8fafc;">
        <td colspan="5" class="text-right">TOTAL PENGELUARAN:</td>
        <td class="text-right text-danger">${formatRp(total)}</td>
        <td></td>
    </tr>`;
    return html + `</tbody></table></div>`;
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
        
        let ketText = escapeHTML(t.ref) + (t.desc ? ` - ${escapeHTML(t.desc)}` : '');
        htmlRows += `<tr>
            <td>${formatDate(t.date)}</td>
            <td>${t.type === 'IN' ? 'Penerimaan Peserta' : 'Pengeluaran Operasional'}</td>
            <td class="col-wrap">${ketText}</td>
            <td class="text-right text-success">${t.type === 'IN' ? formatRp(t.amount) : '-'}</td>
            <td class="text-right text-danger">${t.type === 'OUT' ? formatRp(t.amount) : '-'}</td>
            <td class="text-right"><strong>${formatRp(saldoBerjalan)}</strong></td>
        </tr>`;
    });

    let html = `
    <div class="report-cash-summary">
        <div class="report-cash-box"><h4>Saldo Awal</h4><h2 class="text-primary">${formatRp(saldoAwal)}</h2></div>
        <div class="report-cash-box"><h4>Total Masuk</h4><h2 class="text-success">+ ${formatRp(kasMasuk)}</h2></div>
        <div class="report-cash-box"><h4>Total Keluar</h4><h2 class="text-danger">- ${formatRp(kasKeluar)}</h2></div>
        <div class="report-cash-box"><h4>Saldo Akhir</h4><h2 class="text-primary">${formatRp(saldoAwal + kasMasuk - kasKeluar)}</h2></div>
    </div>
    <div class="report-table-wrap">
        <table class="table">
            <thead>
                <tr>
                    <th>Tanggal</th>
                    <th>Jenis Transaksi</th>
                    <th>Keterangan</th>
                    <th class="text-right">Debet (Masuk)</th>
                    <th class="text-right">Kredit (Keluar)</th>
                    <th class="text-right">Saldo</th>
                </tr>
            </thead>
            <tbody>
                <tr style="background:#f8fafc;"><td colspan="5" class="text-right"><strong>SALDO AWAL:</strong></td><td class="text-right"><strong>${formatRp(saldoAwal)}</strong></td></tr>
                ${htmlRows}
            </tbody>
        </table>
    </div>`;
    return html;
}

function generateReportRekapitulasi() {
    let sumTagihan = 0, sumPenerimaan = 0, sumPengeluaran = 0, sumTeralokasi = 0, sumSisa = 0, sumKelebihan = 0;
    db.participants.forEach(p => {
        const raw = getRawParticipantTotals(p.id);
        const s = calcParticipantStats(p.id);
        sumTagihan += raw.totalTagihan;
        sumTeralokasi += raw.rawTotalDibayar;
        sumSisa += s.sisa;
        sumKelebihan += s.kelebihan;
    });
    db.payments.forEach(p => sumPenerimaan += p.amount);
    db.expenses.forEach(e => sumPengeluaran += e.amount);
    
    const danaMenganggur = sumPenerimaan - sumTeralokasi;
    const saldoKas = sumPenerimaan - sumPengeluaran;
    const surplusDefisit = sumTagihan - sumPengeluaran;
    
    return `
    <div class="report-table-wrap">
        <table class="table">
            <thead>
                <tr>
                    <th>Komponen Rekapitulasi Keuangan</th>
                    <th class="text-right" style="width: 200px;">Nilai / Nominal</th>
                </tr>
            </thead>
            <tbody>
                <tr><td>Total Peserta Terdaftar</td><td class="text-right text-bold">${db.participants.length} Orang</td></tr>
                <tr><td>Total Tagihan Peserta</td><td class="text-right text-bold">${formatRp(sumTagihan)}</td></tr>
                <tr><td>Total Penerimaan Kas</td><td class="text-right text-bold text-success">${formatRp(sumPenerimaan)}</td></tr>
                <tr><td>Dana Telah Dialokasikan</td><td class="text-right text-bold">${formatRp(sumTeralokasi)}</td></tr>
                <tr><td>Dana Belum Dialokasikan</td><td class="text-right text-bold text-warning">${formatRp(danaMenganggur)}</td></tr>
                <tr><td>Total Sisa Harus Ditagih</td><td class="text-right text-bold text-danger">${formatRp(sumSisa)}</td></tr>
                <tr><td>Total Kelebihan Pembayaran</td><td class="text-right text-bold text-info">${formatRp(sumKelebihan)}</td></tr>
                <tr><td>Total Pengeluaran Aktual</td><td class="text-right text-bold text-danger">${formatRp(sumPengeluaran)}</td></tr>
                <tr style="background:#f1f5f9;"><td><strong>SALDO KAS BERJALAN (Penerimaan - Pengeluaran)</strong></td><td class="text-right text-bold text-primary" style="font-size:14px;">${formatRp(saldoKas)}</td></tr>
                <tr><td><strong>Perkiraan Surplus / Defisit (Tagihan - Pengeluaran)</strong></td><td class="text-right text-bold ${surplusDefisit >= 0 ? 'text-success' : 'text-danger'}" style="font-size:14px;">${formatRp(surplusDefisit)}</td></tr>
            </tbody>
        </table>
    </div>
    `;
}

// FACTORY RESET TERHUBUNG KE SUPABASE CLOUD
document.getElementById('btn-delete-all-data').addEventListener('click', () => {
    confirmAction(
        'HAPUS SEMUA DATA PERMANEN', 
        'PERINGATAN KRITIS: Apakah Anda yakin ingin menghapus SELURUH data di server Supabase?', 
        async () => {
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
