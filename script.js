/* ==========================================================================
   GlowControl · Landing (index)
   Todo es opcional: si el JS falla, la página sigue siendo legible.
   ========================================================================== */

const CONFIG = {
  DEMO_URL: "Demo/demo.html",
  WHATSAPP: "5213312892022",
  WHATSAPP_MENSAJE:
    "Hola, vi la página de GlowControl y quiero más información.",
};

const reducirMovimiento = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

function configurarEnlaces() {
  document.querySelectorAll("[data-demo]").forEach((a) => {
    a.setAttribute("href", CONFIG.DEMO_URL);
  });

  const numero = CONFIG.WHATSAPP.replace(/\D/g, "");
  document.querySelectorAll("[data-wa]").forEach((a) => {
    if (!numero) {
      a.hidden = true;
      return;
    }
    const mensaje = a.dataset.msg || CONFIG.WHATSAPP_MENSAJE;
    a.setAttribute(
      "href",
      `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`,
    );
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener");
  });
}

const TEMAS = [
  {
    id: "boutique",
    nombre: "Crema",
    r: 26,
    rs: 14,
    claro: [
      "#f6efe6",
      "#fffaf3",
      "#f0e6d8",
      "#8a6a4f",
      "#ffffff",
      "#3b2f27",
      "#7a6757",
      "#e6d9c8",
      "#3b2f27",
    ],
    oscuro: [
      "#1c1713",
      "#2a221b",
      "#352b22",
      "#c9a27e",
      "#1c1713",
      "#f3e9dd",
      "#bfa993",
      "#43372c",
      "#ecd7bf",
    ],
  },
  {
    id: "coquette",
    nombre: "Rosa Coquette",
    r: 28,
    rs: 999,
    claro: [
      "#fff5f8",
      "#ffffff",
      "#ffe6ed",
      "#e0568f",
      "#ffffff",
      "#4a2837",
      "#9c687f",
      "#ffd1dc",
      "#c73e79",
    ],
    oscuro: [
      "#1f0f17",
      "#2d1824",
      "#3a2030",
      "#f472a8",
      "#2a0716",
      "#ffe8f1",
      "#e0a9c2",
      "#4a2a3b",
      "#fbcfe8",
    ],
  },
  {
    id: "lavanda",
    nombre: "Lavanda Relax",
    r: 20,
    rs: 10,
    claro: [
      "#f5f3ff",
      "#ffffff",
      "#ede9fe",
      "#7c3aed",
      "#ffffff",
      "#2e1065",
      "#6d5b97",
      "#ddd6fe",
      "#5b21b6",
    ],
    oscuro: [
      "#150f2a",
      "#211a3d",
      "#2b2250",
      "#a78bfa",
      "#140b30",
      "#f1ecff",
      "#beb2e6",
      "#3a2f66",
      "#ddd6fe",
    ],
  },
  {
    id: "menta",
    nombre: "Menta & Bambú",
    r: 24,
    rs: 12,
    claro: [
      "#f0fdf4",
      "#ffffff",
      "#dcfce7",
      "#16a34a",
      "#ffffff",
      "#14532d",
      "#3a7d55",
      "#bbf7d0",
      "#166534",
    ],
    oscuro: [
      "#0b1a12",
      "#12281b",
      "#1a3626",
      "#4ade80",
      "#052e14",
      "#e7fbee",
      "#9fd0b2",
      "#234a33",
      "#bbf7d0",
    ],
  },
  {
    id: "glow",
    nombre: "Glow Peach",
    r: 30,
    rs: 999,
    claro: [
      "#fff7ed",
      "#ffffff",
      "#ffedd5",
      "#ea580c",
      "#ffffff",
      "#431407",
      "#9a6345",
      "#fed7aa",
      "#c2410c",
    ],
    oscuro: [
      "#1f1209",
      "#2d1c10",
      "#3a2414",
      "#fb923c",
      "#2b1203",
      "#fff0e3",
      "#e0b494",
      "#4a3220",
      "#fed7aa",
    ],
  },
  {
    id: "zen",
    nombre: "Zen Minimal",
    r: 0,
    rs: 0,
    claro: [
      "#f3f2ed",
      "#f3f2ed",
      "#e8e7df",
      "#4b5a47",
      "#ffffff",
      "#2a2a26",
      "#6b6b62",
      "#d9d8cf",
      "#2a2a26",
    ],
    oscuro: [
      "#14170f",
      "#191d14",
      "#232a1c",
      "#a3b18a",
      "#12150d",
      "#edf0e6",
      "#aab39c",
      "#38402f",
      "#d6dec4",
    ],
  },
  {
    id: "oceano",
    nombre: "Azul Océano",
    r: 22,
    rs: 12,
    claro: [
      "#eef5ff",
      "#ffffff",
      "#e0edff",
      "#2563eb",
      "#ffffff",
      "#10284a",
      "#566a88",
      "#cfe0f7",
      "#123a7a",
    ],
    oscuro: [
      "#08142b",
      "#0f2144",
      "#162d58",
      "#60a5fa",
      "#06122a",
      "#e8f1ff",
      "#9db8e0",
      "#25407a",
      "#bfdbfe",
    ],
  },
  {
    id: "sol",
    nombre: "Amarillo Sol",
    r: 22,
    rs: 12,
    claro: [
      "#fff9db",
      "#fffdf0",
      "#fdf3c0",
      "#eab308",
      "#3a2800",
      "#3a2e05",
      "#7a6a2a",
      "#f3e3a1",
      "#713f12",
    ],
    oscuro: [
      "#1c1604",
      "#2a2108",
      "#382c0b",
      "#facc15",
      "#2b2000",
      "#fff7d6",
      "#d9c46e",
      "#4d3f12",
      "#fde68a",
    ],
  },
  {
    id: "turquesa",
    nombre: "Turquesa",
    r: 24,
    rs: 12,
    claro: [
      "#effdfa",
      "#ffffff",
      "#d5f5ef",
      "#0d9488",
      "#ffffff",
      "#0b2f2c",
      "#4d7a75",
      "#bfece4",
      "#115e59",
    ],
    oscuro: [
      "#061f1d",
      "#0c302d",
      "#123f3b",
      "#2dd4bf",
      "#04211e",
      "#e6fffb",
      "#9fd6cf",
      "#1d514c",
      "#99f6e4",
    ],
  },
  {
    id: "candy",
    nombre: "Candy Pop",
    r: 32,
    rs: 16,
    claro: [
      "#fdf4ff",
      "#ffffff",
      "#fae8ff",
      "#c026d3",
      "#ffffff",
      "#3b0a45",
      "#86509a",
      "#f5d0fe",
      "#a21caf",
    ],
    oscuro: [
      "#1d0a24",
      "#2c1038",
      "#3a1749",
      "#e879f9",
      "#2a0633",
      "#fdeaff",
      "#dba7e8",
      "#5a2a70",
      "#f5d0fe",
    ],
  },
  {
    id: "editorial",
    nombre: "Editorial",
    r: 0,
    rs: 0,
    claro: [
      "#ffffff",
      "#ffffff",
      "#f4f4f4",
      "#111111",
      "#ffffff",
      "#111111",
      "#555555",
      "#d4d4d4",
      "#111111",
    ],
    oscuro: [
      "#0d0d0d",
      "#181818",
      "#232323",
      "#f5f5f5",
      "#111111",
      "#f5f5f5",
      "#a3a3a3",
      "#333333",
      "#ffffff",
    ],
  },
  {
    id: "rubi",
    nombre: "Rubí",
    r: 24,
    rs: 12,
    claro: [
      "#fff1f2",
      "#ffffff",
      "#ffe4e6",
      "#e11d48",
      "#ffffff",
      "#4c0519",
      "#9f4a5c",
      "#fecdd3",
      "#9f1239",
    ],
    oscuro: [
      "#1f0a0f",
      "#2e1219",
      "#3b1822",
      "#fb7185",
      "#2a050d",
      "#ffe9ec",
      "#e0a5af",
      "#4d2230",
      "#fecdd3",
    ],
  },
];

