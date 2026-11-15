// ============================================================================
// DASHBOARD - the dealer's private area
// Login, overview, inventory (add / edit / delete cars) and business details.
// ============================================================================

import React, { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import {
  Car,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Lock,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  X,
} from "lucide-react";

import "./dashboard.css";
import {
  NO_PHOTO,
  changePassword,
  clearToken,
  createCar,
  createReview,
  deleteBanner,
  deleteCar,
  deleteCarPhoto,
  deleteReview,
  describeError,
  fetchDashboardCar,
  fetchDashboardCars,
  fetchDashboardSeller,
  fetchReviews,
  getToken,
  login,
  logout,
  setToken,
  updateCar,
  updateDashboardSeller,
} from "../api";

// "light" or "dark", same idea as in App.jsx
const THEME = "light";

// Your own WhatsApp number (digits only, with the country code). Dealers who
// forget their password can message you to get it reset. Leave empty to show
// a plain sentence instead.
const SUPPORT_WHATSAPP = "";

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
];

const CONDITION_OPTIONS = [
  { value: "Brand New", label: "Brand new" },
  { value: "Certified", label: "Certified pre-owned" },
  { value: "Pre-Owned", label: "Pre-owned" },
];

// How many extra photos one car can have (the backend enforces this too)
const MAX_EXTRA_PHOTOS = 15;

// How many banner photos the home page can have (the backend enforces this too)
const MAX_BANNERS = 6;

const EMPTY_CAR = {
  stock_number: "",
  vin: "",
  make: "",
  model: "",
  year: "",
  condition: "Pre-Owned",
  mileage: "",
  engine: "",
  horsepower: "",
  drive: "",
  transmission: "",
  fuel: "",
  location: "",
  price: "",
  min_price: "",
  is_negotiable: false,
  status: "available",
  is_featured: false,
};

const SETTINGS_FIELDS = [
  "name",
  "tagline",
  "headline",
  "intro",
  "about",
  "email",
  "phone",
  "whatsapp",
  "address",
  "hours",
  "instagram",
  "website",
  "map_query",
  "currency_symbol",
  "distance_unit",
  "brands",
];

// ----------------------------------------------------------------------------
// SMALL HELPERS AND PIECES
// ----------------------------------------------------------------------------

// If the login has expired, send the dealer back to the login page
function sessionExpired(error, navigate) {
  if (error && error.status === 401) {
    clearToken();
    navigate("/login", { replace: true });
    return true;
  }
  return false;
}

const carName = (car) => `${car.year} ${car.make} ${car.model}`;

// The photo shown in lists: the main photo, or the first extra one
const coverOf = (car) => car.image || car.photos?.[0]?.image || NO_PHOTO;

const money = (seller, amount) =>
  `${seller?.currency_symbol ?? ""}${Number(amount).toLocaleString()}`;

