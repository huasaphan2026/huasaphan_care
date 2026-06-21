function setLoginStatus(element, message, type = "info") {
  if (!element) {
    return;
  }

  element.hidden = !message;
  element.textContent = message;
  element.dataset.type = type;
}

function setFieldError(field, errorElement, message) {
  if (!field || !errorElement) {
    return;
  }

  errorElement.textContent = message;
  field.setAttribute("aria-invalid", message ? "true" : "false");
}

function setLoading(button, isLoading) {
  if (!button) {
    return;
  }

  button.disabled = isLoading;
  button.textContent = isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ";
}

function validateLoginForm(usernameInput, passwordInput, usernameError, passwordError) {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  let isValid = true;

  setFieldError(usernameInput, usernameError, "");
  setFieldError(passwordInput, passwordError, "");

  if (!username) {
    setFieldError(usernameInput, usernameError, "กรุณากรอกชื่อผู้ใช้");
    isValid = false;
  }

  if (!password) {
    setFieldError(passwordInput, passwordError, "กรุณากรอกรหัสผ่าน");
    isValid = false;
  }

  return {
    isValid,
    username,
    password,
  };
}

async function submitLogin({ username, password }) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  let result = null;

  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok || !result || result.ok !== true) {
    throw new Error("LOGIN_FAILED");
  }

  return result;
}

function getSafeReturnPath() {
  const fallbackPath = "/admin/dashboard.html";
  const params = new URLSearchParams(window.location.search);
  const returnPath = params.get("return") || "";
  let returnUrl;

  if (!returnPath || returnPath.includes("\\")) {
    return fallbackPath;
  }

  try {
    returnUrl = new URL(returnPath, window.location.origin);
  } catch {
    return fallbackPath;
  }

  const normalizedPathname =
    returnUrl.pathname !== "/" && returnUrl.pathname.endsWith("/")
      ? returnUrl.pathname.slice(0, -1)
      : returnUrl.pathname;

  if (
    returnUrl.origin !== window.location.origin ||
    returnUrl.username ||
    returnUrl.password ||
    !returnUrl.pathname.startsWith("/admin/") ||
    normalizedPathname === "/admin/login" ||
    normalizedPathname === "/admin/login.html"
  ) {
    return fallbackPath;
  }

  return returnUrl.pathname + returnUrl.search;
}

function initAdminLogin() {
  const form = document.querySelector("#admin-login-form");

  if (!form) {
    return;
  }

  const usernameInput = form.querySelector("#username");
  const passwordInput = form.querySelector("#password");
  const usernameError = form.querySelector("#username-error");
  const passwordError = form.querySelector("#password-error");
  const statusElement = form.querySelector("#login-status");
  const submitButton = form.querySelector("#login-button");
  let isSubmitting = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setLoginStatus(statusElement, "");

    const formData = validateLoginForm(
      usernameInput,
      passwordInput,
      usernameError,
      passwordError
    );

    if (!formData.isValid) {
      setLoginStatus(statusElement, "กรุณากรอกข้อมูลให้ครบถ้วน", "error");
      return;
    }

    isSubmitting = true;
    setLoading(submitButton, true);
    setLoginStatus(statusElement, "กำลังเข้าสู่ระบบ...", "info");

    try {
      await submitLogin({
        username: formData.username,
        password: formData.password,
      });

      window.location.assign(getSafeReturnPath());
    } catch {
      setLoginStatus(
        statusElement,
        "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง",
        "error"
      );
      passwordInput.value = "";
      passwordInput.focus();
    } finally {
      isSubmitting = false;
      setLoading(submitButton, false);
    }
  });
}

document.addEventListener("DOMContentLoaded", initAdminLogin);