const CARDS = [
  { id: "framed", nombre: "Enmarcada" },
  { id: "coquette", nombre: "Punteada" },
  { id: "lavanda", nombre: "Doble sección" },
  { id: "menta", nombre: "Orgánica" },
  { id: "glow", nombre: "Floating" },
  { id: "zen", nombre: "Sin bordes" },
  { id: "aurora", nombre: "Cristal Glass" },
  { id: "candy", nombre: "Imagen circular" },
  { id: "editorial", nombre: "Línea superior" },
  { id: "dorado", nombre: "Marco doble" },
  { id: "escarcha", nombre: "Cristal Escarcha" },
  { id: "neon", nombre: "Cristal Neón" },
];

const VARIABLES = [
  "--t-bg",
  "--t-surface",
  "--t-alt",
  "--t-primary",
  "--t-on",
  "--t-text",
  "--t-muted",
  "--t-border",
  "--t-accent",
];

function pintarTema(el, tema, modo) {
  if (!el || !tema) return;
  const paleta = tema[modo] || tema.claro;
  VARIABLES.forEach((v, i) => el.style.setProperty(v, paleta[i]));
  el.style.setProperty("--t-r", tema.r + "px");
  el.style.setProperty("--t-rs", tema.rs + "px");
  el.dataset.tema = tema.id;
  el.dataset.modo = modo;
}

