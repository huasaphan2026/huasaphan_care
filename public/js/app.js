async function checkHealth() {
  const statusElement = document.querySelector("#health-status");

  if (!statusElement) {
    return;
  }

  try {
    const response = await fetch("/api/health", {
      headers: { Accept: "application/json" },
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error("Health check failed");
    }

    statusElement.textContent = "API พร้อมใช้งาน";
  } catch {
    statusElement.textContent =
      "ยังไม่สามารถตรวจสอบ API ได้ หากเปิดไฟล์โดยตรงให้ทดสอบผ่าน Wrangler";
  }
}

document.addEventListener("DOMContentLoaded", checkHealth);
