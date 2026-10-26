/* ==========================================================================
   MODUL 4: DETAIL PESERTA & CETAK RINGKASAN (JPEG)
   ========================================================================== */
let currentDetailId = null;

window.openParticipantDetail = function(id) {
    currentDetailId = id;
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById('view-participant-detail').classList.add('active');
    document.getElementById('page-title').textContent = 'Detail Peserta';
    
    document.querySelectorAll('.nav-link').forEach(nav => nav.classList.remove('active'));
    
    // REVISI 1: Manfaatkan History PushState agar mendukung tombol BACK pada Handphone
    history.pushState({ view: 'detail', id: id }, '', '#detail');
    
    renderDetailParticipant(id);
}

// REVISI 1: Event listener tombol back pada browser / hardware Android back button
window.addEventListener('popstate', (e) => {
    if (currentDetailId !== null) {
        currentDetailId = null;
        document.getElementById('view-participant-detail').classList.remove('active');
        document.getElementById('view-participants').classList.add('active');
        document.querySelector('[data-target="view-participants"]').classList.add('active');
        document.getElementById('page-title').textContent = 'Peserta & Keluarga';
    }
});

function renderDetailParticipant(id) {
    if(!id) return;
    const p = db.participants.find(x => x.id === id);
    if(!p) return;

    const stats = calcParticipantStats(id);

    document.getElementById('detail-part-name').textContent = p.name;
    document.getElementById('detail-part-family').textContent = p.family;
    document.getElementById('detail-part-id').textContent = p.id;
    
    const badge = document.getElementById('detail-part-status-badge');
    badge.textContent = stats.status;
    badge.className = `badge ${stats.badgeClass}`;

    document.getElementById('detail-total-tagihan').textContent = formatRp(stats.totalTagihan);
    document.getElementById('detail-total-dibayar').textContent = formatRp(stats.totalDibayar);
    
    if (stats.kelebihan > 0) {
        document.getElementById('detail-sisa-tagihan').textContent = `+${formatRp(stats.kelebihan)} (Lebih)`;
        document.getElementById('detail-sisa-tagihan').className = 'stat-value text-info';
    } else {
        document.getElementById('detail-sisa-tagihan').textContent = formatRp(stats.sisa);
        document.getElementById('detail-sisa-tagihan').className = 'stat-value text-danger';
    }

    const tbodyCosts = document.querySelector('#table-detail-costs tbody');
    tbodyCosts.innerHTML = '';
    const pCosts = db.costs.filter(c => c.participantId === id);
    pCosts.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHTML(c.category)}</td>
            <td>${formatRp(c.price)}</td>
            <td>${c.qty}</td>
            <td><strong>${formatRp(c.total)}</strong></td>
            <td>${escapeHTML(c.notes || '-')}</td>
            <td>
                <button class="btn btn-sm btn-outline-secondary" onclick="openEditCostModal('${c.id}')">Edit</button>
                <button class="btn btn-sm btn-danger ml-5" onclick="deleteCost('${c.id}', true)">&times;</button>
            </td>
        `;
        tbodyCosts.appendChild(tr);
    });
    document.getElementById('detail-sum-costs').textContent = formatRp(stats.totalTagihan);

    const tbodyPays = document.querySelector('#table-detail-payments tbody');
    tbodyPays.innerHTML = '';
    let hasPayment = false;
    db.payments.forEach(pay => {
        if(pay.allocations) {
            const alloc = pay.allocations.find(a => a.participantId === id);
            if(alloc) {
                hasPayment = true;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatDate(pay.date)}</td>
                    <td class="text-success text-bold">${formatRp(alloc.amount)}</td>
                    <td>${escapeHTML(pay.method)}</td>
                    <td>${escapeHTML(pay.notes || '-')}</td>
                `;
                tbodyPays.appendChild(tr);
            }
        }
    });
    if(!hasPayment) tbodyPays.innerHTML = '<tr><td colspan="4" class="text-center">Belum ada riwayat pembayaran.</td></tr>';
}

