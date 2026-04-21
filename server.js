// UI FIX PATCH
// Replace your .book-image CSS with this:

.book-image{
  height:220px;
  background:#ffffff;
  border-radius:18px;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
  padding:14px;
  box-shadow: inset 0 0 0 1px #eef2f7;
}

.book-image img{
  max-width:100%;
  max-height:100%;
  width:auto;
  height:auto;
  object-fit:contain;
  display:block;
  background:#ffffff;
  border-radius:12px;
  box-shadow:
    0 14px 30px rgba(15,23,42,.18),
    0 4px 10px rgba(15,23,42,.08);
  transform: translateY(-2px);
}
