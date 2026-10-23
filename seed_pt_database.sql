-- =============================================================================
-- SQL SEED DATA: 7 PT BARU & PIHAK PERSETUJUAN
-- Sumber Data: G:\My Drive\notaris bu sri\PT
-- (Tanpa PT Dwi Perkasa Utama & PT Amanah Berkah Property yang sudah ada)
-- Target Database: Supabase PostgreSQL (Tabel: pt_penjual & pt_persetujuan)
-- =============================================================================

BEGIN;

-- Pastikan constraint unique pada kode_pt tersedia agar ON CONFLICT dapat berjalan aman
CREATE UNIQUE INDEX IF NOT EXISTS idx_pt_penjual_kode_pt ON public.pt_penjual (kode_pt);

-- =============================================================================
-- 1. INSERT / UPDATE DATA TABEL: pt_penjual (7 PT)
-- =============================================================================
INSERT INTO public.pt_penjual (
    kode_pt,
    nama,
    alamat,
    kota,
    npwp,
    akta,
    tgl_akta,
    tipe_pemilik,
    tipe_usaha
)
VALUES
    -- 1. Folder: PT KARYA
    -- Akta Pendirian No. 01 (02/02/2022) Notaris Verena Bani Elissa, S.H., M.Kn.
    -- Akta Perubahan Terakhir No. 09 (30/07/2024) Notaris Verena Bani Elissa, S.H., M.Kn.
    -- NPWP Cabang Demak: 63.230.164.4-515.001 (NITKU: 0632301644043000000001)
    (
        'PT_KARYA',
        'PT KARYA DEVELOPMENT REALTY',
        'Desa Jamus RT 001 / RW 001, Desa Jamus, Kecamatan Mranggen, Kabupaten Demak, Jawa Tengah',
        'Jakarta Utara',
        '0632301644515001',
        '01',
        '02/02/2022',
        '33',
        '4'
    ),

    -- 2. Folder: PT NAZURA
    -- Akta Pendirian No. 07 (10/07/2024) Notaris Nengah Reza Narendra Putra, S.H., M.Kn.
    -- Akta Perubahan Terakhir No. 18 (20/12/2024) Notaris Nengah Reza Narendra Putra, S.H., M.Kn.
    -- NPWP: 13.914.504.9-515.000 (NPWP16: 0139145049515000)
    (
        'PT_NAZURA',
        'PT NAZURA PUTRI CEMERLANG PROPERTI',
        'Kavling Taman Griya Firdaus Tahap 1 Blok C, Desa Katonsari, Kecamatan Demak, Kabupaten Demak, Jawa Tengah',
        'Demak',
        '0139145049515000',
        '07',
        '10/07/2024',
        '33',
        '4'
    ),

    -- 3. Folder: PT RETINDODELTA
    -- Akta Pendirian No. 10 (05/12/1989) Notaris Soebagjo Ronoatmodjo, S.H.
    -- Akta Perubahan Terakhir No. 23 (30/10/2017) Notaris Sri Wahyuningsih, S.H., M.Kn.
    -- NPWP Cabang Demak: 01.346.913.5-515.001 (NITKU: 0013469135013000000001)
    (
        'PT_RETINDODELTA',
        'PT RETINDODELTA UTAMA',
        'Perumahan Taman Kembang Regency N-01, Desa Ketanjung, Kecamatan Karanganyar, Kabupaten Demak, Jawa Tengah',
        'Jakarta Selatan',
        '0013469135515001',
        '10',
        '05/12/1989',
        '33',
        '4'
    ),

    -- 4. Folder: PT JBS
    -- Akta Pendirian No. 67 (10/01/2011) Notaris Nurna Ningsih, S.H., M.Kn.
    -- Akta Perubahan Terakhir No. 11 (21/03/2022) Notaris Aji Pranoto, S.H.
    -- NPWP: 03.132.140.9-515.000 (NPWP16: 0031321409515000)
    (
        'PT_JBS',
        'PT JAYA BERSAMA STIYA',
        'Desa Brumbung RT 004 / RW 002, Desa Brumbung, Kecamatan Mranggen, Kabupaten Demak, Jawa Tengah',
        'Demak',
        '0031321409515000',
        '67',
        '10/01/2011',
        '33',
        '4'
    ),

    -- 5. Folder: PT UNTUNG
    -- Akta Pendirian No. 262 (28/05/2025) Notaris Sri Wahyuningsih, S.H., M.Kn.
    -- Akta Perubahan No. 97 (29/10/2025) & Akta Kuasa No. 90 (12/12/2025) Notaris Sri Wahyuningsih, S.H., M.Kn.
    -- NPWP16 Coretax: 1000000002974926
    (
        'PT_UNTUNG',
        'PT UNTUNG REZEKI KARYA HUTAMA',
        'Jl. Murti Raya No. 206, Perumahan Muktiharjo Indah, RT 009 / RW 015, Kelurahan Muktiharjo Kidul, Kecamatan Pedurungan, Kota Semarang, Jawa Tengah',
        'Semarang',
        '1000000002974926',
        '262',
        '28/05/2025',
        '33',
        '4'
    ),

    -- 6. Folder: PT PUTRA ANAK BERKAH
    -- Akta Pendirian No. 01 (05/09/2019) Notaris Untung Sugiyarto, S.H., M.Kn.
    -- NPWP: 92.794.556.8-515.000 (NPWP16: 0927945568515000)
    (
        'PT_PUTRA_ANAK_BERKAH',
        'PT PUTRA ANAK BERKAH',
        'Kp. Bogorame RT 002 / RW 001, Kelurahan Mangunjiwan, Kecamatan Demak, Kabupaten Demak, Jawa Tengah',
        'Demak',
        '0927945568515000',
        '01',
        '05/09/2019',
        '33',
        '4'
    ),

    -- 7. Folder: PT FATEH
    -- Akta Pendirian No. 05 (24/02/2023) Notaris Fariz Helmy Rasyad, S.H., M.Kn.
    -- Akta Perubahan Terakhir No. 14 (07/01/2025) Notaris Sri Wahyuningsih, S.H., M.Kn.
    -- NPWP: 40.139.958.9-515.000 (NPWP16: 0401399589515000)
    (
        'PT_FATEH',
        'PT FATEH PROPERTY LAND',
        'Jl. Kiyai Palembang Blok 0 No. 138, Kelurahan Bintoro, Kecamatan Demak, Kabupaten Demak, Jawa Tengah',
        'Demak',
        '0401399589515000',
        '05',
        '24/02/2023',
        '33',
        '4'
    )