window.openEditCostModal = function(costId) {
    const cost = db.costs.find(c => c.id === costId);
    if(!cost) return;

    const catSelect = document.getElementById('edit-cost-cat');
    catSelect.innerHTML = '';
    db.categories.forEach(cat => {
        catSelect.innerHTML += `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`;
    });

    document.getElementById('edit-cost-id').value = cost.id;
    document.getElementById('edit-cost-cat').value = cost.category;
    document.getElementById('edit-cost-price').value = cost.price;
    document.getElementById('edit-cost-notes').value = cost.notes || '';

    openModal('modal-edit-cost');
};

document.getElementById('form-edit-cost').addEventListener('submit', async (e) => {
    e.preventDefault();
    const costId = document.getElementById('edit-cost-id').value;
    const newCat = document.getElementById('edit-cost-cat').value;
    const newPrice = parseFloat(document.getElementById('edit-cost-price').value) || 0;
    const newNotes = document.getElementById('edit-cost-notes').value.trim();

    const costIndex = db.costs.findIndex(c => c.id === costId);
    if(costIndex > -1) {
        const updatedCost = {
            ...db.costs[costIndex],
            category: newCat,
            price: newPrice,
            total: newPrice * (db.costs[costIndex].qty || 1),
            notes: newNotes
        };

        const { error } = await supabaseClient.from('costs').upsert([updatedCost]);
        if (error) {
            showToast('Gagal memperbarui rincian biaya: ' + error.message, 'danger');
            return;
        }

        db.costs[costIndex] = updatedCost;
        showToast('Rincian biaya berhasil diperbarui.');
        closeModal('modal-edit-cost');
        refreshAll();
    }
});

document.getElementById('btn-add-cost-from-detail').addEventListener('click', () => {
    prepareIndividualCostForm(currentDetailId);
});

const getPrintStyles = () => `
    <style>
        .print-wrap { width: 100%; max-width: 720px; margin: 0 auto; padding: 24px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #ffffff; color: #1e293b; box-sizing: border-box; }
        .print-header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
        .print-header h2 { margin: 0; color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
        .print-header p { margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748b; letter-spacing: 1px; }
        .print-info { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13.5px; }
        .print-info td { padding: 4px 0; vertical-align: top; color: #1e293b; }
        .print-info td.info-label { width: 155px; font-weight: 700; color: #334155; }
        .print-info td.info-sep { width: 12px; text-align: center; font-weight: 700; }
        .print-section-title { font-weight: 700; font-size: 13.5px; color: #0f172a; margin: 14px 0 6px 0; }
        .print-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; table-layout: auto; }
        .print-table th, .print-table td { border: 1px solid #cbd5e1; padding: 9px 12px; text-align: left; vertical-align: middle; }
        .print-table th { background-color: #f1f5f9; font-weight: 700; color: #0f172a; white-space: nowrap; }
        .print-table tr:nth-child(even) { background-color: #f8fafc; }
        .print-table td.nowrap, .print-table th.nowrap { white-space: nowrap !important; }
        .print-wrap .text-right { text-align: right !important; }
        .print-wrap .text-center { text-align: center !important; }
        .print-wrap .text-success { color: #16a34a !important; font-weight: 700; }
        .print-wrap .text-danger { color: #dc2626 !important; font-weight: 700; }
        .print-wrap .text-info { color: #0284c7 !important; font-weight: 700; }
        .print-wrap .text-bold { font-weight: 700; }
        .print-summary { background: #f8fafc; padding: 16px 18px; border: 1px solid #cbd5e1; border-radius: 8px; margin-top: 16px; }
        .print-summary-title { font-weight: 800; font-size: 13.5px; color: #0f172a; margin-bottom: 8px; text-transform: uppercase; }
        .print-summary-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 13.5px; color: #334155; }
        .print-summary-row.total-row { border-top: 1px solid #cbd5e1; margin-top: 8px; padding-top: 10px; font-size: 15px; font-weight: 800; color: #0f172a; }
        .print-footer { margin-top: 20px; text-align: center; font-size: 11.5px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
    </style>
`;

