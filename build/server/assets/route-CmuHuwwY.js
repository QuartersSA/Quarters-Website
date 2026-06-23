async function GET() {
  return Response.json({
    status: "ok",
    timezone: "Asia/Riyadh",
    checkedAt: new Date().toISOString()
  }, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export { GET };
