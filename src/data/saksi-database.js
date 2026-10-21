/**
 * Database Pihak Saksi.
 * Data sensitif (NIK, Alamat, Tanggal Lahir, dsb) telah dimigrasi ke Supabase Cloud Database.
 * Objek ini diisi secara dinamis dari endpoint backend: http://127.0.0.1:3001/api/saksi-database
 */
PPAT.saksiDatabase = PPAT.saksiDatabase || [];
