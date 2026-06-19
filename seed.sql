PRAGMA foreign_keys = ON;

INSERT INTO categories (code, name, description, default_priority, active, sort_order) VALUES
('electric', 'ไฟฟ้า / ไฟทาง', 'ไฟทางเสีย ไฟกะพริบ จุดมืด เสาไฟมีปัญหา', 'normal', 1, 1),
('road', 'ถนน / ทางเดิน', 'ถนนชำรุด หลุมบ่อ ทางเดินเสีย ป้ายจราจร', 'normal', 1, 2),
('water', 'น้ำ / ท่อระบายน้ำ', 'น้ำประปาไม่ไหล ท่ออุดตัน น้ำท่วมขัง', 'normal', 1, 3),
('waste', 'ขยะ / ความสะอาด', 'ขยะตกค้าง จุดทิ้งขยะ กลิ่นเหม็น สิ่งสกปรก', 'normal', 1, 4),
('safety', 'ความปลอดภัย', 'จุดเสี่ยง อุบัติเหตุ สิ่งกีดขวาง เหตุเสี่ยงในชุมชน', 'urgent', 1, 5),
('nuisance', 'เหตุรำคาญ', 'เสียงดัง กลิ่น ควัน สัตว์รบกวน ความเดือดร้อนทั่วไป', 'normal', 1, 6),
('health', 'สุขภาพ / ผู้เปราะบาง', 'ผู้สูงอายุ ผู้ป่วย ผู้พิการ ผู้ต้องการความช่วยเหลือ', 'urgent', 1, 7),
('suggestion', 'ข้อเสนอแนะ', 'ข้อเสนอเพื่อพัฒนาหมู่บ้าน กิจกรรม หรือบริการชุมชน', 'normal', 1, 8)
ON CONFLICT(code) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  default_priority = excluded.default_priority,
  active = excluded.active,
  sort_order = excluded.sort_order;

INSERT INTO settings (key, value) VALUES
('app_name', 'Hua Saphan Care'),
('app_url', 'https://huasaphan-care.pages.dev'),
('project_email', 'huasaphan2026@gmail.com'),
('emergency_phone', '0629617942'),
('max_public_images_per_report', '3'),
('max_total_images_per_report', '5'),
('image_max_original_mb', '8'),
('image_max_width_px', '1280'),
('image_target_kb', '500'),
('data_retention_years', '3'),
('public_resolved_default', 'false')
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = CURRENT_TIMESTAMP;
