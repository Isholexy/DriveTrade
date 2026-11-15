// ============================================================================
// api.js - everything that talks to the Django backend lives here
// ============================================================================

// Where the backend runs. When the site goes online, this changes in one place.
// Any trailing slash is removed so URLs never end up with "//".
const RAW_API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
export const API_URL = RAW_API_URL.replace(/\/+$/, "");

// Makes a photo path work whether the backend sent a full URL or just /media/...
export const mediaUrl = (path) => {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
};

// Shown when a car has no photo yet
export const NO_PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='900'><rect width='100%' height='100%' fill='#e7e2d9'/><text x='50%' y='50%' fill='#6b665e' font-family='sans-serif' font-size='42' text-anchor='middle'>No photo yet</text></svg>",
)}`;

// ---------- Login token (kept in the browser so a refresh doesn't log out) ----------
const TOKEN_KEY = "drivetrade_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// An error that carries whatever the backend said went wrong
export class ApiError extends Error {
  constructor(status, data) {
    super(`Request failed with status ${status}`);
    this.status = status;
    this.data = data;
  }
}

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = {};
  if (auth) headers.Authorization = `Token ${getToken()}`;

  let payload;
  if (body instanceof FormData) {
    payload = body; // the browser sets the right Content-Type for files
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: payload,
  });
  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

// Turns an error into a list of plain sentences to show on screen
export function describeError(error) {
  if (!(error instanceof ApiError)) {
    return ["Couldn't reach the server. Check your connection and try again."];
  }
  const data = error.data;
  if (!data || typeof data !== "object") {
    return ["Something went wrong. Please try again."];
  }
  if (data.detail) return [data.detail];
  return Object.entries(data).map(([field, messages]) => {
    const text = [].concat(messages).join(" ");
    if (field === "non_field_errors") return text;
    return `${field.replace(/_/g, " ")}: ${text}`;
  });
}

// ---------- Public (what buyers see) ----------
export const fetchSeller = (slug) => request(`/sellers/${slug}/`);
export const fetchCars = (slug) => request(`/sellers/${slug}/cars/`);
export const fetchSold = (slug) => request(`/sellers/${slug}/sold/`);

// The link dealers share. Chat apps read the car's photo, name and price from
// it, then people are sent on to the car's page on the website.
export const shareUrl = (slug, stockNumber) =>
  `${API_URL}/share/${slug}/${encodeURIComponent(stockNumber)}/`;

// ---------- Login ----------
export const login = (username, password) =>
  request("/auth/login/", { method: "POST", body: { username, password } });
export const logout = () =>
  request("/auth/logout/", { method: "POST", auth: true });
export const changePassword = (current_password, new_password) =>
  request("/auth/change-password/", {
    method: "POST",
    body: { current_password, new_password },
    auth: true,
  });

// ---------- Dealer dashboard (needs a login) ----------
export const fetchDashboardCars = () =>
  request("/dashboard/cars/", { auth: true });
export const fetchDashboardCar = (id) =>
  request(`/dashboard/cars/${id}/`, { auth: true });
export const createCar = (body) =>
  request("/dashboard/cars/", { method: "POST", body, auth: true });
export const updateCar = (id, body) =>
  request(`/dashboard/cars/${id}/`, { method: "PATCH", body, auth: true });
export const deleteCar = (id) =>
  request(`/dashboard/cars/${id}/`, { method: "DELETE", auth: true });
export const deleteCarPhoto = (carId, photoId) =>
  request(`/dashboard/cars/${carId}/photos/${photoId}/`, {
    method: "DELETE",
    auth: true,
  });
export const fetchReviews = () =>
  request("/dashboard/reviews/", { auth: true });
export const createReview = (body) =>
  request("/dashboard/reviews/", { method: "POST", body, auth: true });
export const deleteReview = (id) =>
  request(`/dashboard/reviews/${id}/`, { method: "DELETE", auth: true });
export const deleteBanner = (id) =>
  request(`/dashboard/banners/${id}/`, { method: "DELETE", auth: true });
export const fetchDashboardSeller = () =>
  request("/dashboard/seller/", { auth: true });
export const updateDashboardSeller = (body) =>
  request("/dashboard/seller/", { method: "PATCH", body, auth: true });

// ---------- Turn backend data into the shape the public pages use ----------
export function normalizeSeller(raw) {
  return {
    name: raw.name,
    tagline: raw.tagline,
    aboutLead: raw.about,
    email: raw.email,
    phone: raw.phone,
    whatsapp: raw.whatsapp,
    address: raw.address,
    hours: raw.hours,
    currencySymbol: raw.currency_symbol,
    distanceUnit: raw.distance_unit,
    logo: mediaUrl(raw.logo),
    headline: raw.headline,
    intro: raw.intro,
    banners: (raw.banners || []).map((banner) => mediaUrl(banner.image)),
    instagram: (raw.instagram || "").replace(/^@/, "").trim(),
    website: raw.website,
    mapQuery: raw.map_query,
    reviews: raw.reviews || [],
    // Typed in the admin as "Toyota, Honda, BMW"
    brands: (raw.brands || "")
      .split(",")
      .map((brand) => brand.trim())
      .filter(Boolean),
  };
}

export function normalizeSold(raw) {
  return {
    id: raw.id,
    name: `${raw.year} ${raw.make} ${raw.model}`,
    image: mediaUrl(raw.image) || NO_PHOTO,
  };
}

export function normalizeCar(raw, distanceUnit = "mi") {
  // The main photo first, then the extra photos
  const photos = [raw.image, ...(raw.photos || []).map((photo) => photo.image)]
    .filter(Boolean)
    .map(mediaUrl);

  return {
    // The pages use the stock number as the car's id. The database id is kept
    // as dbId for the dashboard.
    id: raw.stock_number,
    dbId: raw.id,
    make: raw.make,
    model: raw.model,
    year: raw.year,
    condition: raw.condition,
    mileage: `${raw.mileage.toLocaleString()} ${distanceUnit}`,
    engine: raw.engine,
    hp: raw.horsepower ? `${raw.horsepower} HP` : "",
    drive: raw.drive,
    transmission: raw.transmission,
    fuel: raw.fuel,
    location: raw.location,
    image: photos[0] || NO_PHOTO,
    images: photos.length ? photos : [NO_PHOTO],
    vin: raw.vin || "",
    // The backend sends prices as text such as "74900.00"
    price: Number(raw.price),
    isNegotiable: raw.is_negotiable,
    status: raw.status,
    isFeatured: raw.is_featured,
  };
}
