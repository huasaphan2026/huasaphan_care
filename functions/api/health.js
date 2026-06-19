export function onRequestGet() {
  return Response.json(
    {
      ok: true,
      data: {
        app: "Hua Saphan Care",
        status: "ok",
        time: new Date().toISOString(),
      },
      message: "success",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
