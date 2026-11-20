// ============================================================================
// DRIVETRADE - SELLER SHOWROOM
// All styling lives in App.css (same folder).
// ============================================================================

import React, { useState, useEffect } from "react";
import "./App.css";
import { useLocation, useNavigate } from "react-router-dom";
import {
  fetchSeller,
  fetchCars,
  fetchSold,
  normalizeSeller,
  normalizeCar,
  normalizeSold,
  shareUrl,
} from "./api";

import {
  Search,
  RefreshCw,
  MessageCircle,
  ArrowRight,
  Mail,
  Phone,
  MapPin,
  Clock,
  ArrowLeft,
} from "lucide-react";

// ----------------------------------------------------------------------------
// SETTINGS
// ----------------------------------------------------------------------------

// "light" or "dark". Changes the look of the whole site.
const THEME = "light";

// Which seller's showroom this site shows (the slug from the admin panel).
const SELLER_SLUG = import.meta.env.VITE_SELLER_SLUG || "m9-autos";

// Fallback text. The real details come from the seller's record in the
// database. Anything left empty there falls back to what is written here.
const SELLER_DEFAULTS = {
  name: "M9 Autos",
  tagline: "Verified vehicles and direct price negotiation.",
  intro: "Browse our cars, ask about a price, and message us on WhatsApp.",
  headline: "",
  logo: "",
  banners: [],
  aboutTitle: "A showroom built on trust.",
  aboutLead:
    "We bring together certified luxury and performance vehicles, open price conversations, and export support, so buying a serious car feels simple.",
  pillars: [
    {
      title: "Verified inventory",
      text: "Every listing carries a stock number and full specifications, so you can compare cars with clarity.",
    },
    {
      title: "Open negotiation",
      text: "Where a price is negotiable, you can talk to us directly instead of accepting a fixed number.",
    },
    {
      title: "Export support",
      text: "We help buyers outside our home market with shipping and export paperwork.",
    },
  ],
  email: "sales@drivetrade.com",
  phone: "+1 (555) 010-2030",
  whatsapp: "",
  address: "12 Showroom Avenue, Your City",
  hours: "Monday to Saturday, 9:00 to 18:00",
  currencySymbol: "$",
  distanceUnit: "mi",
  brands: [],
  instagram: "",
  website: "",
  mapQuery: "",
  reviews: [],
};

// Drops empty values so they never overwrite the fallback text
const withoutEmpty = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== "" && value != null),
  );

// Navbar and footer links. Keep the ids in sync with the activeTab checks below.
const NAV_ITEMS = [
  { id: "inventory", label: "Inventory" },
  { id: "about", label: "About Us" },
  { id: "contact", label: "Contact Us" },
];

// Brand strip: for each make in the inventory, the site looks for a logo file
// in public/logos/ named after the make in lowercase, with spaces turned into
// hyphens (BMW -> bmw.svg, Mercedes-Benz -> mercedes-benz.png). If no file is
// found, the brand name is shown as text instead.
const LOGO_TYPES = ["svg", "png", "webp"];
const logoName = (make) => make.toLowerCase().replace(/\s+/g, "-");

// Each page has its own address, so links, the back button and refresh all work.
const TAB_PATHS = {
  landing: "/",
  inventory: "/inventory",
  about: "/about",
  contact: "/contact",
};

function tabFromPath(pathname) {
  if (pathname.startsWith("/cars/")) return "detail";
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const match = Object.entries(TAB_PATHS).find(([, path]) => path === clean);
  return match ? match[0] : "landing";
}

const safeDecode = (text) => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "priceLow", label: "Price: low to high" },
  { value: "priceHigh", label: "Price: high to low" },
  { value: "yearNew", label: "Newest first" },
];

// Landing page tiles that jump to the inventory with a condition pre-selected
const CONDITION_TILES = [
  {
    value: "Brand New",
    label: "Brand new",
    text: "The latest models, with delivery mileage only.",
  },
  {
    value: "Certified",
    label: "Certified pre-owned",
    text: "Pre-owned cars that have been checked and certified.",
  },
  {
    value: "Pre-Owned",
    label: "Pre-owned",
    text: "Well-kept used cars at a lower price.",
  },
];

const EMPTY_ENQUIRY = {
  name: "",
  vehicle: "",
  message: "",
};