function iniciarHero() {
  const el = document.getElementById("hero-themed");
  if (!el) return;

  const secuencia = ["boutique", "lavanda", "oceano"].map((id) =>
    TEMAS.find((t) => t.id === id),
  );
  let i = 0;
  pintarTema(el, secuencia[0], "claro");

  if (reducirMovimiento) return;
  setInterval(() => {
    if (document.hidden) return;
    i = (i + 1) % secuencia.length;
    pintarTema(el, secuencia[i], "claro");
  }, 3500);
}

const estadoPz = { tema: "boutique", modo: "claro", card: "framed" };

function aplicarPz() {
  const prev = document.getElementById("pz-preview");
  const tema = TEMAS.find((t) => t.id === estadoPz.tema);
  if (!prev || !tema) return;

  pintarTema(prev, tema, estadoPz.modo);
  prev.dataset.card = estadoPz.card;

  document.querySelectorAll(".swatch").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.tema === estadoPz.tema));
    const t = TEMAS.find((x) => x.id === b.dataset.tema);
    const p = t[estadoPz.modo];
    b.style.background = `linear-gradient(135deg, ${p[0]} 50%, ${p[3]} 50%)`;
  });

  document.querySelectorAll(".card-chip").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.card === estadoPz.card));
  });

  document.querySelectorAll(".pz-mode button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.mode === estadoPz.modo));
  });

  const nombre = document.getElementById("pz-theme-name");
  const card = CARDS.find((c) => c.id === estadoPz.card);
  if (nombre) {
    nombre.innerHTML = `Tema <strong>${tema.nombre}</strong> · tarjeta <strong>${card.nombre}</strong>`;
  }
}

function iniciarPersonalizador() {
  const swatches = document.getElementById("swatches");
  const chips = document.getElementById("card-chips");
  if (!swatches || !chips) return;

  TEMAS.forEach((t) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.dataset.tema = t.id;
    b.title = t.nombre;
    b.setAttribute("aria-label", t.nombre);
    b.addEventListener("click", () => {
      estadoPz.tema = t.id;
      aplicarPz();
    });
    swatches.appendChild(b);
  });

  CARDS.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "card-chip";
    b.dataset.card = c.id;
    b.textContent = c.nombre;
    b.addEventListener("click", () => {
      estadoPz.card = c.id;
      aplicarPz();
    });
    chips.appendChild(b);
  });

  document.querySelectorAll(".pz-mode button").forEach((b) => {
    b.addEventListener("click", () => {
      estadoPz.modo = b.dataset.mode;
      aplicarPz();
    });
  });

  const azar = document.getElementById("pz-random");
  if (azar) {
    azar.addEventListener("click", () => {
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
      estadoPz.tema = pick(TEMAS).id;
      estadoPz.card = pick(CARDS).id;
      estadoPz.modo = Math.random() < 0.35 ? "oscuro" : "claro";
      aplicarPz();
    });
  }

  aplicarPz();
}

