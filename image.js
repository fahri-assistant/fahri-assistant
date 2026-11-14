const isConfigured = (value) => {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    !/PASTE_|ISI_|masukkan_/i.test(value)
  );
};

function statusReason(code) {
  const reasons = {
    400: "Parameter atau model tidak sesuai.",
    401: "API key ditolak.",
    402: "Kredit atau billing diperlukan.",
    403: "Akses ditolak.",
    404: "Model atau endpoint tidak ditemukan.",
    429: "Kuota atau batas permintaan tercapai.",
  };
  return (
    reasons[code] ||
    (code >= 500
      ? "Server penyedia bermasalah."
      : "Permintaan ditolak penyedia.")
  );
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metode tidak diizinkan." });
  }

  let body = req.body;
  // Di Vercel, body kadang masih string, kadang udah object
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return res.status(400).json({ error: "JSON permintaan tidak valid." });
    }
  }
  if (!body || typeof body !== "object") body = {};

  const { prompt } = body;

  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 1500) {
    return res.status(400).json({
      error: "Deskripsi gambar wajib diisi, maksimal 1500 karakter."
    });
  }

  if (
    !isConfigured(process.env.POLLINATIONS_API_KEY) ||
    !isConfigured(process.env.POLLINATIONS_IMAGE_MODEL)
  ) {
    return res.status(503).json({
      error: "Gambar belum dikonfigurasi. Tambahkan POLLINATIONS_API_KEY dan POLLINATIONS_IMAGE_MODEL di Vercel."
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const url = new URL(
      "https://gen.pollinations.ai/image/" +
        encodeURIComponent(prompt.trim())
    );

    url.searchParams.set("model", process.env.POLLINATIONS_IMAGE_MODEL);
    url.searchParams.set("width", "1024");
    url.searchParams.set("height", "1024");
    url.searchParams.set("seed", String(Math.floor(Math.random() * 1000000)));

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      await response.body?.cancel();
      return res.status(502).json({
        error: `Pollinations: ${statusReason(response.status)} (HTTP ${response.status})`
      });
    }

    const mimeType = (response.headers.get("content-type") || "")
      .split(";")[0]
      .toLowerCase();

    if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
      await response.body?.cancel();
      return res.status(502).json({
        error: "Penyedia tidak mengembalikan gambar PNG, JPEG, atau WebP."
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length > 12 * 1024 * 1024) {
      return res.status(502).json({
        error: "Gambar melebihi batas 12 MB."
      });
    }

    return res.status(200).json({
      mime: mimeType,
      image: `data:${mimeType};base64,` + buffer.toString("base64"),
    });
  } catch {
    return res.status(502).json({
      error: controller.signal.aborted
        ? "Pembuatan gambar melewati batas waktu."
        : "Gagal menghubungi penyedia gambar."
    });
  } finally {
    clearTimeout(timeout);
  }
}