document.getElementById('btn-print-individual').addEventListener('click', () => {
    const p = db.participants.find(x => x.id === currentDetailId);
    if (!p) return;
    const stats = calcParticipantStats(p.id);
    const pCosts = db.costs.filter(c => c.participantId === p.id);
    
    let html = getPrintStyles() + `<div class="print-wrap">`;
    html += `
        <div class="print-header">
            <h2>RINGKASAN BIAYA INDIVIDU</h2>
            <p>TOUR DAVKA TRAVEL</p>
        </div>
        <table class="print-info">
            <tr><td class="info-label">Nama Peserta</td><td class="info-sep">:</td><td><strong>${escapeHTML(p.name)}</strong></td></tr>
            <tr><td class="info-label">Keluarga/Grup</td><td class="info-sep">:</td><td>${escapeHTML(p.family)}</td></tr>
            <tr><td class="info-label">Status</td><td class="info-sep">:</td><td><strong>${stats.status}</strong></td></tr>
        </table>
        
        <div class="print-section-title">A. Rincian Biaya</div>
        <table class="print-table">
            <thead>
                <tr>
                    <th style="width: 40px;" class="text-center">No</th>
                    <th>Deskripsi Kategori</th>
                    <th class="text-right nowrap" style="width: 160px;">Total Biaya (Rp)</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    if(pCosts.length === 0) {
        html += `<tr><td colspan="3" class="text-center text-muted">Belum ada tagihan biaya</td></tr>`;
    } else {
        pCosts.forEach((c, idx) => {
            let noteStr = c.notes ? `<div style="font-size:11.5px; color:#64748b; margin-top:2px;">Catatan: ${escapeHTML(c.notes)}</div>` : '';
            html += `<tr>
                <td class="text-center">${idx + 1}</td>
                <td><strong>${escapeHTML(c.category)}</strong> ${c.qty > 1 ? `(${c.qty}x)` : ''}${noteStr}</td>
                <td class="text-right nowrap text-bold">${formatRp(c.total)}</td>
            </tr>`;
        });
    }
    
    html += `</tbody></table>`;
    html += `<div class="print-section-title">B. Riwayat Pembayaran</div>
        <table class="print-table">
            <thead>
                <tr>
                    <th style="width: 40px;" class="text-center">No</th>
                    <th>Tanggal Pembayaran</th>
                    <th>Metode</th>
                    <th class="text-right nowrap" style="width: 160px;">Nominal (Rp)</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    let payCount = 0;
    db.payments.forEach(pay => {
        if(pay.allocations) {
            const alloc = pay.allocations.find(a => a.participantId === p.id);
            if(alloc) {
                payCount++;
                html += `<tr>
                    <td class="text-center">${payCount}</td>
                    <td class="nowrap">${formatDate(pay.date)}</td>
                    <td>${escapeHTML(pay.method || '-')}</td>
                    <td class="text-right nowrap text-success">${formatRp(alloc.amount)}</td>
                </tr>`;
            }
        }
    });
    if(payCount === 0) html += `<tr><td colspan="4" class="text-center text-muted">Belum ada riwayat pembayaran</td></tr>`;
    html += `</tbody></table>`;
    
    html += `
        <div class="print-summary">
            <div class="print-summary-title">TOTAL RINGKASAN INDIVIDU:</div>
            <div class="print-summary-row">
                <span>Total Tagihan:</span>
                <strong class="nowrap">${formatRp(stats.totalTagihan)}</strong>
            </div>
            <div class="print-summary-row">
                <span>Total Dibayar:</span>
                <strong class="text-success nowrap">${formatRp(stats.totalDibayar)}</strong>
            </div>
    `;
    
    if(stats.kelebihan > 0) {
        html += `
            <div class="print-summary-row total-row">
                <span>TOTAL KELEBIHAN BAYAR:</span>
                <span class="text-info nowrap">+${formatRp(stats.kelebihan)}</span>
            </div>
        `;
    } else {
        html += `
            <div class="print-summary-row total-row">
                <span>TOTAL SISA DIBAYAR:</span>
                <span class="text-danger nowrap">${formatRp(stats.sisa)}</span>
            </div>
        `;
    }
    
    html += `</div>
        <div class="print-footer">Dicetak otomatis oleh Sistem Manajemen Davka Travel</div>
    </div>`;

    document.getElementById('ringkasan-print-area').innerHTML = html;
    openModal('modal-ringkasan');
});

