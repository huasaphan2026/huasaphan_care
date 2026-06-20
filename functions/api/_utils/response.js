const DEFAULT_HEADERS = {
  "Cache-Control": "no-store",
};

export function jsonOk(data = {}, message = "success", status = 200) {
  return Response.json(
    {
      ok: true,
      data,
      message,
    },
    {
      status,
      headers: DEFAULT_HEADERS,
    }
  );
}

export function jsonError(code, message, status = 500) {
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    {
      status,
      headers: DEFAULT_HEADERS,
    }
  );
}