function iniciarBloqueSheets() {
  const bloque = document.getElementById("sheet-block");
  const celda = document.getElementById("cell-desc");
  const precio = document.getElementById("sheet-price");
  const tarjeta = document.getElementById("sheet-themed");
  if (!bloque || !celda || !precio) return;

  pintarTema(
    tarjeta,
    TEMAS.find((t) => t.id === "boutique"),
    "claro",
  );

  const BASE = 650;
  const CON_DESCUENTO = 520;

  function mostrar(conDescuento) {
    if (conDescuento) {
      celda.textContent = String(CON_DESCUENTO);
      precio.innerHTML = `<small class="svc-old"><s>$${BASE}</s></small><b>$${CON_DESCUENTO} MXN</b>`;
    } else {
      celda.textContent = "";
      precio.innerHTML = `<b>$${BASE} MXN</b>`;
    }
    celda.classList.add("flash");
    setTimeout(() => celda.classList.remove("flash"), 700);
  }

  mostrar(true);
  if (reducirMovimiento || !("IntersectionObserver" in window)) return;

  let estado = false;
  let timer = null;
  mostrar(false);

  const obs = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((e) => {
        if (e.isIntersecting && !timer) {
          timer = setInterval(() => {
            estado = !estado;
            mostrar(estado);
          }, 2800);
        } else if (!e.isIntersecting && timer) {
          clearInterval(timer);
          timer = null;
        }
      });
    },
    { threshold: 0.35 },
  );
  obs.observe(bloque);
}

function iniciarNavbar() {
  const nav = document.getElementById("nav");
  if (nav) {
    const alScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
    alScroll();
    window.addEventListener("scroll", alScroll, { passive: true });
  }

  const enlaces = [...document.querySelectorAll(".nav-links a")];
  if (!enlaces.length || !("IntersectionObserver" in window)) return;

  const secciones = enlaces
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  const obs = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((e) => {
        if (!e.isIntersecting) return;
        enlaces.forEach((a) =>
          a.classList.toggle(
            "active",
            a.getAttribute("href") === "#" + e.target.id,
          ),
        );
      });
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  secciones.forEach((s) => obs.observe(s));
}

function iniciarReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || reducirMovimiento) {
    items.forEach((i) => i.classList.add("in"));
    return;
  }

  document
    .querySelectorAll(".benefits-grid, .bento, .steps, .vs")
    .forEach((grupo) => {
      [...grupo.querySelectorAll(":scope > .reveal")].forEach((el, i) => {
        el.style.transitionDelay = i * 80 + "ms";
      });
    });

  document.querySelectorAll(".chat .b").forEach((b, i) => {
    b.style.opacity = "0";
    b.style.transform = "translateY(8px)";
    b.style.transition = `opacity 0.4s ease ${0.25 + i * 0.35}s, transform 0.4s ease ${0.25 + i * 0.35}s`;
  });

  const obs = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        e.target.querySelectorAll(".chat .b").forEach((b) => {
          b.style.opacity = "1";
          b.style.transform = "none";
        });
        obs.unobserve(e.target);
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
  );
  items.forEach((i) => obs.observe(i));
}

function iniciarFaq() {
  const todas = [...document.querySelectorAll(".faq details")];
  todas.forEach((d) => {
    d.addEventListener("toggle", () => {
      if (!d.open) return;
      todas.forEach((o) => {
        if (o !== d) o.open = false;
      });
    });
  });
}

function iniciarCtaFijo() {
  const cta = document.getElementById("sticky-cta");
  const hero = document.getElementById("top");
  const cierre = document.getElementById("cierre");
  if (!cta || !hero || !("IntersectionObserver" in window)) return;

  let heroVisible = true;
  let cierreVisible = false;
  const actualizar = () =>
    cta.classList.toggle("show", !heroVisible && !cierreVisible);

  new IntersectionObserver((e) => {
    heroVisible = e[0].isIntersecting;
    actualizar();
  }).observe(hero);

  if (cierre) {
    new IntersectionObserver((e) => {
      cierreVisible = e[0].isIntersecting;
      actualizar();
    }).observe(cierre);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  configurarEnlaces();
  iniciarHero();
  iniciarPersonalizador();
  iniciarBloqueSheets();
  iniciarNavbar();
  iniciarReveal();
  iniciarFaq();
  iniciarCtaFijo();
});