document.getElementById('btn-print-family').addEventListener('click', () => {
    const p = db.participants.find(x => x.id === currentDetailId);
    if (!p) return;
    const fStats = calcFamilyStats(p.family);
    
    let html = getPrintStyles() + `<div class="print-wrap">`;
    html += `
        <div class="print-header">
            <h2>RINGKASAN BIAYA KELUARGA</h2>
            <p>TOUR DAVKA TRAVEL</p>
        </div>
        <table class="print-info">
            <tr><td class="info-label">Nama Keluarga/Grup</td><td class="info-sep">:</td><td><strong>${escapeHTML(p.family)}</strong></td></tr>
            <tr><td class="info-label">Jumlah Anggota</td><td class="info-sep">:</td><td>${fStats.members.length} Orang</td></tr>
        </table>
        
        <table class="print-table">
            <thead>
                <tr>
                    <th style="width: 40px;" class="text-center">No</th>
                    <th>Nama Peserta</th>
                    <th class="text-right nowrap" style="width: 130px;">Tagihan</th>
                    <th class="text-right nowrap" style="width: 130px;">Dibayar</th>
                    <th class="text-right nowrap" style="width: 130px;">Sisa/Lebih</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    fStats.members.forEach((m, idx) => {
        const stats = calcParticipantStats(m.id);
        let sisaStr = stats.kelebihan > 0 ? `<span class="text-info">+${formatRp(stats.kelebihan)}</span>` : `<span class="text-danger">${formatRp(stats.sisa)}</span>`;
        html += `<tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${escapeHTML(m.name)}</strong><div style="font-size:11px; color:#64748b; margin-top:2px;">${stats.status}</div></td>
            <td class="text-right nowrap">${formatRp(stats.totalTagihan)}</td>
            <td class="text-right nowrap text-success">${formatRp(stats.totalDibayar)}</td>
            <td class="text-right nowrap">${sisaStr}</td>
        </tr>`;
    });
    
    html += `</tbody></table>`;
    html += `
        <div class="print-summary">
            <div class="print-summary-title">TOTAL BIAYA KELUARGA:</div>
            <div class="print-summary-row">
                <span>Total Tagihan:</span>
                <strong class="nowrap">${formatRp(fStats.totalTagihan)}</strong>
            </div>
            <div class="print-summary-row">
                <span>Total Dibayar:</span>
                <strong class="text-success nowrap">${formatRp(fStats.totalDibayar)}</strong>
            </div>
    `;
    
    if(fStats.kelebihan > 0) {
        html += `
            <div class="print-summary-row total-row">
                <span>TOTAL KELEBIHAN BAYAR:</span>
                <span class="text-info nowrap">+${formatRp(fStats.kelebihan)}</span>
            </div>
        `;
    } else {
        html += `
            <div class="print-summary-row total-row">
                <span>TOTAL SISA DIBAYAR:</span>
                <span class="text-danger nowrap">${formatRp(fStats.sisa)}</span>
            </div>
        `;
    }
    
    html += `</div>
        <div class="print-footer">Dicetak otomatis oleh Sistem Manajemen Davka Travel</div>
    </div>`;

    document.getElementById('ringkasan-print-area').innerHTML = html;
    openModal('modal-ringkasan');
});

// REVISI 3: Render JPEG kini presisi, utuh, tanpa terpotong
document.getElementById('btn-download-jpeg').addEventListener('click', async () => {
    const btn = document.getElementById('btn-download-jpeg');
    const printArea = document.getElementById('ringkasan-print-area');
    const targetEl = printArea.querySelector('.print-wrap') || printArea;

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Memproses...';

    try {
        if (typeof html2canvas === 'function') {
            const canvas = await html2canvas(targetEl, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                windowWidth: 800,
                onclone: (clonedDoc) => {
                    const clonedWrap = clonedDoc.querySelector('.print-wrap');
                    if (clonedWrap) {
                        clonedWrap.style.width = '720px';
                        clonedWrap.style.maxWidth = '720px';
                        clonedWrap.style.margin = '0';
                        clonedWrap.style.boxShadow = 'none';
                        clonedWrap.style.transform = 'none';
                    }
                }
            });

            const jpegUrl = canvas.toDataURL('image/jpeg', 0.95);
            const link = document.createElement('a');
            link.download = `Ringkasan_Biaya_${Date.now()}.jpg`;
            link.href = jpegUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast('Berhasil mengunduh gambar JPEG!');
        } else {
            throw new Error('Library html2canvas belum siap.');
        }
    } catch (err) {
        console.error('Download JPEG Error:', err);
        showToast('Gagal memproses gambar.', 'danger');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
});
