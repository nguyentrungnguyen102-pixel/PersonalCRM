// Chuẩn hoá chuỗi tiếng Việt về dạng không dấu, chữ thường — dùng để so khớp
// tìm kiếm phía client với cột search_text (Postgres unaccent) ở phía server.
export function vnNormalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .trim()
}
