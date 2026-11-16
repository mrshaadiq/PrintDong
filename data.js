/* Data awal PrintDong! — semua daftar & status pesanan dirender dari sini. */
window.PD_DATA = (function () {
  const shops = [
    { id: 'berkah', name: 'Fotokopi Berkah Jaya', ini: 'FB', addr: 'Jl. RS Fatmawati Raya No. 21',
      addrFull: 'Jl. RS Fatmawati Raya No. 21, Pondok Labu, Jakarta Selatan',
      dist: 250, distLabel: '250 m', walk: 3, eta: 8, queue: 4, bw: 500, color: 1500,
      rating: '4,8', reviews: '1,2rb', hours: '07–22', open24: false, calmAt: '20.00' },
    { id: 'sinarmas', name: 'Sinar Mas Print & Jilid', ini: 'SM', addr: 'Jl. Pangkalan Jati No. 5',
      addrFull: 'Jl. Pangkalan Jati No. 5, Cinere, Depok',
      dist: 400, distLabel: '400 m', walk: 5, eta: 22, queue: 11, bw: 400, color: 1200,
      rating: '4,6', reviews: '860', hours: '08–21', open24: false, calmAt: '21.00' },
    { id: 'anugrah', name: 'Kios Cetak Anugrah', ini: 'KA', addr: 'Gg. Masjid, Pondok Labu',
      addrFull: 'Gg. Masjid, Pondok Labu, Jakarta Selatan',
      dist: 650, distLabel: '650 m', walk: 8, eta: 5, queue: 2, bw: 600, color: 2000,
      rating: '4,9', reviews: '540', hours: '24 jam', open24: true, calmAt: '02.00' },
    { id: 'fatmawati', name: 'Digital Print Fatmawati', ini: 'DP', addr: 'Jl. RS Fatmawati No. 88',
      addrFull: 'Jl. RS Fatmawati No. 88, Cilandak, Jakarta Selatan',
      dist: 1100, distLabel: '1,1 km', walk: 14, eta: 15, queue: 7, bw: 500, color: 1000,
      rating: '4,7', reviews: '2,1rb', hours: '07–23', open24: false, calmAt: '19.00' }
  ];

  const bindings = {
    none:   { label: 'Tanpa jilid',  price: 0 },
    staples:{ label: 'Staples',      price: 1000 },
    soft:   { label: 'Softcover',    price: 8000 }
  };

  const orders = [
    { id: 'PD-4835', shopId: 'anugrah', file: 'Makalah_PKN_Kelompok3.pdf', pages: 12, copies: 1, color: 'color',
      paper: '70', sides: 1, binding: 'staples', total: 25000, status: 'ready', pos: 0, qTotal: 3,
      sheets: 12, printed: 12, code: '9M2X', label: 'Hari ini, 19:52', month: 'Hari ini', offsetMin: -30 },
    { id: 'PD-4821', shopId: 'berkah', file: 'Laporan_Praktikum_Basdat.pdf', pages: 23, copies: 2, color: 'bw',
      paper: '70', sides: 1, binding: 'soft', total: 40000, status: 'queue', pos: 2, qTotal: 4,
      sheets: 46, printed: 0, code: '7Q4K', label: 'Hari ini, 20:09', month: 'Hari ini', offsetMin: -7 },
    { id: 'PD-4790', shopId: 'sinarmas', file: 'Makalah_Kewarganegaraan.pdf', pages: 18, copies: 1, color: 'bw',
      paper: '70', sides: 1, binding: 'staples', total: 12000, status: 'done', pos: 0, qTotal: 0,
      sheets: 18, printed: 18, code: 'K8D2', label: '6 Nov, 13:40', month: 'November 2026' },
    { id: 'PD-4744', shopId: 'berkah', file: 'Jurnal_Praktikum_Jarkom.pdf', pages: 26, copies: 1, color: 'bw',
      paper: '70', sides: 2, binding: 'none', total: 14000, status: 'done', pos: 0, qTotal: 0,
      sheets: 26, printed: 26, code: 'P3R7', label: '2 Nov, 09:15', month: 'November 2026' },
    { id: 'PD-4712', shopId: 'fatmawati', file: 'Proposal_PKM_2026.pdf', pages: 32, copies: 1, color: 'color',
      paper: '80', sides: 1, binding: 'soft', total: 52000, status: 'done', pos: 0, qTotal: 0,
      sheets: 32, printed: 32, code: 'M9T1', label: '29 Okt, 16:02', month: 'Oktober 2026' }
  ];

  const notifs = [
    { id: 'n1', type: 'order', icon: 'check-circle', tone: 'ok', title: 'Pesanan siap diambil', time: '20:31',
      body: 'PD-4835 di Kios Cetak Anugrah sudah siap. Kode ambil: 9M2X.', unread: true, group: 'Hari ini' },
    { id: 'n2', type: 'order', icon: 'printer', tone: 'blue', title: 'Pesananmu sedang dicetak', time: '20:18',
      body: 'PD-4821 · Fotokopi Berkah Jaya · posisi 1, siap ± 3 mnt.', unread: true, group: 'Hari ini' },
    { id: 'n3', type: 'order', icon: 'info', tone: 'plain', title: 'Pembayaran berhasil', time: '20:09',
      body: 'Rp40.000 via QRIS untuk PD-4821.', unread: false, group: 'Hari ini' },
    { id: 'n4', type: 'promo', icon: 'sparkle', tone: 'orange', title: 'Promo UAS: diskon 20% jilid', time: '18:00',
      body: 'Berlaku s.d. 30 Nov di 12 percetakan sekitar UPNVJ. Pakai kode UASAMAN.', unread: false, group: 'Kemarin' },
    { id: 'n5', type: 'promo', icon: 'printer', tone: 'blue', title: 'Sinar Mas Print & Jilid lagi sepi', time: '14:12',
      body: 'Cuma 2 antrean sekarang — waktunya cetak tugasmu.', unread: false, group: 'Kemarin' },
    { id: 'n6', type: 'promo', icon: 'crown', tone: 'gold', title: 'Coba PrintDong Plus gratis', time: '09:00',
      body: 'Bebas biaya layanan & prioritas antrean selama 1 bulan.', unread: false, group: 'Kemarin' }
  ];

  return { shops, bindings, orders, notifs, serviceFee: 1000, paper80Extra: 100, promoCode: 'UASAMAN' };
})();