// Hero carousel: fading background photos
const HERO_SLIDES = [
  {
    title: "Engineered For The Obsessed.",
    subtitle: "Lamborghini Huracán Evo",
    image:
      "https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?auto=format&fit=crop&w=1920&q=80",
  },
  {
    title: "Dominance In Every Detail.",
    subtitle: "Cadillac Escalade V-Series",
    image:
      "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1920&q=80",
  },
  {
    title: "Precision German Craftsmanship.",
    subtitle: "Porsche 911 GT3 RS",
    image:
      "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=1920&q=80",
  },
  {
    title: "The Future Of Acceleration.",
    subtitle: "Tesla Roadster Performance",
    image:
      "https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1920&q=80",
  },
];

function InstagramIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

// ----------------------------------------------------------------------------
// CAR CARD (used on the landing page and in the inventory)
// ----------------------------------------------------------------------------
function CarCard({
  car,
  showSpecs,
  formatPrice,
  onOpen,
  reserveHref,
  negotiateHref,
}) {
  return (
    <article className="car-card">
      <button
        className="car-media"
        onClick={onOpen}
        aria-label={`View details for the ${car.year} ${car.make} ${car.model}`}
      >
        <img
          src={car.image}
          alt={`${car.year} ${car.make} ${car.model}`}
          loading="lazy"
        />
        <span className="car-tag">{car.condition}</span>
      </button>

      <div className="car-body">
        <div className="car-top">
          <p className="eyebrow">
            {car.year} · {car.make}
          </p>
          <span className="car-stock">{car.id}</span>
        </div>
        <h3 className="car-title">
          <button className="car-title-btn" onClick={onOpen}>
            {car.model}
          </button>
        </h3>
        <p className="car-price">
          {formatPrice(car.price)}
          {car.isNegotiable && <span className="car-note">Negotiable</span>}
        </p>

        {showSpecs && (
          <dl className="spec-row">
            <div>
              <dt>Mileage</dt>
              <dd>{car.mileage}</dd>
            </div>
            <div>
              <dt>Power</dt>
              <dd>{car.hp}</dd>
            </div>
            <div>
              <dt>Drive</dt>
              <dd>{car.drive}</dd>
            </div>
            <div>
              <dt>Fuel</dt>
              <dd>{car.fuel}</dd>
            </div>
          </dl>
        )}

        <div className="car-actions">
          <a
            className="btn btn-outline"
            href={reserveHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Reserve
          </a>
          {car.isNegotiable ? (
            <a
              className="btn btn-primary"
              href={negotiateHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={14} /> Negotiate
            </a>
          ) : (
            <span className="fixed-price">Fixed price</span>
          )}
        </div>
      </div>
    </article>
  );
}

// Shows a brand's logo, trying each file type in turn, and falls back to the
// brand name as text if no logo file exists.
function BrandMark({ make }) {
  const [attempt, setAttempt] = useState(0);

  if (attempt >= LOGO_TYPES.length) {
    return <span className="brand-name">{make}</span>;
  }

  return (
    <img
      className="brand-logo"
      src={`/logos/${logoName(make)}.${LOGO_TYPES[attempt]}`}
      alt={make}
      onError={() => setAttempt((n) => n + 1)}
    />
  );
}

// ----------------------------------------------------------------------------
// APP
// ----------------------------------------------------------------------------
function App() {
  // --- STATE ---
  // Data from the Django backend
  const [seller, setSeller] = useState(SELLER_DEFAULTS);
  const [inventory, setInventory] = useState([]);
  const [soldCars, setSoldCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [heroIndex, setHeroIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0); // which photo is open on a car's page
  const [notice, setNotice] = useState(""); // small message shown at the bottom

  // Inventory filters and sorting
  const [selectedMake, setSelectedMake] = useState("All");
  const [maxPrice, setMaxPrice] = useState(""); // "" means no price limit
  const [selectedCondition, setSelectedCondition] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [selectedYear, setSelectedYear] = useState("All");
  const [selectedTransmission, setSelectedTransmission] = useState("All");
  const [selectedFuel, setSelectedFuel] = useState("All");

  // Contact form
  const [enquiry, setEnquiry] = useState(EMPTY_ENQUIRY);
  const [enquirySent, setEnquirySent] = useState(false);

  // The address bar decides which page is open
  const activeTab = tabFromPath(location.pathname);
  const setActiveTab = (tab) => navigate(TAB_PATHS[tab] ?? "/");
  const stockInUrl =
    activeTab === "detail"
      ? safeDecode(location.pathname.slice("/cars/".length).replace(/\/+$/, ""))
      : "";
  const selectedCar = inventory.find((car) => car.id === stockInUrl) ?? null;

  // Home page photos: the dealer's own banners if he added any, else the samples
  const heroSlides = seller.banners.length
    ? seller.banners.map((image) => ({
        image,
        title: seller.name,
        subtitle: seller.tagline,
      }))
    : HERO_SLIDES;
  const slideCount = heroSlides.length;
  const activeSlide = heroSlides[heroIndex % slideCount];

  // --- EFFECTS ---
  // Hero carousel: next slide every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % slideCount);
    }, 5000);
    return () => clearInterval(timer);
  }, [slideCount]);

  // The browser tab shows the dealer's name
  useEffect(() => {
    document.title = seller.name;
  }, [seller.name]);

  // Load the seller's details and cars from the backend
  useEffect(() => {
    Promise.all([
      fetchSeller(SELLER_SLUG),
      fetchCars(SELLER_SLUG),
      fetchSold(SELLER_SLUG).catch(() => []), // the site still works without it
    ])
      .then(([sellerData, carsData, soldData]) => {
        const details = normalizeSeller(sellerData);
        setSeller({ ...SELLER_DEFAULTS, ...withoutEmpty(details) });
        setInventory(
          carsData.map((car) => normalizeCar(car, details.distanceUnit)),
        );
        setSoldCars(Array.isArray(soldData) ? soldData.map(normalizeSold) : []);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  // Preload hero images so switching never flashes
  useEffect(() => {
    const images = seller.banners.length
      ? seller.banners
      : HERO_SLIDES.map((slide) => slide.image);
    images.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [seller.banners]);

  // Start every page at the top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Back to the first photo when a different car is opened
  useEffect(() => {
    setPhotoIndex(0);
  }, [stockInUrl]);

  // Hide the small message after 3 seconds
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  // --- DERIVED DATA ---
  const availableMakes = [...new Set(inventory.map((car) => car.make))];
  const yearOptions = [...new Set(inventory.map((car) => car.year))].sort(
    (a, b) => b - a,
  );
  const transmissionOptions = [
    ...new Set(inventory.map((car) => car.transmission).filter(Boolean)),
  ];
  const fuelOptions = [
    ...new Set(inventory.map((car) => car.fuel).filter(Boolean)),
  ];

  // Brand strip: the brands the seller lists as sold. If none are listed, it
  // falls back to the makes of the cars currently in the inventory.
  const brandList = seller.brands.length ? seller.brands : availableMakes;
  const ready = !loading && !loadError;

  const formatPrice = (amount) =>
    `${seller.currencySymbol}${amount.toLocaleString()}`;

  // Opens a WhatsApp chat with the seller, with the message already typed in
  const whatsappLink = (message) =>
    `https://wa.me/${seller.whatsapp}?text=${encodeURIComponent(message)}`;

  // The WhatsApp buttons mention the car when a car's page is open
  const contactMessage = selectedCar
    ? `Hi, I'm interested in the ${selectedCar.year} ${selectedCar.make} ${selectedCar.model} (${selectedCar.id}).`
    : "Hi, I'd like to ask about a vehicle.";

  // Price slider adapts to the real prices in the inventory
  const highestPrice = inventory.reduce(
    (max, car) => Math.max(max, car.price),
    0,
  );
  const priceStep = Math.pow(
    10,
    Math.max(Math.floor(Math.log10(highestPrice || 10)) - 1, 0),
  );
  const priceCeiling =
    Math.ceil(highestPrice / priceStep) * priceStep || priceStep;
  const sliderValue = maxPrice === "" ? priceCeiling : Number(maxPrice);

  // Featured section: cars marked as featured, otherwise the newest three
  const featuredCars = inventory.some((car) => car.isFeatured)
    ? inventory.filter((car) => car.isFeatured).slice(0, 3)
    : inventory.slice(0, 3);

  const filteredVehicles = inventory.filter((car) => {
    const matchesMake =
      selectedMake === "All" ||
      car.make.toLowerCase() === selectedMake.toLowerCase();
    const matchesPrice = maxPrice === "" || car.price <= Number(maxPrice);
    const matchesCondition =
      selectedCondition === "All" || car.condition === selectedCondition;
    const matchesYear =
      selectedYear === "All" || car.year >= Number(selectedYear);
    const matchesTransmission =
      selectedTransmission === "All" ||
      car.transmission === selectedTransmission;
    const matchesFuel = selectedFuel === "All" || car.fuel === selectedFuel;
    const matchesSearch =
      car.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      car.make.toLowerCase().includes(searchTerm.toLowerCase());
    return (
      matchesMake &&
      matchesPrice &&
      matchesCondition &&
      matchesYear &&
      matchesTransmission &&
      matchesFuel &&
      matchesSearch
    );
  });

  const sortedVehicles = [...filteredVehicles].sort((a, b) => {
    if (sortBy === "priceLow") return a.price - b.price;
    if (sortBy === "priceHigh") return b.price - a.price;
    if (sortBy === "yearNew") return b.year - a.year;
    return 0;
  });

  // --- HANDLERS ---
  const handleResetFilters = () => {
    setSelectedMake("All");
    setMaxPrice("");
    setSelectedCondition("All");
    setSearchTerm("");
    setSortBy("featured");
    setSelectedYear("All");
    setSelectedTransmission("All");
    setSelectedFuel("All");
  };

  const updateEnquiry = (field) => (e) =>
    setEnquiry((prev) => ({ ...prev, [field]: e.target.value }));

  // Builds the message and opens WhatsApp so the buyer can send it
  const handleEnquirySubmit = (e) => {
    e.preventDefault();
    const car = inventory.find((item) => item.id === enquiry.vehicle);
    const about = car
      ? ` about the ${car.year} ${car.make} ${car.model} (${car.id})`
      : "";
    const text = `Hi, my name is ${enquiry.name}. I'd like to ask${about}.\n\n${enquiry.message}`;
    window.open(whatsappLink(text), "_blank", "noopener");
    setEnquirySent(true);
  };

  const resetEnquiry = () => {
    setEnquiry(EMPTY_ENQUIRY);
    setEnquirySent(false);
  };

  // Open a car's detail page
  const openCar = (car) => navigate(`/cars/${encodeURIComponent(car.id)}`);

  // Share a car: the phone's share sheet if there is one, otherwise copy the link
  const handleShare = async () => {
    const link = shareUrl(SELLER_SLUG, selectedCar.id);
    const title = `${selectedCar.year} ${selectedCar.make} ${selectedCar.model}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url: link });
      } catch {
        // the person closed the share sheet
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Link copied. Paste it anywhere to share this car.");
    } catch {
      setNotice(link);
    }
  };

  // Other cars to suggest under a car: same make first, then same condition
  const similarCars = selectedCar
    ? inventory
        .filter((car) => car.id !== selectedCar.id)
        .map((car) => ({
          car,
          score:
            (car.make === selectedCar.make ? 2 : 0) +
            (car.condition === selectedCar.condition ? 1 : 0),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((entry) => entry.car)
    : [];

  // Landing page tile: open the inventory filtered by condition
  const browseCondition = (condition) => {
    handleResetFilters();
    setSelectedCondition(condition);
    setActiveTab("inventory");
  };

  const detailSpecs = selectedCar
    ? [
        ["Condition", selectedCar.condition],
        ["Mileage", selectedCar.mileage],
        ["Engine", selectedCar.engine],
        ["Power", selectedCar.hp],
        ["Drive", selectedCar.drive],
        ["Transmission", selectedCar.transmission],
        ["Fuel", selectedCar.fuel],
        ["Location", selectedCar.location],
        ["VIN / chassis number", selectedCar.vin],
        ["Stock number", selectedCar.id],
      ].filter(([, value]) => value) // hide rows that were left empty
    : [];

  // One place that builds a car card, so both pages behave the same
  const renderCard = (car, showSpecs) => (
    <CarCard
      key={car.id}
      car={car}
      showSpecs={showSpecs}
      formatPrice={formatPrice}
      onOpen={() => openCar(car)}
      reserveHref={whatsappLink(
        `Hi, I'd like to reserve the ${car.year} ${car.make} ${car.model} (${car.id}).`,
      )}
      negotiateHref={whatsappLink(
        `Hi, I'd like to talk about the price of the ${car.year} ${car.make} ${car.model} (${car.id}), listed at ${formatPrice(car.price)}.`,
      )}
    />
  );

  return (
    <div className="app" data-theme={THEME}>
      {/* ================================================================== */}
      {/* HEADER                                                              */}
      {/* ================================================================== */}
      <header className="header">
        <div className="container header-inner">
          <button className="logo" onClick={() => setActiveTab("landing")}>
            {seller.logo ? (
              <img className="logo-img" src={seller.logo} alt={seller.name} />
            ) : (
              seller.name
            )}
          </button>

          <nav className="nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`nav-link${
                  activeTab === item.id ||
                  (item.id === "inventory" && activeTab === "detail")
                    ? " active"
                    : ""
                }`}
                onClick={() => setActiveTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <a
              className="btn btn-primary"
              href={whatsappLink(contactMessage)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={16} />{" "}
              <span className="hide-sm">Chat on </span>
              WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* ================================================================== */}
      {/* LANDING PAGE                                                        */}
      {/* ================================================================== */}
      {loadError && (
        <main className="page">
          <div className="container">
            <div className="empty">
              <p>
                We couldn't load the showroom right now. Please check your
                connection and refresh the page.
              </p>
            </div>
          </div>
        </main>
      )}

      {!loadError && loading && (
        <main className="page">
          <div className="container">
            <p className="toolbar-count">Loading the showroom...</p>
          </div>
        </main>
      )}

      {ready && activeTab === "landing" && (
        <main>
          <section className="hero">
            {heroSlides.map((slide, idx) => (
              <div
                key={idx}
                className={`hero-slide${heroIndex === idx ? " active" : ""}`}
                style={{ backgroundImage: `url(${slide.image})` }}
              />
            ))}
            <div className="hero-overlay" />

            <div className="container hero-content">
              <div
                key={seller.headline ? "static" : heroIndex}
                className="hero-copy"
              >
                <p className="eyebrow hero-eyebrow">
                  {seller.headline ? seller.tagline : activeSlide.subtitle}
                </p>
                <h1 className="display">
                  {seller.headline || activeSlide.title}
                </h1>
              </div>
              <p className="hero-text">{seller.intro}</p>
              <div className="hero-actions">
                <button
                  className="btn btn-light btn-lg"
                  onClick={() => setActiveTab("inventory")}
                >
                  Shop Now <ArrowRight size={16} />
                </button>
                <button
                  className="btn btn-ghost-light btn-lg"
                  onClick={() => setActiveTab("about")}
                >
                  Our Standards
                </button>
              </div>
            </div>
          </section>

          <section className="brands">
            <div className="container brands-inner">
              <p className="eyebrow">Brands we sell</p>
              <div className="brand-row">
                {brandList.map((make) => (
                  <BrandMark key={make} make={make} />
                ))}
              </div>
            </div>
          </section>

          <section className="section section-brown">
            <div className="container">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Curated selection</p>
                  <h2 className="display">Featured listings</h2>
                </div>
                <button
                  className="link-arrow"
                  onClick={() => setActiveTab("inventory")}
                >
                  View all listings <ArrowRight size={15} />
                </button>
              </div>
              <div className="car-grid">
                {featuredCars.map((car) => renderCard(car, false))}
              </div>
            </div>
          </section>

          <section className="section">
            <div className="container">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Browse by condition</p>
                  <h2 className="display">Find your fit</h2>
                </div>
              </div>
              <div className="tiles">
                {CONDITION_TILES.map((tile) => {
                  const count = inventory.filter(
                    (car) => car.condition === tile.value,
                  ).length;
                  return (
                    <button
                      key={tile.value}
                      className="tile"
                      onClick={() => browseCondition(tile.value)}
                    >
                      <span className="eyebrow">
                        {count} {count === 1 ? "vehicle" : "vehicles"}
                      </span>
                      <span>
                        <span className="tile-title">{tile.label}</span>
                        <span className="tile-text">{tile.text}</span>
                      </span>
                      <span className="tile-link">
                        Browse <ArrowRight size={15} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {soldCars.length > 0 && (
            <section className="section sold-section">
              <div className="container">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Recently sold</p>
                    <h2 className="display">Cars that found a new home</h2>
                  </div>
                </div>
                <div className="sold-grid">
                  {soldCars.map((car) => (
                    <div key={car.id} className="sold-card">
                      <div className="sold-media">
                        <img src={car.image} alt={car.name} loading="lazy" />
                        <span className="sold-tag">Sold</span>
                      </div>
                      <p className="sold-name">{car.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {seller.reviews.length > 0 && (
            <section className="section section-brown">
              <div className="container">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Customer reviews</p>
                    <h2 className="display">What our customers say</h2>
                  </div>
                </div>
                <div className="review-grid">
                  {seller.reviews.slice(0, 6).map((review) => (
                    <figure key={review.id} className="review-card">
                      <p
                        className="review-stars"
                        aria-label={`${review.rating} out of 5 stars`}
                      >
                        {"★".repeat(review.rating)}
                        <span className="review-stars-off">
                          {"★".repeat(5 - review.rating)}
                        </span>
                      </p>
                      <blockquote>{review.text}</blockquote>
                      <figcaption>
                        <strong>{review.author}</strong>
                        {review.car_name && <span>{review.car_name}</span>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </section>
          )}

          <section className="cta">
            <div className="container">
              <h2 className="display">Have a car in mind?</h2>
              <p>
                Browse the full inventory, or get in touch to arrange a viewing.
              </p>
              <div className="cta-actions">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => setActiveTab("inventory")}
                >
                  View inventory
                </button>
                <button
                  className="btn btn-outline btn-lg"
                  onClick={() => setActiveTab("contact")}
                >
                  Contact us
                </button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ================================================================== */}
      {/* INVENTORY                                                           */}
      {/* ================================================================== */}
      {ready && activeTab === "inventory" && (
        <main className="page has-band">
          <section className="page-band section-brown">
            <div className="container">
              <div className="page-head">
                <p className="eyebrow">Inventory</p>
                <h1 className="display">Verified inventory</h1>
                <p>
                  Browse listings with full specifications and direct price
                  negotiation options.
                </p>
              </div>
            </div>
          </section>

          <div className="container">
            <div className="inventory-layout">
              <aside className="filters">
                <div className="filters-head">
                  <span className="filters-title">Filters</span>
                  <button className="text-btn" onClick={handleResetFilters}>
                    <RefreshCw size={12} /> Reset
                  </button>
                </div>

                <div>
                  <label className="field-label" htmlFor="search">
                    Search
                  </label>
                  <div className="search-wrap">
                    <Search size={15} className="search-icon" />
                    <input
                      id="search"
                      className="input"
                      type="text"
                      placeholder="e.g. M4, Camry"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="field-label" htmlFor="make">
                    Manufacturer
                  </label>
                  <select
                    id="make"
                    className="input"
                    value={selectedMake}
                    onChange={(e) => setSelectedMake(e.target.value)}
                  >
                    <option value="All">All makes</option>
                    {availableMakes.map((make) => (
                      <option key={make} value={make}>
                        {make}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="condition">
                    Condition
                  </label>
                  <select
                    id="condition"
                    className="input"
                    value={selectedCondition}
                    onChange={(e) => setSelectedCondition(e.target.value)}
                  >
                    <option value="All">All conditions</option>
                    <option value="Brand New">Brand new</option>
                    <option value="Certified">Certified pre-owned</option>
                    <option value="Pre-Owned">Pre-owned</option>
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="year">
                    Year
                  </label>
                  <select
                    id="year"
                    className="input"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                  >
                    <option value="All">Any year</option>
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year} or newer
                      </option>
                    ))}
                  </select>
                </div>

                {transmissionOptions.length > 0 && (
                  <div>
                    <label className="field-label" htmlFor="transmission">
                      Transmission
                    </label>
                    <select
                      id="transmission"
                      className="input"
                      value={selectedTransmission}
                      onChange={(e) => setSelectedTransmission(e.target.value)}
                    >
                      <option value="All">Any transmission</option>
                      {transmissionOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {fuelOptions.length > 0 && (
                  <div>
                    <label className="field-label" htmlFor="fuel">
                      Fuel
                    </label>
                    <select
                      id="fuel"
                      className="input"
                      value={selectedFuel}
                      onChange={(e) => setSelectedFuel(e.target.value)}
                    >
                      <option value="All">Any fuel</option>
                      {fuelOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <div className="range-head">
                    <label className="field-label" htmlFor="price">
                      Max price
                    </label>
                    <span className="range-value">
                      {formatPrice(sliderValue)}
                    </span>
                  </div>
                  <input
                    id="price"
                    className="range"
                    type="range"
                    min="0"
                    max={priceCeiling}
                    step={priceStep}
                    value={sliderValue}
                    onChange={(e) => setMaxPrice(e.target.value)}
                  />
                </div>
              </aside>

              <section>
                <div className="toolbar">
                  <p className="toolbar-count">
                    {sortedVehicles.length}{" "}
                    {sortedVehicles.length === 1 ? "vehicle" : "vehicles"}
                  </p>
                  <select
                    className="input"
                    aria-label="Sort vehicles"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {sortedVehicles.length === 0 ? (
                  <div className="empty">
                    <p>No vehicles match these filters.</p>
                    <button
                      className="btn btn-primary"
                      onClick={handleResetFilters}
                    >
                      Reset filters
                    </button>
                  </div>
                ) : (
                  <div className="car-grid">
                    {sortedVehicles.map((car) => renderCard(car, true))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </main>
      )}

      {/* ================================================================== */}
      {/* ABOUT                                                               */}
      {/* ================================================================== */}
      {ready && activeTab === "about" && (
        <main>
          <section className="page-hero">
            <div className="container">
              <p className="eyebrow">About us</p>
              <h1 className="display">{seller.aboutTitle}</h1>
              <p className="lead">{seller.aboutLead}</p>
            </div>
          </section>

          <section className="section">
            <div className="container pillars">
              {seller.pillars.map((pillar, idx) => (
                <div key={pillar.title} className="pillar">
                  <p className="pillar-num">0{idx + 1}</p>
                  <h3>{pillar.title}</h3>
                  <p>{pillar.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="cta">
            <div className="container">
              <h2 className="display">Found something you like?</h2>
              <p>Browse the inventory, or get in touch to talk about a car.</p>
              <div className="cta-actions">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => setActiveTab("inventory")}
                >
                  View inventory
                </button>
                <button
                  className="btn btn-outline btn-lg"
                  onClick={() => setActiveTab("contact")}
                >
                  Contact us
                </button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ================================================================== */}
      {/* CONTACT                                                             */}
      {/* ================================================================== */}
      {ready && activeTab === "contact" && (
        <main className="page">
          <div className="container contact-layout">
            <div>
              <p className="eyebrow">Contact</p>
              <h1 className="display">Get in touch</h1>
              <p className="lead">
                Ask about a vehicle, request a viewing, or start a price
                conversation.
              </p>

              <div className="info-list">
                <div className="info-item">
                  <Mail size={18} />
                  <div>
                    <p className="info-label">Email</p>
                    <p>{seller.email}</p>
                  </div>
                </div>
                <div className="info-item">
                  <Phone size={18} />
                  <div>
                    <p className="info-label">Phone</p>
                    <p>{seller.phone}</p>
                  </div>
                </div>
                <div className="info-item">
                  <MessageCircle size={18} />
                  <div>
                    <p className="info-label">WhatsApp</p>
                    <a
                      href={whatsappLink(contactMessage)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Chat with us
                    </a>
                  </div>
                </div>
                {seller.instagram && (
                  <div className="info-item">
                    <InstagramIcon size={18} />
                    <div>
                      <p className="info-label">Instagram</p>
                      <a
                        href={`https://www.instagram.com/${seller.instagram}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        @{seller.instagram}
                      </a>
                    </div>
                  </div>
                )}
                <div className="info-item">
                  <MapPin size={18} />
                  <div>
                    <p className="info-label">Showroom</p>
                    <p>{seller.address}</p>
                  </div>
                </div>
                <div className="info-item">
                  <Clock size={18} />
                  <div>
                    <p className="info-label">Opening hours</p>
                    <p>{seller.hours}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-panel">
              {enquirySent ? (
                <div className="sent">
                  <h3>Thank you, {enquiry.name}.</h3>
                  <p>
                    Your message is ready in WhatsApp. Press send there to reach
                    us.
                  </p>
                  <button className="btn btn-outline" onClick={resetEnquiry}>
                    Send another enquiry
                  </button>
                </div>
              ) : (
                <form className="form" onSubmit={handleEnquirySubmit}>
                  <div className="form-row">
                    <div>
                      <label className="field-label" htmlFor="enq-name">
                        Name
                      </label>
                      <input
                        id="enq-name"
                        className="input"
                        type="text"
                        value={enquiry.name}
                        onChange={updateEnquiry("name")}
                        required
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="enq-vehicle">
                        Vehicle
                      </label>
                      <select
                        id="enq-vehicle"
                        className="input"
                        value={enquiry.vehicle}
                        onChange={updateEnquiry("vehicle")}
                      >
                        <option value="">General enquiry</option>
                        {inventory.map((car) => (
                          <option key={car.id} value={car.id}>
                            {car.year} {car.make} {car.model}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="field-label" htmlFor="enq-message">
                      Message
                    </label>
                    <textarea
                      id="enq-message"
                      className="input"
                      value={enquiry.message}
                      onChange={updateEnquiry("message")}
                      required
                    />
                  </div>

                  <button className="btn btn-primary btn-lg" type="submit">
                    Continue on WhatsApp
                  </button>
                </form>
              )}
            </div>
          </div>

          {(seller.mapQuery || seller.address) && (
            <section className="container find-us">
              <p className="eyebrow">Find us</p>
              <h2 className="display">Visit the showroom</h2>
              <p className="find-us-address">
                {seller.address}
                {seller.hours ? ` · ${seller.hours}` : ""}
              </p>
              <div className="map-wrap">
                <iframe
                  title="Map showing where to find us"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(seller.mapQuery || seller.address)}&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <a
                className="link-arrow"
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(seller.mapQuery || seller.address)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get directions <ArrowRight size={15} />
              </a>
            </section>
          )}
        </main>
      )}

      {/* ================================================================== */}
      {/* CAR DETAIL                                                          */}
      {/* ================================================================== */}
      {ready && activeTab === "detail" && !selectedCar && (
        <main className="page">
          <div className="container">
            <div className="empty">
              <p>This car isn't available anymore. It may have been sold.</p>
              <button
                className="btn btn-primary"
                onClick={() => setActiveTab("inventory")}
              >
                See the inventory
              </button>
            </div>
          </div>
        </main>
      )}

      {ready && activeTab === "detail" && selectedCar && (
        <main className="page">
          <div className="container">
            <button
              className="link-arrow"
              onClick={() => setActiveTab("inventory")}
            >
              <ArrowLeft size={15} /> Back to inventory
            </button>

            <div className="detail-layout">
              <div className="gallery">
                <div className="gallery-main">
                  <img
                    className="detail-image"
                    src={selectedCar.images[photoIndex]}
                    alt={`${selectedCar.year} ${selectedCar.make} ${selectedCar.model}, photo ${photoIndex + 1}`}
                  />
                  {selectedCar.images.length > 1 && (
                    <>
                      <button
                        className="gallery-arrow gallery-prev"
                        aria-label="Previous photo"
                        onClick={() =>
                          setPhotoIndex(
                            (i) =>
                              (i - 1 + selectedCar.images.length) %
                              selectedCar.images.length,
                          )
                        }
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <button
                        className="gallery-arrow gallery-next"
                        aria-label="Next photo"
                        onClick={() =>
                          setPhotoIndex(
                            (i) => (i + 1) % selectedCar.images.length,
                          )
                        }
                      >
                        <ArrowRight size={18} />
                      </button>
                      <span className="gallery-count">
                        {photoIndex + 1} / {selectedCar.images.length}
                      </span>
                    </>
                  )}
                </div>

                {selectedCar.images.length > 1 && (
                  <div className="gallery-thumbs">
                    {selectedCar.images.map((src, index) => (
                      <button
                        key={`${src}-${index}`}
                        className={`gallery-thumb${index === photoIndex ? " active" : ""}`}
                        aria-label={`Show photo ${index + 1}`}
                        onClick={() => setPhotoIndex(index)}
                      >
                        <img src={src} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="eyebrow">
                  {selectedCar.year} · {selectedCar.make}
                </p>
                <h1 className="display detail-title">{selectedCar.model}</h1>
                <p className="detail-price">
                  {formatPrice(selectedCar.price)}
                  {selectedCar.isNegotiable && (
                    <span className="car-note">Negotiable</span>
                  )}
                </p>

                <dl className="detail-specs">
                  {detailSpecs.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="detail-actions">
                  <a
                    className="btn btn-primary btn-lg"
                    href={whatsappLink(
                      `Hi, I'd like to reserve the ${selectedCar.year} ${selectedCar.make} ${selectedCar.model} (${selectedCar.id}).`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle size={16} /> Reserve on WhatsApp
                  </a>
                  {selectedCar.isNegotiable && (
                    <a
                      className="btn btn-outline btn-lg"
                      href={whatsappLink(
                        `Hi, I'd like to talk about the price of the ${selectedCar.year} ${selectedCar.make} ${selectedCar.model} (${selectedCar.id}), listed at ${formatPrice(selectedCar.price)}.`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Negotiate the price
                    </a>
                  )}
                  <button className="link-arrow" onClick={handleShare}>
                    Share this car
                  </button>
                </div>
              </div>
            </div>

            {similarCars.length > 0 && (
              <section className="similar">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">You may also like</p>
                    <h2 className="display">Similar cars</h2>
                  </div>
                </div>
                <div className="car-grid">
                  {similarCars.map((car) => renderCard(car, false))}
                </div>
              </section>
            )}
          </div>
        </main>
      )}

      {/* ================================================================== */}
      {/* FOOTER (every page)                                                 */}
      {/* ================================================================== */}
      <footer className="footer section-brown">
        <div className="container">
          <div className="footer-grid">
            <div>
              <p className="footer-brand">{seller.name}</p>
              <p>{seller.tagline}</p>
            </div>
            <div>
              <p className="eyebrow">Explore</p>
              <div className="footer-links">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    className="footer-link"
                    onClick={() => setActiveTab(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="eyebrow">Visit us</p>
              <p>{seller.address}</p>
              <p>{seller.hours}</p>
              {seller.instagram && (
                <p>
                  <a
                    className="footer-link"
                    href={`https://www.instagram.com/${seller.instagram}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Instagram: @{seller.instagram}
                  </a>
                </p>
              )}
            </div>
          </div>
          <p className="footer-bottom">
            © {new Date().getFullYear()} {seller.name}. All rights reserved.
          </p>
        </div>
      </footer>

      {notice && <div className="toast">{notice}</div>}

      {/* ================================================================== */}
      {/* FLOATING WHATSAPP BUTTON (every page)                               */}
      {/* ================================================================== */}
      <a
        className="whatsapp-float"
        href={whatsappLink(contactMessage)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
      >
        <MessageCircle size={26} />
      </a>
    </div>
  );
}

export default App;