ON CONFLICT (kode_pt) DO UPDATE SET
    nama         = EXCLUDED.nama,
    alamat       = EXCLUDED.alamat,
    kota         = EXCLUDED.kota,
    npwp         = EXCLUDED.npwp,
    akta         = EXCLUDED.akta,
    tgl_akta     = EXCLUDED.tgl_akta,
    tipe_pemilik = EXCLUDED.tipe_pemilik,
    tipe_usaha   = EXCLUDED.tipe_usaha;


-- =============================================================================
-- 2. INSERT DATA TABEL: pt_persetujuan (Pengurus & Pihak Persetujuan 7 PT)
-- =============================================================================

-- Bersihkan data persetujuan lama khusus untuk ke-7 PT di atas agar tidak duplikat saat dijalankan ulang
DELETE FROM public.pt_persetujuan
WHERE pt_id IN (
    SELECT id FROM public.pt_penjual
    WHERE kode_pt IN (
        'PT_KARYA',
        'PT_NAZURA',
        'PT_RETINDODELTA',
        'PT_JBS',
        'PT_UNTUNG',
        'PT_PUTRA_ANAK_BERKAH',
        'PT_FATEH'
    )
);

-- 2.1. PT KARYA DEVELOPMENT REALTY (PT_KARYA)
INSERT INTO public.pt_persetujuan (pt_id, nik, nama, alamat, tempat_lahir, tgl_lahir, pekerjaan)
VALUES
    -- Direktur (KTP WIRYAWAN.pdf)
    (
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_KARYA'),
        '3172061208800003',
        'WIRYAWAN CHANDRA, ST, MT',
        'Jl. Kelapa Lilin III Blok NG-6/17, RT 017 / RW 012, Kelurahan Pegangsaan Dua, Kecamatan Kelapa Gading, Kota Jakarta Utara',
        'Jakarta',
        '12/08/1980',
        'Karyawan Swasta'
    ),
    -- Komisaris (KTP RANDY.pdf)
    (
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_KARYA'),
        '3374013103880001',
        'RANDY WIJAYA',
        'Bukit Wahid Regency Lili 2 No. 7, RT 003 / RW 011, Kelurahan Manyaran, Kecamatan Semarang Barat, Kota Semarang',
        'Semarang',
        '31/03/1988',
        'Wiraswasta'
    );