function Alert({ messages }) {
  if (!messages.length) return null;
  return (
    <div className="dash-alert" role="alert">
      {messages.map((message, index) => (
        <p key={index}>{message}</p>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const option = STATUS_OPTIONS.find((item) => item.value === status);
  return (
    <span className={`dash-badge badge-${status}`}>
      {option ? option.label : status}
    </span>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="dash-field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="dash-hint">{hint}</span>}
    </label>
  );
}

function Check({ label, checked, onChange }) {
  return (
    <label className="dash-check">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

// ----------------------------------------------------------------------------
// LOGIN
// ----------------------------------------------------------------------------
export function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  if (getToken()) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setErrors([]);
    try {
      const data = await login(username, password);
      setToken(data.token);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErrors(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app login-wrap" data-theme={THEME}>
      <div className="login-card">
        <p className="eyebrow">Dealer area</p>
        <h1 className="display">Log in</h1>
        <p className="login-lead">Manage your cars and business details.</p>

        <Alert messages={errors} />

        <form className="form" onSubmit={handleSubmit}>
          <Field label="Username">
            <input
              className="input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </Field>
          <Field label="Password">
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          <button
            className="btn btn-primary btn-lg"
            type="submit"
            disabled={busy}
          >
            {busy ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="login-forgot">
          Forgot your password?{" "}
          {SUPPORT_WHATSAPP ? (
            <a
              href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent("Hi, I forgot my dashboard password.")}`}
              target="_blank"
              rel="noreferrer"
            >
              Message us on WhatsApp
            </a>
          ) : (
            "Ask the person who set up your website to reset it."
          )}
        </p>

        <Link className="login-back" to="/">
          Back to the website
        </Link>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// LAYOUT: sidebar + the page that is currently open
// ----------------------------------------------------------------------------
const navClass = ({ isActive }) => `dash-nav-link${isActive ? " active" : ""}`;

export function DashboardLayout() {
  const navigate = useNavigate();
  const [seller, setSeller] = useState(null);

  useEffect(() => {
    if (!getToken()) return;
    fetchDashboardSeller()
      .then(setSeller)
      .catch((error) => sessionExpired(error, navigate));
  }, [navigate]);

  if (!getToken()) return <Navigate to="/login" replace />;

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // The login may already have expired. Either way, we log out here.
    }
    clearToken();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app dash" data-theme={THEME}>
      <aside className="dash-side">
        <p className="dash-brand">{seller?.name || "Dashboard"}</p>

        <nav className="dash-nav">
          <NavLink to="/dashboard" end className={navClass}>
            <LayoutDashboard size={18} /> Overview
          </NavLink>
          <NavLink to="/dashboard/cars" className={navClass}>
            <Car size={18} /> Inventory
          </NavLink>
          <NavLink to="/dashboard/settings" className={navClass}>
            <Settings size={18} /> Business details
          </NavLink>
          <NavLink to="/dashboard/reviews" className={navClass}>
            <Star size={18} /> Reviews
          </NavLink>
          <NavLink to="/dashboard/account" className={navClass}>
            <Lock size={18} /> Account
          </NavLink>
        </nav>

        <div className="dash-side-foot">
          <a className="dash-link" href="/" target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> View website
          </a>
          <button className="dash-link" onClick={handleLogout}>
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      <main className="dash-main">
        <Outlet context={{ seller, setSeller }} />
      </main>
    </div>
  );
}

// ----------------------------------------------------------------------------
// OVERVIEW
// ----------------------------------------------------------------------------
export function Overview() {
  const navigate = useNavigate();
  const { seller } = useOutletContext();
  const [cars, setCars] = useState(null);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    fetchDashboardCars()
      .then(setCars)
      .catch((error) => {
        if (!sessionExpired(error, navigate)) setErrors(describeError(error));
      });
  }, [navigate]);

  const count = (status) =>
    (cars || []).filter((car) => car.status === status).length;

  const stats = [
    { label: "Total cars", value: cars ? cars.length : "-" },
    { label: "Available", value: cars ? count("available") : "-" },
    { label: "Reserved", value: cars ? count("reserved") : "-" },
    { label: "Sold", value: cars ? count("sold") : "-" },
  ];

  return (
    <>
      <div className="dash-head">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Welcome back{seller ? `, ${seller.name}` : ""}</h1>
        </div>
        <Link className="btn btn-primary" to="/dashboard/cars/new">
          <Plus size={16} /> Add a car
        </Link>
      </div>

      <Alert messages={errors} />

      <div className="dash-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="dash-stat">
            <p className="field-label">{stat.label}</p>
            <p className="dash-stat-value">{stat.value}</p>
          </div>
        ))}
      </div>

      <section className="dash-card">
        <div className="dash-card-head">
          <h2>Recently added</h2>
          <Link className="link-arrow" to="/dashboard/cars">
            View all cars
          </Link>
        </div>

        {cars && cars.length === 0 && (
          <div className="empty">
            <p>You haven't added any cars yet.</p>
            <Link className="btn btn-primary" to="/dashboard/cars/new">
              Add your first car
            </Link>
          </div>
        )}

        {cars && cars.length > 0 && (
          <ul className="dash-list">
            {cars.slice(0, 5).map((car) => (
              <li key={car.id}>
                <div className="dash-car">
                  <img src={coverOf(car)} alt="" />
                  <div>
                    <p className="dash-car-name">{carName(car)}</p>
                    <p className="dash-car-sub">{money(seller, car.price)}</p>
                  </div>
                </div>
                <StatusBadge status={car.status} />
                <Link
                  className="btn btn-outline"
                  to={`/dashboard/cars/${car.id}`}
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// ----------------------------------------------------------------------------
// INVENTORY: the list of all the dealer's cars
// ----------------------------------------------------------------------------
export function CarsPage() {
  const navigate = useNavigate();
  const { seller } = useOutletContext();
  const [cars, setCars] = useState(null);
  const [errors, setErrors] = useState([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchDashboardCars()
      .then(setCars)
      .catch((error) => {
        if (!sessionExpired(error, navigate)) setErrors(describeError(error));
      });
  }, [navigate]);

  const changeStatus = async (car, status) => {
    setErrors([]);
    try {
      const updated = await updateCar(car.id, { status });
      setCars((prev) =>
        prev.map((item) => (item.id === car.id ? updated : item)),
      );
    } catch (error) {
      if (!sessionExpired(error, navigate)) setErrors(describeError(error));
    }
  };

  const removeCar = async (car) => {
    if (!window.confirm(`Delete the ${carName(car)}? This can't be undone.`)) {
      return;
    }
    setErrors([]);
    try {
      await deleteCar(car.id);
      setCars((prev) => prev.filter((item) => item.id !== car.id));
    } catch (error) {
      if (!sessionExpired(error, navigate)) setErrors(describeError(error));
    }
  };

  const all = cars || [];
  const countOf = (status) =>
    status === "all"
      ? all.length
      : all.filter((c) => c.status === status).length;

  const visible = all.filter((car) => {
    const matchesStatus = filter === "all" || car.status === filter;
    const text = `${car.make} ${car.model} ${car.stock_number}`.toLowerCase();
    return matchesStatus && text.includes(query.toLowerCase());
  });

  const tabs = [{ value: "all", label: "All" }, ...STATUS_OPTIONS];

  return (
    <>
      <div className="dash-head">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1>Your cars</h1>
        </div>
        <Link className="btn btn-primary" to="/dashboard/cars/new">
          <Plus size={16} /> Add a car
        </Link>
      </div>

      <Alert messages={errors} />

      <div className="dash-toolbar">
        <div className="dash-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              className={`dash-tab${filter === tab.value ? " active" : ""}`}
              onClick={() => setFilter(tab.value)}
            >
              {tab.label} ({countOf(tab.value)})
            </button>
          ))}
        </div>
        <div className="search-wrap dash-search">
          <Search size={15} className="search-icon" />
          <input
            className="input"
            placeholder="Search by make, model or stock number"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      {cars === null && errors.length === 0 && (
        <p className="dash-muted">Loading your cars...</p>
      )}

      {cars !== null && all.length === 0 && (
        <div className="empty">
          <p>You haven't added any cars yet.</p>
          <Link className="btn btn-primary" to="/dashboard/cars/new">
            Add your first car
          </Link>
        </div>
      )}

      {cars !== null && all.length > 0 && visible.length === 0 && (
        <div className="empty">
          <p>No cars match your search.</p>
        </div>
      )}

      {visible.length > 0 && (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Car</th>
                <th>Price</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visible.map((car) => (
                <tr key={car.id}>
                  <td>
                    <div className="dash-car">
                      <img src={coverOf(car)} alt="" />
                      <div>
                        <p className="dash-car-name">{carName(car)}</p>
                        <p className="dash-car-sub">
                          {car.stock_number}
                          {car.is_featured ? " · Featured" : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>{money(seller, car.price)}</td>
                  <td>
                    <select
                      className="input dash-status"
                      value={car.status}
                      aria-label={`Status of the ${carName(car)}`}
                      onChange={(event) =>
                        changeStatus(car, event.target.value)
                      }
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="dash-actions">
                      <Link
                        className="btn btn-outline"
                        to={`/dashboard/cars/${car.id}`}
                      >
                        Edit
                      </Link>
                      <Link
                        className="btn btn-outline"
                        to={`/dashboard/cars/${car.id}/flyer`}
                      >
                        Flyer
                      </Link>
                      <button
                        className="icon-btn"
                        aria-label={`Delete the ${carName(car)}`}
                        onClick={() => removeCar(car)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ----------------------------------------------------------------------------
// ADD / EDIT A CAR
// ----------------------------------------------------------------------------
export function CarFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { seller } = useOutletContext();

  const [form, setForm] = useState(EMPTY_CAR);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [existingPhotos, setExistingPhotos] = useState([]); // saved extra photos
  const [pendingPhotos, setPendingPhotos] = useState([]); // chosen, not saved yet
  const [photoNotice, setPhotoNotice] = useState("");

  // When editing, load the car and fill in the form
  useEffect(() => {
    if (!isEdit) return;
    fetchDashboardCar(id)
      .then((car) => {
        const next = { ...EMPTY_CAR };
        Object.keys(EMPTY_CAR).forEach((key) => {
          next[key] = car[key] ?? EMPTY_CAR[key];
        });
        setForm(next);
        setPhotoUrl(car.image || "");
        setExistingPhotos(car.photos || []);
        setLoading(false);
      })
      .catch((error) => {
        if (!sessionExpired(error, navigate)) {
          setErrors(describeError(error));
          setLoading(false);
        }
      });
  }, [id, isEdit, navigate]);

  const set = (name) => (event) =>
    setForm((prev) => ({ ...prev, [name]: event.target.value }));

  const setCheck = (name) => (event) =>
    setForm((prev) => ({ ...prev, [name]: event.target.checked }));

  const handlePhoto = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoUrl(URL.createObjectURL(file));
  };

  const extraCount = existingPhotos.length + pendingPhotos.length;

  const handleExtraPhotos = (event) => {
    const files = Array.from(event.target.files);
    event.target.value = ""; // lets the same file be chosen again
    const room = Math.max(MAX_EXTRA_PHOTOS - extraCount, 0);
    setPhotoNotice(
      files.length > room
        ? `A car can have up to ${MAX_EXTRA_PHOTOS} extra photos. Only the first ${room} you chose were added.`
        : "",
    );
    const added = files
      .slice(0, room)
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPendingPhotos((prev) => [...prev, ...added]);
  };

  const removePending = (index) =>
    setPendingPhotos((prev) => prev.filter((_, i) => i !== index));

  const removeExisting = async (photo) => {
    if (!window.confirm("Remove this photo from the car?")) return;
    setErrors([]);
    try {
      await deleteCarPhoto(id, photo.id);
      setExistingPhotos((prev) => prev.filter((item) => item.id !== photo.id));
    } catch (error) {
      if (!sessionExpired(error, navigate)) setErrors(describeError(error));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors([]);

    const data = new FormData();
    Object.entries(form).forEach(([key, value]) =>
      data.append(key, String(value)),
    );
    if (photoFile) data.append("image", photoFile);
    pendingPhotos.forEach((item) => data.append("uploaded_photos", item.file));

    try {
      if (isEdit) await updateCar(id, data);
      else await createCar(data);
      navigate("/dashboard/cars");
    } catch (error) {
      if (!sessionExpired(error, navigate)) {
        setErrors(describeError(error));
        window.scrollTo(0, 0);
      }
    } finally {
      setSaving(false);
    }
  };

  const unit = seller?.distance_unit || "mi";
  const currency = seller?.currency_symbol || "";

  if (loading) return <p className="dash-muted">Loading the car...</p>;

  return (
    <>
      <div className="dash-head">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1>{isEdit ? "Edit car" : "Add a car"}</h1>
        </div>
        <div className="dash-head-actions">
          {isEdit && (
            <Link
              className="btn btn-outline"
              to={`/dashboard/cars/${id}/flyer`}
            >
              Create flyer
            </Link>
          )}
          <Link className="btn btn-outline" to="/dashboard/cars">
            Back to inventory
          </Link>
        </div>
      </div>

      <Alert messages={errors} />

      <form className="dash-form" onSubmit={handleSubmit}>
        <section className="dash-card">
          <h2>Basics</h2>
          <div className="dash-grid">
            <Field
              label="Stock number"
              hint="Your own code for this car. It must be different for every car."
            >
              <input
                className="input"
                value={form.stock_number}
                onChange={set("stock_number")}
                placeholder="DT-1001"
                required
              />
            </Field>
            <Field
              label="VIN / chassis number"
              hint="Optional. Usually 17 characters. Shown on the car's page if filled in."
            >
              <input
                className="input"
                value={form.vin}
                onChange={set("vin")}
                maxLength={17}
              />
            </Field>
            <Field label="Make" hint="For example Toyota or Mercedes-Benz">
              <input
                className="input"
                value={form.make}
                onChange={set("make")}
                required
              />
            </Field>
            <Field label="Model">
              <input
                className="input"
                value={form.model}
                onChange={set("model")}
                required
              />
            </Field>
            <Field label="Year">
              <input
                className="input"
                type="number"
                min="1950"
                max="2100"
                value={form.year}
                onChange={set("year")}
                required
              />
            </Field>
            <Field label="Condition">
              <select
                className="input"
                value={form.condition}
                onChange={set("condition")}
              >
                {CONDITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Mileage (${unit})`}>
              <input
                className="input"
                type="number"
                min="0"
                value={form.mileage}
                onChange={set("mileage")}
                required
              />
            </Field>
          </div>
        </section>

        <section className="dash-card">
          <h2>Specifications</h2>
          <div className="dash-grid">
            <Field label="Engine" hint="For example 2.5L 4-cylinder">
              <input
                className="input"
                value={form.engine}
                onChange={set("engine")}
              />
            </Field>
            <Field label="Horsepower">
              <input
                className="input"
                type="number"
                min="0"
                value={form.horsepower}
                onChange={set("horsepower")}
              />
            </Field>
            <Field label="Drive" hint="FWD, RWD or AWD">
              <input
                className="input"
                value={form.drive}
                onChange={set("drive")}
              />
            </Field>
            <Field label="Transmission">
              <input
                className="input"
                value={form.transmission}
                onChange={set("transmission")}
              />
            </Field>
            <Field label="Fuel">
              <input
                className="input"
                value={form.fuel}
                onChange={set("fuel")}
              />
            </Field>
            <Field label="Location">
              <input
                className="input"
                value={form.location}
                onChange={set("location")}
              />
            </Field>
          </div>
        </section>

        <section className="dash-card">
          <h2>Price</h2>
          <div className="dash-grid">
            <Field label={`Price ${currency ? `(${currency})` : ""}`}>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={set("price")}
                required
              />
            </Field>
            <Field
              label={`Lowest price you would accept ${currency ? `(${currency})` : ""}`}
              hint="Private. Buyers never see this."
            >
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.min_price}
                onChange={set("min_price")}
              />
            </Field>
          </div>
          <Check
            label="The price is negotiable"
            checked={form.is_negotiable}
            onChange={setCheck("is_negotiable")}
          />
        </section>

        <section className="dash-card">
          <h2>Photos</h2>
          <div className="dash-photo-row">
            <div className="dash-photo">
              {photoUrl ? (
                <img src={photoUrl} alt="Preview of the main photo" />
              ) : (
                <span>No photo yet</span>
              )}
            </div>
            <Field
              label={photoUrl ? "Replace the main photo" : "Main photo"}
              hint="Shown on the cards and first in the gallery. A landscape photo works best."
            >
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={handlePhoto}
              />
            </Field>
          </div>

          <div className="dash-extra">
            <p className="field-label">
              More photos ({extraCount} of {MAX_EXTRA_PHOTOS})
            </p>
            <p className="dash-hint">
              Add the back, sides, interior, dashboard, engine and wheels, so
              buyers can see the whole car.
            </p>

            {extraCount > 0 && (
              <div className="dash-thumbs">
                {existingPhotos.map((photo) => (
                  <div key={photo.id} className="dash-thumb">
                    <img src={photo.image} alt="" />
                    <button
                      type="button"
                      className="dash-thumb-remove"
                      aria-label="Remove this photo"
                      onClick={() => removeExisting(photo)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {pendingPhotos.map((item, index) => (
                  <div key={item.url} className="dash-thumb dash-thumb-new">
                    <img src={item.url} alt="" />
                    <button
                      type="button"
                      className="dash-thumb-remove"
                      aria-label="Remove this photo"
                      onClick={() => removePending(index)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photoNotice && (
              <p className="dash-hint dash-notice">{photoNotice}</p>
            )}

            <Field
              label="Add photos"
              hint="You can choose several at once. New photos (with a colored border) are saved when you save the car."
            >
              <input
                className="input"
                type="file"
                accept="image/*"
                multiple
                onChange={handleExtraPhotos}
                disabled={extraCount >= MAX_EXTRA_PHOTOS}
              />
            </Field>
          </div>
        </section>

        <section className="dash-card">
          <h2>Listing</h2>
          <div className="dash-grid">
            <Field
              label="Status"
              hint="Sold cars are hidden from your website."
            >
              <select
                className="input"
                value={form.status}
                onChange={set("status")}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Check
            label="Show this car in the Featured section on the home page"
            checked={form.is_featured}
            onChange={setCheck("is_featured")}
          />
        </section>

        <div className="dash-form-actions">
          <button
            className="btn btn-primary btn-lg"
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving..." : isEdit ? "Save changes" : "Add car"}
          </button>
          <Link className="btn btn-outline btn-lg" to="/dashboard/cars">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}

// ----------------------------------------------------------------------------
// BUSINESS DETAILS
// ----------------------------------------------------------------------------
export function SettingsPage() {
  const navigate = useNavigate();
  const { setSeller } = useOutletContext();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [removeLogo, setRemoveLogo] = useState(false);
  const [bannersPending, setBannersPending] = useState([]);
  const [bannerNotice, setBannerNotice] = useState("");

  useEffect(() => {
    fetchDashboardSeller()
      .then((data) => {
        setForm(data);
        setLogoPreview(data.logo || "");
      })
      .catch((error) => {
        if (!sessionExpired(error, navigate)) setErrors(describeError(error));
      });
  }, [navigate]);

  const set = (name) => (event) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [name]: event.target.value }));
  };

  const handleLogo = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setSaved(false);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
  };

  const toggleRemoveLogo = (event) => {
    setSaved(false);
    setRemoveLogo(event.target.checked);
    if (event.target.checked) {
      setLogoFile(null);
      setLogoPreview("");
    } else {
      setLogoPreview(form?.logo || "");
    }
  };

  const savedBanners = form?.banners || [];
  const bannerCount = savedBanners.length + bannersPending.length;

  const handleBanners = (event) => {
    const files = Array.from(event.target.files);
    event.target.value = ""; // lets the same file be chosen again
    const room = Math.max(MAX_BANNERS - bannerCount, 0);
    setBannerNotice(
      files.length > room
        ? `The home page can have up to ${MAX_BANNERS} banner photos. Only the first ${room} you chose were added.`
        : "",
    );
    setSaved(false);
    const added = files
      .slice(0, room)
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setBannersPending((prev) => [...prev, ...added]);
  };

  const removePendingBanner = (index) =>
    setBannersPending((prev) => prev.filter((_, i) => i !== index));

  const removeSavedBanner = async (banner) => {
    if (!window.confirm("Remove this banner photo?")) return;
    setErrors([]);
    try {
      await deleteBanner(banner.id);
      setForm((prev) => ({
        ...prev,
        banners: prev.banners.filter((item) => item.id !== banner.id),
      }));
    } catch (error) {
      if (!sessionExpired(error, navigate)) setErrors(describeError(error));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors([]);
    setSaved(false);

    const data = new FormData();
    SETTINGS_FIELDS.forEach((key) => data.append(key, form[key] ?? ""));
    if (logoFile) data.append("logo", logoFile);
    if (removeLogo && !logoFile) data.append("remove_logo", "true");
    bannersPending.forEach((item) =>
      data.append("uploaded_banners", item.file),
    );

    try {
      const updated = await updateDashboardSeller(data);
      setForm(updated);
      setSeller(updated);
      setLogoFile(null);
      setLogoPreview(updated.logo || "");
      setRemoveLogo(false);
      setBannersPending([]);
      setSaved(true);
      window.scrollTo(0, 0);
    } catch (error) {
      if (!sessionExpired(error, navigate)) {
        setErrors(describeError(error));
        window.scrollTo(0, 0);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="dash-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Business details</h1>
        </div>
      </div>

      <Alert messages={errors} />
      {saved && <div className="dash-success">Your details were saved.</div>}

      {form === null && errors.length === 0 && (
        <p className="dash-muted">Loading your details...</p>
      )}

      {form !== null && (
        <form className="dash-form" onSubmit={handleSubmit}>
          <section className="dash-card">
            <h2>Branding</h2>
            <p className="dash-hint dash-intro">
              This is how your website looks to buyers.
            </p>

            <div className="dash-logo-row">
              <div className="dash-logo">
                {logoPreview ? (
                  <img src={logoPreview} alt="Your logo" />
                ) : (
                  <span>No logo yet</span>
                )}
              </div>
              <div>
                <Field
                  label={logoPreview ? "Replace your logo" : "Your logo"}
                  hint="Shown at the top of every page instead of your business name. A PNG with a transparent background looks best."
                >
                  <input
                    className="input"
                    type="file"
                    accept="image/*"
                    onChange={handleLogo}
                  />
                </Field>
                {form.logo && !logoFile && (
                  <Check
                    label="Remove my logo (show my business name instead)"
                    checked={removeLogo}
                    onChange={toggleRemoveLogo}
                  />
                )}
              </div>
            </div>

            <Field
              label="Home page headline"
              hint="The big line at the top of your home page. Leave empty to use your business name."
            >
              <input
                className="input"
                value={form.headline ?? ""}
                onChange={set("headline")}
                maxLength={120}
              />
            </Field>
            <Field
              label="Home page introduction"
              hint="A sentence or two under the headline."
            >
              <textarea
                className="input"
                rows="3"
                value={form.intro ?? ""}
                onChange={set("intro")}
                maxLength={300}
              />
            </Field>

            <div className="dash-extra">
              <p className="field-label">
                Banner photos ({bannerCount} of {MAX_BANNERS})
              </p>
              <p className="dash-hint">
                Wide photos of your showroom or your best cars. They rotate
                behind your headline on the home page. If you add none, sample
                photos are shown instead.
              </p>

              {bannerCount > 0 && (
                <div className="dash-thumbs">
                  {savedBanners.map((banner) => (
                    <div key={banner.id} className="dash-thumb">
                      <img src={banner.image} alt="" />
                      <button
                        type="button"
                        className="dash-thumb-remove"
                        aria-label="Remove this banner photo"
                        onClick={() => removeSavedBanner(banner)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {bannersPending.map((item, index) => (
                    <div key={item.url} className="dash-thumb dash-thumb-new">
                      <img src={item.url} alt="" />
                      <button
                        type="button"
                        className="dash-thumb-remove"
                        aria-label="Remove this banner photo"
                        onClick={() => removePendingBanner(index)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {bannerNotice && (
                <p className="dash-hint dash-notice">{bannerNotice}</p>
              )}

              <Field
                label="Add banner photos"
                hint="You can choose several at once. New photos (with a colored border) are saved when you save."
              >
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleBanners}
                  disabled={bannerCount >= MAX_BANNERS}
                />
              </Field>
            </div>
          </section>

          <section className="dash-card">
            <h2>Your business</h2>
            <div className="dash-grid">
              <Field label="Business name">
                <input
                  className="input"
                  value={form.name ?? ""}
                  onChange={set("name")}
                  required
                />
              </Field>
              <Field label="Tagline" hint="A short line shown in the footer.">
                <input
                  className="input"
                  value={form.tagline ?? ""}
                  onChange={set("tagline")}
                />
              </Field>
            </div>
            <Field
              label="About your business"
              hint="Shown on the About page. A blank line starts a new paragraph."
            >
              <textarea
                className="input"
                rows="6"
                value={form.about ?? ""}
                onChange={set("about")}
              />
            </Field>
            <Field
              label="Brands you sell"
              hint="Separated by commas, for example Toyota, Honda, Mercedes-Benz."
            >
              <input
                className="input"
                value={form.brands ?? ""}
                onChange={set("brands")}
              />
            </Field>
          </section>

          <section className="dash-card">
            <h2>Contact details</h2>
            <div className="dash-grid">
              <Field label="Email">
                <input
                  className="input"
                  type="email"
                  value={form.email ?? ""}
                  onChange={set("email")}
                />
              </Field>
              <Field label="Phone">
                <input
                  className="input"
                  value={form.phone ?? ""}
                  onChange={set("phone")}
                />
              </Field>
              <Field
                label="WhatsApp number"
                hint="Digits only, with the country code, no + or spaces."
              >
                <input
                  className="input"
                  value={form.whatsapp ?? ""}
                  onChange={set("whatsapp")}
                />
              </Field>
              <Field label="Opening hours">
                <input
                  className="input"
                  value={form.hours ?? ""}
                  onChange={set("hours")}
                />
              </Field>
              <Field
                label="Instagram handle"
                hint="For example drivetrade. Shown on your website and share images."
              >
                <input
                  className="input"
                  value={form.instagram ?? ""}
                  onChange={set("instagram")}
                />
              </Field>
              <Field
                label="Website address"
                hint="For example drivetrade.com. Shown on share images."
              >
                <input
                  className="input"
                  value={form.website ?? ""}
                  onChange={set("website")}
                />
              </Field>
            </div>
            <Field label="Address">
              <input
                className="input"
                value={form.address ?? ""}
                onChange={set("address")}
              />
            </Field>
            <Field
              label="Map search (optional)"
              hint="What the map on your Contact page looks for. Leave empty to use your address. If the pin is off, try your business name and area, like Acme Motors, Wuse 2, Abuja."
            >
              <input
                className="input"
                value={form.map_query ?? ""}
                onChange={set("map_query")}
              />
            </Field>
          </section>

          <section className="dash-card">
            <h2>Prices and distance</h2>
            <div className="dash-grid">
              <Field label="Currency symbol" hint="For example $ or ₦">
                <input
                  className="input"
                  value={form.currency_symbol ?? ""}
                  onChange={set("currency_symbol")}
                />
              </Field>
              <Field label="Distance unit">
                <select
                  className="input"
                  value={form.distance_unit ?? "mi"}
                  onChange={set("distance_unit")}
                >
                  <option value="mi">Miles (mi)</option>
                  <option value="km">Kilometres (km)</option>
                </select>
              </Field>
            </div>
          </section>

          <div className="dash-form-actions">
            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

// ----------------------------------------------------------------------------
// ACCOUNT: change password
// ----------------------------------------------------------------------------
export function AccountPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (name) => (event) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors([]);
    setSaved(false);
    if (form.next !== form.confirm) {
      setErrors(["The two new passwords don't match."]);
      return;
    }
    setSaving(true);
    try {
      const data = await changePassword(form.current, form.next);
      setToken(data.token); // the old login stops working, so keep the new one
      setForm({ current: "", next: "", confirm: "" });
      setSaved(true);
    } catch (error) {
      if (!sessionExpired(error, navigate)) setErrors(describeError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="dash-head">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Change your password</h1>
        </div>
      </div>

      <Alert messages={errors} />
      {saved && <div className="dash-success">Your password was changed.</div>}

      <form className="dash-form" onSubmit={handleSubmit}>
        <section className="dash-card">
          <Field label="Current password">
            <input
              className="input"
              type="password"
              value={form.current}
              onChange={set("current")}
              autoComplete="current-password"
              required
            />
          </Field>
          <Field
            label="New password"
            hint="At least 8 characters. Avoid common passwords and all-number passwords."
          >
            <input
              className="input"
              type="password"
              value={form.next}
              onChange={set("next")}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="New password again">
            <input
              className="input"
              type="password"
              value={form.confirm}
              onChange={set("confirm")}
              autoComplete="new-password"
              required
            />
          </Field>
        </section>

        <div className="dash-form-actions">
          <button
            className="btn btn-primary btn-lg"
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving..." : "Change password"}
          </button>
        </div>
      </form>
    </>
  );
}

// ----------------------------------------------------------------------------
// SHARE IMAGE MAKER: a ready-to-post flyer for one car
// ----------------------------------------------------------------------------
const FLYER_WIDTH = 1080;
const FLYER_HEIGHT = 1350;
const SERIF = '"Cormorant Garamond", "Iowan Old Style", Georgia, serif';
const SANS = 'Inter, system-ui, "Segoe UI", sans-serif';

// Photos come from the backend, so they are fetched as data first. That keeps
// the picture usable on the canvas and lets it be saved as an image.
async function loadImage(url) {
  const response = await fetch(url, { mode: "cors", cache: "reload" });
  if (!response.ok) throw new Error("The image could not be loaded.");
  const image = new Image();
  image.src = URL.createObjectURL(await response.blob());
  await image.decode();
  return image;
}

const setSpacing = (ctx, pixels) => {
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${pixels}px`;
};

function fitFont(ctx, text, maxWidth, startSize, weight, family) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > 40) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

function drawCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sw = width / scale;
  const sh = height / scale;
  ctx.drawImage(
    image,
    (image.width - sw) / 2,
    (image.height - sh) / 2,
    sw,
    sh,
    x,
    y,
    width,
    height,
  );
}

function drawFlyer(
  canvas,
  { car, seller, photo, logo, showPrice, showContact },
) {
  canvas.width = FLYER_WIDTH;
  canvas.height = FLYER_HEIGHT;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#faf8f5";
  ctx.fillRect(0, 0, FLYER_WIDTH, FLYER_HEIGHT);

  // Top: the dealer's logo, or his name
  if (logo) {
    const scale = Math.min(76 / logo.height, 380 / logo.width);
    const w = logo.width * scale;
    const h = logo.height * scale;
    ctx.drawImage(logo, 60, 48 + (76 - h) / 2, w, h);
  } else {
    ctx.fillStyle = "#14120f";
    setSpacing(ctx, 8);
    fitFont(ctx, seller.name.toUpperCase(), 960, 46, 500, SERIF);
    ctx.fillText(seller.name.toUpperCase(), 60, 104);
    setSpacing(ctx, 0);
  }

  // The car's photo, with a small condition label
  if (photo) {
    drawCover(ctx, photo, 60, 150, 960, 640);
  } else {
    ctx.fillStyle = "#e7e2d9";
    ctx.fillRect(60, 150, 960, 640);
  }
  const tag =
    car.condition === "Brand New"
      ? "BRAND NEW"
      : car.condition === "Certified"
        ? "CERTIFIED"
        : "PRE-OWNED";
  ctx.font = `600 22px ${SANS}`;
  setSpacing(ctx, 3);
  const tagWidth = ctx.measureText(tag).width;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(88, 178, tagWidth + 40, 48);
  ctx.fillStyle = "#14120f";
  ctx.fillText(tag, 108, 211);
  setSpacing(ctx, 0);

  // Year, make and model
  ctx.fillStyle = "#6b665e";
  ctx.font = `600 26px ${SANS}`;
  setSpacing(ctx, 5);
  ctx.fillText(`${car.year}  ·  ${car.make}`.toUpperCase(), 60, 858);
  setSpacing(ctx, 0);

  ctx.fillStyle = "#14120f";
  const modelSize = fitFont(ctx, car.model, 960, 104, 500, SERIF);
  const modelY = 858 + 30 + modelSize * 0.78;
  ctx.fillText(car.model, 60, modelY);

  // Price
  const priceY = modelY + 84;
  const priceText = showPrice
    ? `${seller.currency_symbol}${Number(car.price).toLocaleString()}`
    : "Message us for the price";
  ctx.fillStyle = "#14120f";
  ctx.font = `600 ${showPrice ? 62 : 40}px ${SANS}`;
  ctx.fillText(priceText, 60, priceY);
  if (showPrice && car.is_negotiable) {
    const priceWidth = ctx.measureText(priceText).width;
    ctx.fillStyle = "#8a6a3b";
    ctx.font = `600 24px ${SANS}`;
    setSpacing(ctx, 4);
    ctx.fillText("NEGOTIABLE", 60 + priceWidth + 28, priceY - 6);
    setSpacing(ctx, 0);
  }

  // Key details
  const details = [
    car.mileage != null
      ? `${Number(car.mileage).toLocaleString()} ${seller.distance_unit}`
      : "",
    car.transmission,
    car.fuel,
    car.drive,
  ]
    .filter(Boolean)
    .join("   ·   ");
  ctx.fillStyle = "#6b665e";
  ctx.font = `400 30px ${SANS}`;
  ctx.fillText(details, 60, priceY + 66);

  // Bottom band: follow our socials, with the number and the website
  if (showContact) {
    ctx.fillStyle = "#14120f";
    ctx.fillRect(0, 1190, FLYER_WIDTH, 160);

    const handle = (seller.instagram || "").replace(/^@/, "").trim();
    const site = (seller.website || "")
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+$/, "")
      .trim();
    const items = [];
    if (handle) items.push({ icon: "instagram", text: `@${handle}` });
    if (seller.whatsapp || seller.phone) {
      items.push({
        icon: "whatsapp",
        text: seller.whatsapp ? `+${seller.whatsapp}` : seller.phone,
      });
    }
    if (site) items.push({ icon: "web", text: site });

    ctx.fillStyle = "#cdbfa9";
    ctx.font = `500 24px ${SANS}`;
    setSpacing(ctx, 4);
    ctx.fillText(
      handle || site ? "FOLLOW OUR SOCIALS" : "MESSAGE US ON WHATSAPP",
      60,
      1246,
    );
    setSpacing(ctx, 0);

    drawContactRow(ctx, items, 1306, 960);
  }
}

// A small line icon for the Instagram, WhatsApp and website items
function drawIcon(ctx, kind, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (kind === "instagram") {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(2, 2, 20, 20, 5);
    else ctx.rect(2, 2, 20, 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(12, 12, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(17.5, 6.5);
    ctx.lineTo(17.51, 6.5);
    ctx.stroke();
  } else if (kind === "whatsapp") {
    ctx.stroke(new Path2D("M7.9 20A9 9 0 1 0 4 16.1L2 22Z"));
  } else {
    ctx.beginPath();
    ctx.arc(12, 12, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.stroke(new Path2D("M2 12h20"));
    ctx.stroke(
      new Path2D(
        "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
      ),
    );
  }
  ctx.restore();
}

// Draws the icons and text on one line. If the website doesn't fit at a
// readable size, it is left out.
function drawContactRow(ctx, allItems, baseline, maxWidth) {
  const iconGap = 14;
  const itemGap = 52;
  const widthAt = (items, size) => {
    ctx.font = `600 ${size}px ${SANS}`;
    return (
      items.reduce(
        (sum, item) => sum + size + iconGap + ctx.measureText(item.text).width,
        0,
      ) +
      itemGap * (items.length - 1)
    );
  };
  const fit = (items) => {
    let size = 40;
    while (size > 30 && widthAt(items, size) > maxWidth) size -= 2;
    return size;
  };

  let items = allItems;
  let size = fit(items);
  if (widthAt(items, size) > maxWidth && items.some((i) => i.icon === "web")) {
    items = items.filter((item) => item.icon !== "web");
    size = fit(items);
  }

  ctx.font = `600 ${size}px ${SANS}`;
  let x = 60;
  items.forEach((item) => {
    drawIcon(ctx, item.icon, x, baseline - size * 0.9, size);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(item.text, x + size + iconGap, baseline);
    x += size + iconGap + ctx.measureText(item.text).width + itemGap;
  });
}

export function FlyerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { seller } = useOutletContext();
  const canvasRef = useRef(null);
  const imageCache = useRef(new Map());

  const [car, setCar] = useState(null);
  const [errors, setErrors] = useState([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showPrice, setShowPrice] = useState(true);
  const [showContact, setShowContact] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchDashboardCar(id)
      .then(setCar)
      .catch((error) => {
        if (!sessionExpired(error, navigate)) setErrors(describeError(error));
      });
  }, [id, navigate]);

  const photos = car
    ? [car.image, ...(car.photos || []).map((photo) => photo.image)].filter(
        Boolean,
      )
    : [];

  // Draw the flyer again whenever something changes
  useEffect(() => {
    if (!car || !seller) return undefined;
    let cancelled = false;

    const getImage = async (url) => {
      if (!imageCache.current.has(url)) {
        imageCache.current.set(url, await loadImage(url));
      }
      return imageCache.current.get(url);
    };

    (async () => {
      try {
        const urls = [
          car.image,
          ...(car.photos || []).map((p) => p.image),
        ].filter(Boolean);
        const photo = urls[photoIndex]
          ? await getImage(urls[photoIndex])
          : null;
        const logo = seller.logo
          ? await getImage(seller.logo).catch(() => null)
          : null;
        try {
          await document.fonts.load(`500 40px "Cormorant Garamond"`);
        } catch {
          // the fallback font is used
        }
        if (cancelled) return;
        drawFlyer(canvasRef.current, {
          car,
          seller,
          photo,
          logo,
          showPrice,
          showContact,
        });
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [car, seller, photoIndex, showPrice, showContact]);

  const fileName = car
    ? `${car.stock_number}-${car.make}-${car.model}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-") + ".png"
    : "flyer.png";

  const toBlob = () =>
    new Promise((resolve) => canvasRef.current.toBlob(resolve, "image/png"));

  const handleDownload = async () => {
    const blob = await toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleShare = async () => {
    const blob = await toBlob();
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: carName(car) });
      } catch {
        // the person closed the share sheet
      }
    } else {
      handleDownload();
    }
  };

  return (
    <>
      <div className="dash-head">
        <div>
          <p className="eyebrow">Share image</p>
          <h1>{car ? carName(car) : "Create a flyer"}</h1>
        </div>
        <Link className="btn btn-outline" to="/dashboard/cars">
          Back to inventory
        </Link>
      </div>

      <Alert messages={errors} />
      {failed && (
        <Alert
          messages={[
            "The photo couldn't be loaded for the flyer. Check that the car has a photo, and that the backend allows the website to read photos, then try again.",
          ]}
        />
      )}

      {car && (
        <div className="flyer-layout">
          <canvas ref={canvasRef} className="flyer-canvas" />

          <div>
            <section className="dash-card">
              <h2>Make it yours</h2>

              {photos.length > 1 && (
                <>
                  <p className="field-label">Photo</p>
                  <div className="dash-thumbs">
                    {photos.map((src, index) => (
                      <button
                        key={`${src}-${index}`}
                        type="button"
                        className={`dash-thumb dash-thumb-pick${index === photoIndex ? " active" : ""}`}
                        aria-label={`Use photo ${index + 1}`}
                        onClick={() => setPhotoIndex(index)}
                      >
                        <img src={src} alt="" />
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="dash-checks">
                <Check
                  label="Show the price"
                  checked={showPrice}
                  onChange={(event) => setShowPrice(event.target.checked)}
                />
                <Check
                  label="Show my socials and number"
                  checked={showContact}
                  onChange={(event) => setShowContact(event.target.checked)}
                />
              </div>
            </section>

            <div className="dash-form-actions">
              <button
                className="btn btn-primary btn-lg"
                onClick={handleShare}
                disabled={failed}
              >
                Share
              </button>
              <button
                className="btn btn-outline btn-lg"
                onClick={handleDownload}
                disabled={failed}
              >
                Download image
              </button>
            </div>
            <p className="dash-hint dash-flyer-hint">
              The image is 1080 by 1350 pixels, a good size for WhatsApp status,
              Instagram and Facebook.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ----------------------------------------------------------------------------
// REVIEWS: what customers say, shown on the home page
// ----------------------------------------------------------------------------
const EMPTY_REVIEW = { author: "", rating: "5", text: "", car_name: "" };

export function ReviewsPage() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState(null);
  const [form, setForm] = useState(EMPTY_REVIEW);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchReviews()
      .then(setReviews)
      .catch((error) => {
        if (!sessionExpired(error, navigate)) setErrors(describeError(error));
      });
  }, [navigate]);

  const set = (name) => (event) =>
    setForm((prev) => ({ ...prev, [name]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors([]);
    try {
      const created = await createReview({
        ...form,
        rating: Number(form.rating),
      });
      setReviews((prev) => [created, ...(prev || [])]);
      setForm(EMPTY_REVIEW);
    } catch (error) {
      if (!sessionExpired(error, navigate)) setErrors(describeError(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (review) => {
    if (!window.confirm(`Delete the review from ${review.author}?`)) return;
    setErrors([]);
    try {
      await deleteReview(review.id);
      setReviews((prev) => prev.filter((item) => item.id !== review.id));
    } catch (error) {
      if (!sessionExpired(error, navigate)) setErrors(describeError(error));
    }
  };

  const stars = (rating) => "★".repeat(rating) + "☆".repeat(5 - rating);

  return (
    <>
      <div className="dash-head">
        <div>
          <p className="eyebrow">Reviews</p>
          <h1>Customer reviews</h1>
        </div>
      </div>

      <Alert messages={errors} />

      <form className="dash-form" onSubmit={handleSubmit}>
        <section className="dash-card">
          <h2>Add a review</h2>
          <p className="dash-hint dash-intro">
            Only add reviews your customers have really given you, and ask for
            their permission first. The 6 newest show on your home page.
          </p>
          <div className="dash-grid">
            <Field label="Customer name">
              <input
                className="input"
                value={form.author}
                onChange={set("author")}
                maxLength={80}
                required
              />
            </Field>
            <Field label="Stars">
              <select
                className="input"
                value={form.rating}
                onChange={set("rating")}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "star" : "stars"}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field
            label="Their review"
            hint={`${form.text.length} of 400 characters`}
          >
            <textarea
              className="input"
              rows="4"
              value={form.text}
              onChange={set("text")}
              maxLength={400}
              required
            />
          </Field>
          <Field
            label="Car they bought (optional)"
            hint="For example 2019 Toyota Camry"
          >
            <input
              className="input"
              value={form.car_name}
              onChange={set("car_name")}
              maxLength={120}
            />
          </Field>
          <div className="dash-form-actions">
            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving..." : "Add review"}
            </button>
          </div>
        </section>
      </form>

      {reviews === null && errors.length === 0 && (
        <p className="dash-muted">Loading your reviews...</p>
      )}

      {reviews !== null && reviews.length === 0 && (
        <div className="empty">
          <p>
            No reviews yet. When you add one, a reviews section appears on your
            home page.
          </p>
        </div>
      )}

      {reviews !== null && reviews.length > 0 && (
        <section className="dash-card">
          <h2>Your reviews</h2>
          <ul className="dash-review-list">
            {reviews.map((review) => (
              <li key={review.id}>
                <div>
                  <p className="dash-review-stars">{stars(review.rating)}</p>
                  <p>{review.text}</p>
                  <p className="dash-car-sub">
                    {review.author}
                    {review.car_name ? ` · ${review.car_name}` : ""}
                  </p>
                </div>
                <button
                  className="icon-btn"
                  aria-label={`Delete the review from ${review.author}`}
                  onClick={() => handleDelete(review)}
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