-- 2.2. PT NAZURA PUTRI CEMERLANG PROPERTI (PT_NAZURA)
INSERT INTO public.pt_persetujuan (pt_id, nik, nama, alamat, tempat_lahir, tgl_lahir, pekerjaan)
VALUES
    -- Direktur (KTP WIDYHARTO.pdf)
    (
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_NAZURA'),
        '3321112102810002',
        'WIDYHARTO',
        'Perum Permata Asri, RT 002 / RW 008, Kelurahan Mangunjiwan, Kecamatan Demak, Kabupaten Demak',
        'Demak',
        '21/02/1981',
        'Karyawan Swasta'
    ),
    -- Komisaris Utama (KTP SEPTINA SULISTYA NINGRUM.pdf)
    (
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_NAZURA'),
        '3321116309810004',
        'SEPTINA SULISTYANINGRUM',
        'Perum Permata Asri, RT 002 / RW 008, Kelurahan Mangunjiwan, Kecamatan Demak, Kabupaten Demak',
        'Demak',
        '23/09/1981',
        'Pegawai Negeri Sipil (PNS)'
    );
    /* Opsional (Tercantum di Akta sebagai Komisaris, namun tidak ada file KTP terpisah di folder):
    ,(
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_NAZURA'),
        '3321116011000003',
        'NAURA SALSABILA WIDY PUTRI',
        'Perum Permata Asri, RT 002 / RW 008, Kelurahan Mangunjiwan, Kecamatan Demak, Kabupaten Demak',
        'Demak',
        '20/11/2000',
        'Pelajar/Mahasiswa'
    )
    */

-- 2.3. PT RETINDODELTA UTAMA (PT_RETINDODELTA)
INSERT INTO public.pt_persetujuan (pt_id, nik, nama, alamat, tempat_lahir, tgl_lahir, pekerjaan)
VALUES
    -- Direktur Utama (KTP MUHAMMAD RIZKI TITO.pdf)
    (
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_RETINDODELTA'),
        '3674040901860002',
        'MUHAMMAD RIZKI TITO',
        'Jl. Otista Gg. Mandor No. 18, RT 002 / RW 011, Kelurahan Ciputat, Kecamatan Ciputat, Kota Tangerang Selatan',
        'Jakarta',
        '09/01/1986',
        'Karyawan Swasta'
    ),
    -- Direktur 3 (KTP BAMBANG SUWITO.pdf)
    (
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_RETINDODELTA'),
        '6471041907770002',
        'BAMBANG SUWITO WIBOWO',
        'Jl. Graha Fatro 3 Blok B 8, RT 012 / RW 007, Kelurahan Tlogomulyo, Kecamatan Pedurungan, Kota Semarang',
        'Kediri',
        '19/07/1977',
        'Karyawan Swasta'
    );

-- 2.4. PT JAYA BERSAMA STIYA (PT_JBS)
INSERT INTO public.pt_persetujuan (pt_id, nik, nama, alamat, tempat_lahir, tgl_lahir, pekerjaan)
VALUES
    -- Direktur (KTP SULISTIYOWATI.pdf & SULISTIYOWATI TERBARU.pdf)
    (
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_JBS'),
        '3321016210830002',
        'SULISTIYOWATI, SE',
        'Puri Cempaka Asri Blok C-25, RT 007 / RW 009, Kelurahan Meteseh, Kecamatan Tembalang, Kota Semarang',
        'Demak',
        '22/10/1983',
        'Karyawan Swasta'
    ),
    -- Komisaris (Sesuai Akta Perubahan No. 11 Tanggal 21/03/2022)
    (
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_JBS'),
        '3321014502970001',
        'IDA FITRIANINGRUM',
        'Desa Brumbung, RT 003 / RW 004, Desa Brumbung, Kecamatan Mranggen, Kabupaten Demak',
        'Demak',
        '05/02/1997',
        'Pelajar/Mahasiswa'
    );

-- 2.5. PT UNTUNG REZEKI KARYA HUTAMA (PT_UNTUNG)
INSERT INTO public.pt_persetujuan (pt_id, nik, nama, alamat, tempat_lahir, tgl_lahir, pekerjaan)
VALUES
    -- Direktur Utama & Penerima Kuasa Penjualan 40 Unit (KTP RISKI DARU HERMANTO.pdf & Akta Kuasa No. 90 Tanggal 12/12/2025)
    (
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_UNTUNG'),
        '3374060505860007',
        'RISKI DARU HERMANTO',
        'Jl. Murti Raya No. 206, RT 009 / RW 015, Kelurahan Muktiharjo Kidul, Kecamatan Pedurungan, Kota Semarang',
        'Semarang',
        '05/05/1986',
        'Karyawan Swasta'
    );
    /* Opsional (Pengurus lain di Akta No. 262 & No. 97 yang telah memberi Kuasa Khusus di Akta No. 90, tanpa file KTP terpisah):
    ,(
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_UNTUNG'),
        '3321012510720004',
        'MUJIYONO',
        'Desa Kembangarum, RT 011 / RW 005, Desa Kembangarum, Kecamatan Mranggen, Kabupaten Demak',
        'Demak',
        '25/10/1972',
        'Petani/Pekebun'
    ),
    (
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_UNTUNG'),
        '3374011411860001',
        'IRAWAN EKA FAUZAN',
        'Desa Sokawati, RT 008 / RW 003, Desa Sokawati, Kecamatan Ampelgading, Kabupaten Pemalang',
        'Semarang',
        '14/11/1986',
        'Karyawan Swasta'
    ),
    (
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_UNTUNG'),
        '3321010206680004',
        'SAEROZI',
        'Desa Kembangarum, RT 001 / RW 005, Desa Kembangarum, Kecamatan Mranggen, Kabupaten Demak',
        'Demak',
        '02/06/1968',
        'Karyawan Swasta'
    )
    */

-- 2.6. PT PUTRA ANAK BERKAH (PT_PUTRA_ANAK_BERKAH)
INSERT INTO public.pt_persetujuan (pt_id, nik, nama, alamat, tempat_lahir, tgl_lahir, pekerjaan)
VALUES
    -- Direktur (KTP PERSETUJUAN.pdf)
    (
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_PUTRA_ANAK_BERKAH'),
        '3321063110950001',
        'MAULANA ROHMAN SIDIQ',
        'Desa Kalianyar, RT 001 / RW 003, Desa Kalianyar, Kecamatan Wonosalam, Kabupaten Demak',
        'Demak',
        '31/10/1995',
        'Wiraswasta'
    ),
    -- Komisaris (KTP PERSETUJUAN.pdf)
    (
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_PUTRA_ANAK_BERKAH'),
        '3321064508000005',
        'UMI NURUL SALMA',
        'Desa Kalianyar, RT 001 / RW 003, Desa Kalianyar, Kecamatan Wonosalam, Kabupaten Demak',
        'Demak',
        '05/08/2000',
        'Pelajar/Mahasiswa'
    );

-- 2.7. PT FATEH PROPERTY LAND (PT_FATEH)
INSERT INTO public.pt_persetujuan (pt_id, nik, nama, alamat, tempat_lahir, tgl_lahir, pekerjaan)
VALUES
    -- Direktur Utama (KTP FATEH.pdf)
    (
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_FATEH'),
        '3321111007930001',
        'SHOFANI FATEH MOCHAMAD',
        'Cangkring Rembang, RT 004 / RW 003, Desa Cangkring Rembang, Kecamatan Karanganyar, Kabupaten Demak',
        'Demak',
        '10/07/1993',
        'Wiraswasta'
    ),
    -- Direktur (KTP GLENDI PRABOWO.pdf)
    (
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_FATEH'),
        '3321060901950002',
        'GLENDI PRABOWO',
        'Jl. Salam Indah II No. 26, RT 005 / RW 007, Desa Jogoloyo, Kecamatan Wonosalam, Kabupaten Demak',
        'Demak',
        '09/01/1995',
        'Karyawan Swasta'
    );
    /* Opsional (Komisaris di Akta No. 14 Tahun 2025 & Istri Dirut di KTP FATEH.pdf):
    ,(
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_FATEH'),
        '3321112308950001',
        'HAKIM AULIA TRIADHIYAKSA',
        'Duwet, RT 001 / RW 005, Desa Kadilangu, Kecamatan Demak, Kabupaten Demak',
        'Demak',
        '23/08/1995',
        'Wiraswasta'
    ),
    (
        (SELECT id FROM public.pt_penjual WHERE kode_pt = 'PT_FATEH'),
        '3321096708950003',
        'AFTINA FAIL AGUSTINA, S.PD',
        'Cangkring Rembang, RT 004 / RW 003, Desa Cangkring Rembang, Kecamatan Karanganyar, Kabupaten Demak',
        'Demak',
        '27/08/1995',
        'Karyawan BUMD'
    )
    */

COMMIT;
