/**
 * --------------------------------------------------------------------------
 * CONFIGURACIÓN DE LA APLICACIÓN (SPA Y MASAJES)
 * --------------------------------------------------------------------------
 */
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQBeVtNlaMczwKWXPri41vv2nf_XalIozV9SNx5_pWY2hJDoAyf-QQWlNhAyHeSGCl7bPziYFfhMqPq/pub?output=csv";
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxdTMr1XZ6v4QnGqMVhrCw1u52Vy9g5eyZd-uaUelyQC4OlNUA5MDCQrTl7TewQm7zRBw/exec";

// Estos valores se sobrescriben con la pestaña CONFIGURACION (vía Apps Script)
let MESES_ADELANTE = 3;
const SEMANA_INICIA_EN = 0;
let MINUTOS_ANTICIPACION = 60;
const SERVICIOS_POR_TANDA = 30;

const MODO_DEMO = !APPS_SCRIPT_URL.startsWith("http");

const SERVICIOS_DEMO = [
  {
    id: "spa-1",
    nombre: "Masaje Relajante Sueco",
    descripcion: "Masaje de presión suave a moderada",
    precio: 650,
    duracion: 60,
    categoria: "Masajes",
    imagen:
      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=600&auto=format&fit=crop",
  },
  {
    id: "spa-2",
    nombre: "Masaje Descontracturante",
    descripcion: "Aplicación de presión firme enfocada",
    precio: 800,
    duracion: 60,
    categoria: "Masajes",
    imagen:
      "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?q=80&w=600&auto=format&fit=crop",
  },
];

const EMOJIS_CATEGORIA = {
  masajes: "💆",
  faciales: "✨",
  corporales: "🌿",
  general: "🗓️",
};

// --------------------------------------------------------------------------
// ESTADO GLOBAL
// --------------------------------------------------------------------------
let configWeb = { nombreNegocio: "", whatsapp: "", minutosCancelar: 120 };
let profesionalesHoja = []; // [{ norm, nombre }] en el orden de la hoja
let cantidadProfesionales = 0; // cuántas personas atienden (selector del personalizador)
let serviciosHoja = []; // todo lo que hay en la hoja de cálculo
let todosLosServicios = []; // solo las categorías que el cliente eligió
let categoriasActivas = new Set(); // categorías (normalizadas) elegidas
let serviciosFiltrados = [];
let categoriaActual = "todas";
let ordenPrecio = "ninguno";
let textoBusqueda = "";
let limiteVisible = SERVICIOS_POR_TANDA;
let temporizadorBusqueda = null;

// --------------------------------------------------------------------------
// UTILIDADES
// --------------------------------------------------------------------------
function normalizarTexto(texto) {
  if (!texto) return "";
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function escaparHTML(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseCSVRow(text) {
  let result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map((val) => val.replace(/^["'](.*)["']$/, "$1").trim());
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function claveFecha(anio, mes, dia) {
  return `${anio}-${pad2(mes + 1)}-${pad2(dia)}`;
}

function claveDeDate(fecha) {
  return claveFecha(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

function dateDesdeClave(clave) {
  const [a, m, d] = clave.split("-").map(Number);
  return new Date(a, m - 1, d);
}

function horaAMinutos(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutosAHora(min) {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}

function formatearHora(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const sufijo = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(m)} ${sufijo}`;
}

function formatearFechaLarga(clave) {
  const texto = dateDesdeClave(clave).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Columna DESCUENTO = precio con descuento (ej. precio 800, descuento 700).
// También acepta un porcentaje con el signo %: "20%". Vacío o inválido = sin descuento.
function resolverDescuento(base, valor) {
  const sin = { precio: base, precioOriginal: base, descuento: 0 };
  const texto = String(
    valor === undefined || valor === null ? "" : valor,
  ).trim();
  if (!texto || !(base > 0)) return sin;

  const esPorcentaje = texto.includes("%");
  let limpio = texto.replace(/[^\d.,]/g, "");
  limpio = /,\d{3}(?!\d)/.test(limpio)
    ? limpio.replace(/,/g, "")
    : limpio.replace(",", ".");
  const n = parseFloat(limpio);
  if (!Number.isFinite(n) || n <= 0) return sin;

  let final = base;
  if (esPorcentaje || n < 1) {
    // "20%" (o celda con formato de porcentaje, que llega como 0.2)
    const pct = esPorcentaje ? n : n * 100;
    if (pct >= 100) return sin;
    final = Math.round(base * (1 - pct / 100) * 100) / 100;
  } else if (n < base) {
    final = n; // precio con descuento
  } else {
    return sin; // un "descuento" igual o mayor al precio se ignora
  }

  return {
    precio: final,
    precioOriginal: base,
    descuento: (1 - final / base) * 100,
  };
}

// Con descuento: precio normal tachado + precio final. Sin descuento: solo el precio.
function htmlPrecio(servicio) {
  if (
    !(servicio.descuento > 0) ||
    !(servicio.precioOriginal > servicio.precio)
  ) {
    return formatearPrecio(servicio.precio);
  }
  const pct = Math.round(servicio.descuento);
  return `<span class="precio-wrap"><span class="precio-original"><s>${formatearPrecio(servicio.precioOriginal)}</s>${pct >= 1 ? `<span class="precio-chip">-${pct}%</span>` : ""}</span><span class="precio-final">${formatearPrecio(servicio.precio)}</span></span>`;
}

function formatearPrecio(precio) {
  const n = parseFloat(precio) || 0;
  if (n <= 0) return "Sin costo";
  return "$" + n.toLocaleString("es-MX", { maximumFractionDigits: 2 }) + " MXN";
}

function formatearDuracion(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

function imagenSegura(url) {
  return /^https?:\/\//i.test(url || "") ? url : "";
}

// --------------------------------------------------------------------------
// CARGA DE CATÁLOGO
// --------------------------------------------------------------------------
async function cargarCatalogo() {
  const contenedor = document.getElementById("catalogo");
  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="loading-container" style="grid-column: 1/-1; text-align: center; padding: 40px;">
      <div class="spinner"></div>
      <p>Cargando servicios...</p>
    </div>
  `;

  const promesaConfig = cargarConfiguracion();

  try {
    if (!SHEET_CSV_URL.startsWith("http")) {
      serviciosHoja = SERVICIOS_DEMO.map((s) => ({ ...s }));
    } else {
      const response = await fetch(SHEET_CSV_URL + "&t=" + Date.now());
      if (!response.ok) throw new Error("Error al conectar con Google Sheets");
      const data = await response.text();

      const lineas = data.split(/\r?\n/).filter((l) => l.trim() !== "");
      if (lineas.length < 2) throw new Error("La hoja no tiene servicios");

      const cabeceras = parseCSVRow(lineas[0]).map(
        (h) =>
          normalizarTexto(h).replace(/[^a-z0-9]+/g, "_") || "columna_vacia",
      );

      serviciosHoja = lineas
        .slice(1)
        .map((linea, index) => {
          const row = parseCSVRow(linea);
          const f = {};
          cabeceras.forEach((clave, i) => (f[clave] = row[i] || ""));

          const estado = normalizarTexto(f.activo || f.estado || "activo");
          const inactivo = ["inactivo", "no", "false", "0"].includes(estado);

          const desc = f.descripcion || f.nombre || "Servicio sin descripción";
          const nombreGenerado =
            desc.split(" ").slice(0, 4).join(" ") || "Tratamiento Spa";

          return {
            id: f.id || `spa-${index + 1}`,
            nombre: f.nombre || nombreGenerado,
            descripcion: desc,
            ...resolverDescuento(parseFloat(f.precio) || 0, f.descuento),
            duracion:
              parseInt(
                f.duracion_mi || f.duracion_min || f.duracion || "0",
                10,
              ) || 0,
            categoria: f.categoria || "Masajes",
            imagen: imagenSegura(f.imagen_url || f.imagen),
            profesionales: parsearProfesionales(
              f.profesionales || f.profesional,
            ),
            inactivo,
          };
        })
        .filter((s) => s.descripcion && s.duracion > 0 && !s.inactivo);
    }

    await promesaConfig;
    prepararCatalogo();
    configurarBusqueda();
  } catch (error) {
    console.error("Error al cargar el catálogo:", error);
    contenedor.innerHTML = `<p class="mensaje-error" style="grid-column: 1/-1; text-align: center; color: var(--danger); padding: 40px;">No pudimos cargar los servicios desde la hoja. Usando modo de respaldo.</p>`;
    await promesaConfig;
    serviciosHoja = [...SERVICIOS_DEMO];
    prepararCatalogo();
    configurarBusqueda();
  }
}

// --------------------------------------------------------------------------
// CONFIGURACIÓN (viene de la pestaña CONFIGURACION vía Apps Script)
// --------------------------------------------------------------------------
async function cargarConfiguracion() {
  if (MODO_DEMO) return;
  try {
    const resp = await fetch(`${APPS_SCRIPT_URL}?action=configuracion`);
    if (!resp.ok) throw new Error("Respuesta inválida del servidor");
    const data = await resp.json();
    if (!data.ok || !data.config) return;

    const c = data.config;
    if (c.nombreNegocio) configWeb.nombreNegocio = String(c.nombreNegocio);
    if (c.whatsapp) configWeb.whatsapp = String(c.whatsapp);
    if (Number.isFinite(c.mesesAdelante)) MESES_ADELANTE = c.mesesAdelante;
    if (Number.isFinite(c.anticipacionMin))
      MINUTOS_ANTICIPACION = c.anticipacionMin;
    if (Number.isFinite(c.minutosCancelar))
      configWeb.minutosCancelar = c.minutosCancelar;
  } catch (error) {
    console.warn(
      "No se pudo leer la configuración, se usan valores por defecto:",
      error,
    );
  }
}

function nombreNegocio() {
  return configWeb.nombreNegocio || "Sanctuary Spa";
}

function aplicarNombreNegocio() {
  const nombre = nombreNegocio();
  document.title = `${nombre} | Reserva de Servicios`;
  const logo = document.getElementById("logo-brand");
  if (logo) logo.textContent = nombre;
  const pie = document.getElementById("footer-nombre");
  if (pie) pie.textContent = nombre;
}

// --------------------------------------------------------------------------
// PROFESIONALES (columna PROFESIONALES de la hoja)
// --------------------------------------------------------------------------
const MAX_PROFESIONALES = 5;
const CLAVE_PROFESIONALES = "spa-profesionales-demo";

// "Fer, Ana," -> ["Fer", "Ana"] (ignora vacíos, repetidos y comas sobrantes)
function parsearProfesionales(texto) {
  const vistos = new Set();
  const lista = [];
  String(texto || "")
    .split(/[,;\n]+/)
    .map((n) => n.trim())
    .filter(Boolean)
    .forEach((n) => {
      const k = normalizarTexto(n);
      if (!vistos.has(k)) {
        vistos.add(k);
        lista.push(n);
      }
    });
  return lista;
}

function calcularProfesionalesHoja() {
  const mapa = new Map();
  serviciosHoja.forEach((s) => {
    (s.profesionales || []).forEach((n) => {
      const k = normalizarTexto(n);
      if (!mapa.has(k)) mapa.set(k, n);
    });
  });
  profesionalesHoja = [...mapa].map(([norm, nombre]) => ({ norm, nombre }));
}

function maxProfesionalesSelector() {
  return Math.min(MAX_PROFESIONALES, profesionalesHoja.length);
}

function iniciarCantidadProfesionales() {
  const max = maxProfesionalesSelector();
  let guardado = 0;
  try {
    guardado = parseInt(localStorage.getItem(CLAVE_PROFESIONALES) || "0", 10);
  } catch (e) {}
  // Sin selección guardada se activan todos los profesionales de la hoja (hasta 5)
  cantidadProfesionales = guardado >= 1 && guardado <= max ? guardado : max;
}

function cambiarCantidadProfesionales(n) {
  cantidadProfesionales = n;
  try {
    localStorage.setItem(CLAVE_PROFESIONALES, String(n));
  } catch (e) {}
  renderizarSelectorProfesionales();
}

function renderizarSelectorProfesionales() {
  const seccion = document.getElementById("seccion-profesionales");
  const cont = document.getElementById("profesionales-lista");
  if (!seccion || !cont) return;

  const max = maxProfesionalesSelector();
  seccion.hidden = max === 0;
  if (max === 0) return;

  cont.innerHTML = "";
  for (let n = 1; n <= max; n++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "btn-num-opt" + (n === cantidadProfesionales ? " active" : "");
    btn.setAttribute("aria-pressed", n === cantidadProfesionales);
    btn.textContent = n;
    btn.addEventListener("click", () => cambiarCantidadProfesionales(n));
    cont.appendChild(btn);
  }

  const info = document.getElementById("profesionales-info");
  if (info) {
    info.textContent =
      cantidadProfesionales === 1
        ? "Atiende solo el dueño: la página no pregunta con quién."
        : `Se podrá elegir entre ${cantidadProfesionales} personas.`;
  }
}

function profesionalesActivos() {
  return profesionalesHoja.slice(0, cantidadProfesionales);
}

// Profesionales activos que realizan este servicio ([] = usa el calendario general)
function candidatosDeServicio(servicio) {
  if (cantidadProfesionales <= 1) return [];
  const delServicio = new Set(
    (servicio.profesionales || []).map(normalizarTexto),
  );
  return profesionalesActivos()
    .filter((p) => delServicio.has(p.norm))
    .map((p) => p.nombre);
}

// --------------------------------------------------------------------------
// CATEGORÍAS ELEGIDAS EN EL PERSONALIZADOR
// --------------------------------------------------------------------------
const CLAVE_CATEGORIAS = "spa-categorias-demo";

function categoriasDeLaHoja() {
  // Devuelve [{ norm, nombre }] sin repetir, en el orden de la hoja
  const mapa = new Map();
  serviciosHoja.forEach((s) => {
    const nombre = (s.categoria || "General").trim();
    const norm = normalizarTexto(nombre);
    if (!mapa.has(norm)) mapa.set(norm, nombre);
  });
  return [...mapa].map(([norm, nombre]) => ({ norm, nombre }));
}

function prepararCatalogo() {
  aplicarNombreNegocio();
  calcularProfesionalesHoja();
  iniciarCantidadProfesionales();
  renderizarSelectorProfesionales();

  const disponibles = categoriasDeLaHoja().map((c) => c.norm);

  let guardadas = [];
  try {
    guardadas = JSON.parse(localStorage.getItem(CLAVE_CATEGORIAS) || "[]");
  } catch (e) {}

  const validas = guardadas.filter((n) => disponibles.includes(n));
  categoriasActivas = new Set(validas.length ? validas : disponibles);

  renderizarCategoriasPersonalizador();
  aplicarCategoriasActivas();
}

function aplicarCategoriasActivas() {
  todosLosServicios = serviciosHoja.filter((s) =>
    categoriasActivas.has(normalizarTexto(s.categoria || "General")),
  );

  // Si el filtro actual ya no existe, volver a "todas"
  if (categoriaActual !== "todas" && !categoriasActivas.has(categoriaActual)) {
    categoriaActual = "todas";
  }

  poblarMenuCategoriasDinamico();
  filtrarYRenderizar();
}

function guardarCategoriasActivas() {
  try {
    localStorage.setItem(
      CLAVE_CATEGORIAS,
      JSON.stringify([...categoriasActivas]),
    );
  } catch (e) {}
}

function alternarCategoriaActiva(norm) {
  if (categoriasActivas.has(norm)) {
    // Siempre debe quedar al menos una categoría
    if (categoriasActivas.size === 1) return;
    categoriasActivas.delete(norm);
  } else {
    categoriasActivas.add(norm);
  }
  guardarCategoriasActivas();
  renderizarCategoriasPersonalizador();
  aplicarCategoriasActivas();
}

function seleccionarTodasLasCategorias() {
  categoriasActivas = new Set(categoriasDeLaHoja().map((c) => c.norm));
  guardarCategoriasActivas();
  renderizarCategoriasPersonalizador();
  aplicarCategoriasActivas();
}

function renderizarCategoriasPersonalizador() {
  const cont = document.getElementById("categorias-lista");
  if (!cont) return;

  cont.innerHTML = "";
  categoriasDeLaHoja().forEach(({ norm, nombre }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "btn-cat-opt" + (categoriasActivas.has(norm) ? " active" : "");
    btn.setAttribute("aria-pressed", categoriasActivas.has(norm));
    btn.innerHTML = `<span class="cat-check">${categoriasActivas.has(norm) ? "✓" : ""}</span><span>${escaparHTML(nombre)}</span>`;
    btn.addEventListener("click", () => alternarCategoriaActiva(norm));
    cont.appendChild(btn);
  });
}

function poblarMenuCategoriasDinamico() {
  const cont = document.getElementById("dynamic-categories-list");
  if (!cont) return;

  // Solo las categorías elegidas en el personalizador (aunque la hoja tenga más)
  const categorias = categoriasDeLaHoja()
    .filter((c) => categoriasActivas.has(c.norm))
    .map((c) => c.nombre);

  cont.innerHTML = "";
  const opciones = [
    ["todas", "Todas las categorías"],
    ...categorias.map((c) => [c, c]),
  ];

  opciones.forEach(([valor, texto]) => {
    const norm = valor === "todas" ? "todas" : normalizarTexto(valor);
    const div = document.createElement("div");
    div.className =
      "filter-option" + (categoriaActual === norm ? " active" : "");
    div.textContent = texto;
    div.addEventListener("click", () => seleccionarCategoriaFiltro(valor));
    cont.appendChild(div);
  });
}

function toggleFilterMenu(event) {
  event.stopPropagation();
  const dropdown = document.getElementById("filter-dropdown");
  if (dropdown) dropdown.classList.toggle("show");
}

window.addEventListener("click", () => {
  const dropdown = document.getElementById("filter-dropdown");
  if (dropdown && dropdown.classList.contains("show")) {
    dropdown.classList.remove("show");
  }
});

function seleccionarCategoriaFiltro(cat) {
  categoriaActual = cat === "todas" ? "todas" : normalizarTexto(cat);
  poblarMenuCategoriasDinamico();
  const dropdown = document.getElementById("filter-dropdown");
  if (dropdown) dropdown.classList.remove("show");
  filtrarYRenderizar();
}

function aplicarOrdenamiento(orden) {
  ordenPrecio = orden;
  const dropdown = document.getElementById("filter-dropdown");
  if (dropdown) dropdown.classList.remove("show");
  filtrarYRenderizar();
}

function filtrarYRenderizar() {
  let filtrados = [...todosLosServicios];

  if (categoriaActual !== "todas") {
    filtrados = filtrados.filter(
      (s) => normalizarTexto(s.categoria) === categoriaActual,
    );
  }

  if (textoBusqueda.trim() !== "") {
    const q = normalizarTexto(textoBusqueda);
    filtrados = filtrados.filter(
      (s) =>
        normalizarTexto(s.nombre).includes(q) ||
        normalizarTexto(s.descripcion).includes(q) ||
        normalizarTexto(s.categoria).includes(q),
    );
  }

  if (ordenPrecio === "menor-mayor") {
    filtrados.sort((a, b) => a.precio - b.precio);
  } else if (ordenPrecio === "mayor-menor") {
    filtrados.sort((a, b) => b.precio - a.precio);
  }

  serviciosFiltrados = filtrados;
  limiteVisible = SERVICIOS_POR_TANDA;
  renderizarServicios(filtrados);
}

function verMasServicios() {
  const desde = limiteVisible;
  limiteVisible += SERVICIOS_POR_TANDA;
  renderizarServicios(serviciosFiltrados, desde);
}

function configurarBusqueda() {
  const input = document.getElementById("search-input");
  if (input && !input.dataset.listo) {
    input.dataset.listo = "1";
    input.addEventListener("input", (e) => {
      textoBusqueda = e.target.value;
      clearTimeout(temporizadorBusqueda);
      temporizadorBusqueda = setTimeout(filtrarYRenderizar, 300);
    });
  }
}

function renderizarServicios(servicios, desde = 0) {
  const contenedor = document.getElementById("catalogo");
  if (!contenedor) return;

  if (desde === 0) contenedor.innerHTML = "";

  const botonViejo = contenedor.querySelector(".ver-mas-container");
  if (botonViejo) botonViejo.remove();

  if (servicios.length === 0) {
    contenedor.innerHTML = `<p class="mensaje-vacio" style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">No se encontraron servicios.</p>`;
    return;
  }

  servicios.slice(desde, limiteVisible).forEach((s) => {
    const card = document.createElement("div");
    card.className = "producto-card servicio-card";

    const media = s.imagen
      ? `<img src="${escaparHTML(s.imagen)}" alt="${escaparHTML(s.nombre)}" loading="lazy">`
      : `<div class="servicio-placeholder" aria-hidden="true">🌿</div>`;

    card.innerHTML = `
      <div class="card-image-container">
        ${media}
        <span class="card-category">${escaparHTML(s.categoria || "General")}</span>
      </div>
      <div class="card-content-body">
        <h3 class="card-title">${escaparHTML(s.nombre)}</h3>
        ${s.descripcion ? `<p class="card-desc">${escaparHTML(s.descripcion)}</p>` : ""}
        <p class="servicio-duracion">⏱ ${formatearDuracion(s.duracion)}</p>
      </div>
      <div class="card-footer">
        <span class="card-price">${htmlPrecio(s)}</span>
        <button class="btn-add-cart-main" onclick="abrirAgenda('${s.id}')">Agendar cita</button>
      </div>
    `;

    const img = card.querySelector(".card-image-container img");
    if (img) {
      img.addEventListener("error", () => {
        const ph = document.createElement("div");
        ph.className = "servicio-placeholder";
        ph.setAttribute("aria-hidden", "true");
        ph.textContent = "🌿";
        img.replaceWith(ph);
      });
    }

    contenedor.appendChild(card);
  });

  const restantes = servicios.length - limiteVisible;
  if (restantes > 0) {
    const cont = document.createElement("div");
    cont.className = "ver-mas-container";
    cont.style.gridColumn = "1 / -1";
    cont.style.textAlign = "center";
    cont.style.padding = "20px 0";
    cont.innerHTML = `<button class="btn-ver-mas" onclick="verMasServicios()" style="background:var(--primary);color:var(--on-primary);border:none;padding:10px 20px;border-radius:var(--radius-sm);cursor:pointer;">Ver más servicios <span>(${restantes} restantes)</span></button>`;
    contenedor.appendChild(cont);
  }

  observarTarjetasEnVista();
}

// --------------------------------------------------------------------------
// DISPONIBILIDAD Y CALENDARIO
// --------------------------------------------------------------------------
const cacheDisponibilidad = {};
const reservasDemo = [];

function hashSimple(texto) {
  let h = 0;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function generarDisponibilidadDemo(servicio, anio, mes) {
  const dias = {};
  const totalDias = new Date(anio, mes + 1, 0).getDate();

  for (let d = 1; d <= totalDias; d++) {
    const clave = claveFecha(anio, mes, d);
    const diaSemana = new Date(anio, mes, d).getDay();
    const h = hashSimple(clave);

    if (diaSemana === 0) continue;

    const ocupados = [[840, 900]];
    reservasDemo
      .filter((r) => r.fecha === clave)
      .forEach((r) => ocupados.push([r.inicio, r.fin]));

    const slots = [];
    for (let ini = 540; ini + servicio.duracion <= 1080; ini += 30) {
      const fin = ini + servicio.duracion;
      const choca = ocupados.some(([a, b]) => ini < b && fin > a);
      if (!choca) slots.push(minutosAHora(ini));
    }
    if (slots.length) dias[clave] = slots;
  }
  return dias;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedirDisponibilidad(servicio, anio, mes, profesionales = []) {
  const claveMes = `${anio}-${pad2(mes + 1)}`;
  const claveProf = profesionales.length
    ? profesionales.map(normalizarTexto).join("+")
    : "general";
  const claveCache = `${servicio.id}|${claveMes}|${claveProf}`;
  if (cacheDisponibilidad[claveCache]) return cacheDisponibilidad[claveCache];

  let dias;
  if (MODO_DEMO) {
    await esperar(500);
    dias = generarDisponibilidadDemo(servicio, anio, mes);
  } else {
    const profParam = profesionales.length
      ? `&profesionales=${encodeURIComponent(profesionales.join(","))}`
      : "";
    const url = `${APPS_SCRIPT_URL}?action=disponibilidad&servicio=${encodeURIComponent(servicio.id)}&mes=${claveMes}${profParam}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Respuesta inválida del servidor");
    const data = await resp.json();
    if (!data.ok)
      throw new Error(data.error || "No se pudo consultar el calendario");
    dias = data.dias || {};
  }

  cacheDisponibilidad[claveCache] = dias;
  return dias;
}

async function enviarReserva(datos) {
  if (MODO_DEMO) {
    await esperar(800);
    const duracion = reserva.servicio.duracion;
    const inicio = horaAMinutos(datos.hora);
    reservasDemo.push({ fecha: datos.fecha, inicio, fin: inicio + duracion });
    return { ok: true };
  }

  const resp = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "reservar", ...datos }),
  });
  if (!resp.ok) throw new Error("Respuesta inválida del servidor");
  return await resp.json();
}

function invalidarCacheServicio(idServicio) {
  Object.keys(cacheDisponibilidad)
    .filter((k) => k.startsWith(idServicio + "|"))
    .forEach((k) => delete cacheDisponibilidad[k]);
}

// --------------------------------------------------------------------------
// MODAL DE AGENDA
// --------------------------------------------------------------------------
let reserva = null;

const NOMBRES_MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const LETRAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];

function slotsDelDia(clave) {
  const lista = (reserva.dias && reserva.dias[clave]) || [];
  const ahora = new Date();
  const hoy = claveDeDate(ahora);
  if (clave < hoy) return [];
  if (clave > hoy) return lista;
  const minAhora =
    ahora.getHours() * 60 + ahora.getMinutes() + MINUTOS_ANTICIPACION;
  return lista.filter((h) => horaAMinutos(h) >= minAhora);
}

function abrirAgenda(idServicio) {
  const servicio = todosLosServicios.find((s) => s.id === idServicio);
  if (!servicio) return;

  const hoy = new Date();
  const candidatos = candidatosDeServicio(servicio);

  reserva = {
    servicio,
    candidatos, // profesionales activos que hacen este servicio
    profesionales: [], // los que se envían al calendario ([] = calendario general)
    profLabel: "",
    anio: hoy.getFullYear(),
    mes: hoy.getMonth(),
    dias: null,
    estado: "cargando",
    dia: null,
    hora: null,
    peticion: 0,
  };

  document.getElementById("booking-title").textContent = "Agendar cita";
  document.getElementById("booking-body").scrollTop = 0;
  document.getElementById("booking-modal").style.display = "flex";

  if (candidatos.length >= 2) {
    // Varias personas pueden hacerlo: primero se elige con quién
    mostrarSelectorProfesional();
    return;
  }

  // 0 o 1 profesional: no hay nada que preguntar
  reserva.profesionales = candidatos;
  reserva.profLabel = candidatos[0] || "";
  iniciarCalendario();
}

function mostrarSelectorProfesional() {
  const s = reserva.servicio;
  const body = document.getElementById("booking-body");

  body.innerHTML = `
    <div class="ag-servicio">
      <div class="ag-servicio-info">
        <strong>${escaparHTML(s.nombre)}</strong>
        <span>⏱ ${formatearDuracion(s.duracion)}</span>
      </div>
      <span class="ag-precio">${htmlPrecio(s)}</span>
    </div>
    <h3 class="prof-titulo">¿Con quién quieres tu cita?</h3>
    <div id="prof-grid" class="prof-grid"></div>
  `;

  const grid = document.getElementById("prof-grid");

  const crearTarjeta = (nombre, etiqueta, inicial, clase) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "prof-card" + (clase ? " " + clase : "");
    btn.innerHTML = `<span class="prof-avatar">${escaparHTML(inicial)}</span><span class="prof-nombre">${escaparHTML(etiqueta)}</span>`;
    btn.addEventListener("click", () => elegirProfesional(nombre));
    grid.appendChild(btn);
  };

  reserva.candidatos.forEach((nombre) =>
    crearTarjeta(nombre, nombre, nombre.charAt(0).toUpperCase(), ""),
  );
  crearTarjeta(null, "Cualquiera disponible", "✨", "prof-card-cualquiera");
}

function elegirProfesional(nombre) {
  if (nombre) {
    reserva.profesionales = [nombre];
    reserva.profLabel = nombre;
  } else {
    reserva.profesionales = [...reserva.candidatos];
    reserva.profLabel = "Cualquiera disponible";
  }
  iniciarCalendario();
}

function iniciarCalendario() {
  const servicio = reserva.servicio;

  reserva.dias = null;
  reserva.estado = "cargando";
  reserva.dia = null;
  reserva.hora = null;

  const lineaProf = reserva.profLabel
    ? `<span>👤 ${escaparHTML(reserva.profLabel)}${
        reserva.candidatos.length >= 2
          ? ' <button type="button" id="ag-cambiar-prof" class="ag-cambiar-prof">Cambiar</button>'
          : ""
      }</span>`
    : "";

  const body = document.getElementById("booking-body");
  body.scrollTop = 0;
  body.innerHTML = `
    <div class="pc-booking-grid">
      <div>
        <div class="ag-servicio">
          <div class="ag-servicio-info">
            <strong>${escaparHTML(servicio.nombre)}</strong>
            <span>⏱ ${formatearDuracion(servicio.duracion)}</span>
            ${lineaProf}
          </div>
          <span class="ag-precio">${htmlPrecio(servicio)}</span>
        </div>
        <div id="ag-calendario" class="ag-calendario"></div>
      </div>
      <div>
        <div id="ag-horarios" class="ag-horarios"></div>
        <form id="ag-form" class="order-form ag-form" hidden novalidate>
          <h3 style="font-size:0.95rem;margin-bottom:8px;color:var(--accent-text);">Tus datos de contacto</h3>
          <p id="ag-resumen-cita" class="ag-resumen-cita" style="font-size:0.85rem;color:var(--text-muted);margin-bottom:10px;font-weight:600;"></p>
          <input type="text" id="nombre-cliente" placeholder="Tu nombre completo" required class="form-input" autocomplete="name" />
          <input type="tel" id="telefono-cliente" placeholder="Teléfono de contacto" required class="form-input" autocomplete="tel" />
          <input type="email" id="correo-cliente" placeholder="Correo electrónico" required class="form-input" autocomplete="email" />
          <p id="ag-error" class="ag-error" style="color:var(--danger);font-size:0.8rem;margin-bottom:8px;" hidden></p>
          <button type="submit" id="ag-confirmar" class="btn-submit-order">Confirmar cita</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById("ag-form").addEventListener("submit", confirmarCita);
  const cambiar = document.getElementById("ag-cambiar-prof");
  if (cambiar) cambiar.addEventListener("click", mostrarSelectorProfesional);

  cargarMesVisible();
}

function cerrarAgenda() {
  document.getElementById("booking-modal").style.display = "none";
  reserva = null;
}

async function cargarMesVisible() {
  const token = ++reserva.peticion;
  reserva.estado = "cargando";
  reserva.dias = null;
  renderizarCalendario();

  try {
    const dias = await pedirDisponibilidad(
      reserva.servicio,
      reserva.anio,
      reserva.mes,
      reserva.profesionales,
    );
    if (!reserva || token !== reserva.peticion) return;
    reserva.dias = dias;
    reserva.estado = "listo";
  } catch (error) {
    console.error("Error al consultar disponibilidad:", error);
    if (!reserva || token !== reserva.peticion) return;
    reserva.estado = "error";
  }
  renderizarCalendario();
}

function cambiarMes(delta) {
  const nuevo = new Date(reserva.anio, reserva.mes + delta, 1);
  reserva.anio = nuevo.getFullYear();
  reserva.mes = nuevo.getMonth();
  limpiarSeleccion();
  cargarMesVisible();
}

function limpiarSeleccion() {
  reserva.dia = null;
  reserva.hora = null;
  renderizarHorarios();
  const form = document.getElementById("ag-form");
  if (form) form.hidden = true;
}

function renderizarCalendario() {
  const cont = document.getElementById("ag-calendario");
  if (!cont || !reserva) return;

  const hoy = new Date();
  const indiceActual = hoy.getFullYear() * 12 + hoy.getMonth();
  const indiceVisible = reserva.anio * 12 + reserva.mes;
  const puedeIrAtras = indiceVisible > indiceActual;
  const puedeIrAdelante = indiceVisible < indiceActual + MESES_ADELANTE;

  let html = `
    <div class="cal-header">
      <button type="button" class="cal-nav" id="cal-prev" ${puedeIrAtras ? "" : "disabled"}>‹</button>
      <span class="cal-titulo">${NOMBRES_MESES[reserva.mes]} ${reserva.anio}</span>
      <button type="button" class="cal-nav" id="cal-next" ${puedeIrAdelante ? "" : "disabled"}>›</button>
    </div>
    <div class="cal-semana">
  `;
  for (let i = 0; i < 7; i++) {
    html += `<span>${LETRAS_SEMANA[(i + SEMANA_INICIA_EN) % 7]}</span>`;
  }
  html += `</div><div class="cal-grid ${reserva.estado === "cargando" ? "cargando" : ""}">`;

  const primerDiaSemana = new Date(reserva.anio, reserva.mes, 1).getDay();
  const blancos = (primerDiaSemana - SEMANA_INICIA_EN + 7) % 7;
  for (let i = 0; i < blancos; i++) html += `<span class="cal-vacio"></span>`;

  const totalDias = new Date(reserva.anio, reserva.mes + 1, 0).getDate();
  const claveHoy = claveDeDate(hoy);

  for (let d = 1; d <= totalDias; d++) {
    const clave = claveFecha(reserva.anio, reserva.mes, d);
    const disponible =
      reserva.estado === "listo" && slotsDelDia(clave).length > 0;
    const clases = ["cal-dia"];
    if (disponible) clases.push("disponible");
    if (clave === claveHoy) clases.push("hoy");
    if (clave === reserva.dia) clases.push("seleccionado");
    html += `<button type="button" class="${clases.join(" ")}" data-fecha="${clave}" ${disponible ? "" : "disabled"}>${d}</button>`;
  }
  html += `</div>`;

  if (reserva.estado === "cargando") {
    html += `<div class="cal-estado" style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;font-size:0.85rem;color:var(--text-muted);"><div class="spinner spinner-mini" style="width:16px;height:16px;border-width:2px;"></div><span>Consultando disponibilidad...</span></div>`;
  } else if (reserva.estado === "error") {
    html += `<div class="cal-estado cal-estado-error" style="margin-top:12px;text-align:center;color:var(--danger);font-size:0.85rem;"><span>Error al consultar el calendario.</span><button type="button" id="cal-reintentar" style="margin-left:8px;padding:2px 8px;cursor:pointer;">Reintentar</button></div>`;
  } else if (
    !Object.keys(reserva.dias || {}).some((k) => slotsDelDia(k).length > 0)
  ) {
    html += `<p class="cal-estado" style="margin-top:12px;text-align:center;font-size:0.85rem;color:var(--text-muted);">No hay horarios disponibles este mes.</p>`;
  } else if (!reserva.dia) {
    html += `<p class="cal-estado" style="margin-top:12px;text-align:center;font-size:0.85rem;color:var(--text-muted);">Elige un día disponible para ver las horas.</p>`;
  }

  cont.innerHTML = html;

  const prev = document.getElementById("cal-prev");
  const next = document.getElementById("cal-next");
  if (prev) prev.addEventListener("click", () => cambiarMes(-1));
  if (next) next.addEventListener("click", () => cambiarMes(1));
  const reintentar = document.getElementById("cal-reintentar");
  if (reintentar) {
    reintentar.addEventListener("click", () => {
      invalidarCacheServicio(reserva.servicio.id);
      cargarMesVisible();
    });
  }
  cont.querySelectorAll(".cal-dia.disponible").forEach((btn) => {
    btn.addEventListener("click", () => seleccionarDia(btn.dataset.fecha));
  });
}

function seleccionarDia(clave) {
  reserva.dia = clave;
  reserva.hora = null;
  const form = document.getElementById("ag-form");
  if (form) form.hidden = true;
  renderizarCalendario();
  renderizarHorarios();
}

function renderizarHorarios() {
  const cont = document.getElementById("ag-horarios");
  if (!cont || !reserva) return;

  if (!reserva.dia) {
    cont.innerHTML = "";
    return;
  }

  const slots = slotsDelDia(reserva.dia);
  const manana = slots.filter((h) => horaAMinutos(h) < 720);
  const tarde = slots.filter((h) => horaAMinutos(h) >= 720);

  const grupo = (titulo, lista) =>
    lista.length === 0
      ? ""
      : `<div class="hor-grupo" style="margin-bottom:12px;">
           <span class="hor-titulo" style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:6px;">${titulo}</span>
           <div class="hor-lista">
             ${lista.map((h) => `<button type="button" class="hor-btn ${h === reserva.hora ? "seleccionado" : ""}" data-hora="${h}">${formatearHora(h)}</button>`).join("")}
           </div>
         </div>`;

  cont.innerHTML = `
    <h3 class="hor-dia" style="font-size:0.95rem;font-weight:600;color:var(--accent-text);margin-bottom:12px;">${formatearFechaLarga(reserva.dia)}</h3>
    ${slots.length === 0 ? `<p class="hor-vacio" style="font-size:0.85rem;color:var(--text-muted);">No quedan horarios este día.</p>` : ""}
    ${grupo("Mañana", manana)}
    ${grupo("Tarde", tarde)}
  `;

  cont.querySelectorAll(".hor-btn").forEach((btn) => {
    btn.addEventListener("click", () => seleccionarHora(btn.dataset.hora));
  });
}

function seleccionarHora(hora) {
  reserva.hora = hora;
  renderizarHorarios();

  const form = document.getElementById("ag-form");
  const resumen = document.getElementById("ag-resumen-cita");
  if (resumen)
    resumen.textContent = `${formatearFechaLarga(reserva.dia)} a las ${formatearHora(hora)}`;
  mostrarErrorAgenda("");
  if (form) form.hidden = false;
}

function mostrarErrorAgenda(mensaje) {
  const el = document.getElementById("ag-error");
  if (!el) return;
  el.textContent = mensaje;
  el.hidden = !mensaje;
}

async function confirmarCita(event) {
  event.preventDefault();
  if (!reserva || !reserva.dia || !reserva.hora) return;

  const inputNombre = document.getElementById("nombre-cliente");
  const inputTelefono = document.getElementById("telefono-cliente");
  const inputCorreo = document.getElementById("correo-cliente");

  [inputNombre, inputTelefono, inputCorreo].forEach((i) =>
    i.setCustomValidity(""),
  );

  if (!inputNombre.value.trim()) {
    inputNombre.setCustomValidity("Introduce tu nombre.");
    inputNombre.reportValidity();
    return;
  }

  const telefonoLimpio = inputTelefono.value.trim().replace(/\D/g, "");
  if (telefonoLimpio.length < 10) {
    inputTelefono.setCustomValidity(
      "Introduce un teléfono válido (10 dígitos).",
    );
    inputTelefono.reportValidity();
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(inputCorreo.value.trim())) {
    inputCorreo.setCustomValidity("Introduce un correo válido.");
    inputCorreo.reportValidity();
    return;
  }

  const datos = {
    servicio: reserva.servicio.id,
    profesionales: reserva.profesionales,
    fecha: reserva.dia,
    hora: reserva.hora,
    nombre: inputNombre.value.trim(),
    telefono: inputTelefono.value.trim(),
    correo: inputCorreo.value.trim(),
  };

  const boton = document.getElementById("ag-confirmar");
  boton.disabled = true;
  boton.textContent = "Reservando...";
  mostrarErrorAgenda("");

  try {
    const resultado = await enviarReserva(datos);

    if (resultado.ok) {
      invalidarCacheServicio(reserva.servicio.id);
      mostrarConfirmacion(datos, resultado);
      return;
    }

    if (resultado.error === "ocupado") {
      mostrarErrorAgenda("Ese horario acaba de ser reservado. Elige otro.");
      invalidarCacheServicio(reserva.servicio.id);
      reserva.hora = null;
      await cargarMesVisible();
      renderizarHorarios();
      const form = document.getElementById("ag-form");
      if (form) form.hidden = true;
      return;
    }

    mostrarErrorAgenda(resultado.error || "No se pudo agendar la cita.");
  } catch (error) {
    console.error("Error al reservar:", error);
    mostrarErrorAgenda("No pudimos conectar con el servidor.");
  }

  boton.disabled = false;
  boton.textContent = "Confirmar cita";
}

function mostrarConfirmacion(datos, resultado) {
  const s = reserva.servicio;
  const fechaTexto = formatearFechaLarga(datos.fecha);
  const horaTexto = formatearHora(datos.hora);
  const minutos = (resultado && resultado.minutos) || 3;
  const profAsignado =
    (resultado && resultado.profesional) || reserva.profLabel;
  const conProf =
    profAsignado && profAsignado !== "Cualquiera disponible"
      ? ` con <strong>${escaparHTML(profAsignado)}</strong>`
      : "";

  const body = document.getElementById("booking-body");
  body.innerHTML = `
    <div class="ag-exito" style="text-align:center;padding:10px 0;">
      <h3 style="font-size:1.2rem;margin-bottom:8px;color:var(--accent-text);">¡Casi listo! Confirma tu cita</h3>
      <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:16px;">
        Reservamos temporalmente <strong>${escaparHTML(s.nombre)}</strong>${conProf} el <strong>${fechaTexto}</strong> a las <strong>${horaTexto}</strong>.
        Te enviamos un correo a <strong>${escaparHTML(datos.correo)}</strong>: presiona el botón de confirmación en los próximos <strong>${minutos} minutos</strong> o el horario se liberará automáticamente.
      </p>
      <button type="button" class="btn-submit-order" onclick="cerrarAgenda()">Entendido</button>
    </div>
  `;
}

// --------------------------------------------------------------------------
// MODALES LEGALES
// --------------------------------------------------------------------------
function cerrarDetalles() {
  const modal = document.getElementById("details-modal");
  if (modal) modal.style.display = "none";
}

function textoTiempoCancelar() {
  const min = configWeb.minutosCancelar;
  if (min >= 60 && min % 60 === 0)
    return min / 60 === 1 ? "1 hora" : `${min / 60} horas`;
  return `${min} minutos`;
}

function abrirPoliticas() {
  const titleEl = document.getElementById("detail-title");
  const bodyEl = document.getElementById("detail-body");
  if (!titleEl || !bodyEl) return;

  titleEl.textContent = "Políticas de Privacidad";
  bodyEl.innerHTML = `
    <div class="legal-content" style="font-size:0.9rem;color:var(--text-muted);line-height:1.6;">
      <p>Tus datos personales son recabados con el único fin de gestionar la administración de tu cita en ${escaparHTML(nombreNegocio())} y mantener comunicación directa sobre tus servicios.</p>
    </div>
  `;
  document.getElementById("details-modal").style.display = "flex";
}

function abrirTerminos() {
  const titleEl = document.getElementById("detail-title");
  const bodyEl = document.getElementById("detail-body");
  if (!titleEl || !bodyEl) return;

  titleEl.textContent = "Términos y Condiciones";
  bodyEl.innerHTML = `
    <div class="legal-content" style="font-size:0.9rem;color:var(--text-muted);line-height:1.6;">
      <p>Las cancelaciones o reprogramaciones de citas deben solicitarse con un mínimo de ${textoTiempoCancelar()} de anticipación para asegurar la disponibilidad del espacio.</p>
    </div>
  `;
  document.getElementById("details-modal").style.display = "flex";
}

// --------------------------------------------------------------------------
// SELECTOR DE PERSONALIZACIÓN (TEMAS Y CARDS INDEPENDIENTES)
// --------------------------------------------------------------------------
const TEMA_INICIAL = "boutique";
const CARD_INICIAL = "framed";

const CLAVE_TEMA = "spa-tema-demo";
const CLAVE_CARD = "spa-card-demo";
const CLAVE_MODO = "spa-modo-demo";
const MODO_INICIAL = "claro";
let modoActual = MODO_INICIAL;

const TEMAS = [
  {
    id: "boutique",
    nombre: "Crema",
    claro: { bg: "#f6efe6", accent: "#8a6a4f" },
    oscuro: { bg: "#1c1713", accent: "#c9a27e" },
  },
  {
    id: "coquette",
    nombre: "Rosa Coquette",
    claro: { bg: "#fff5f8", accent: "#e0568f" },
    oscuro: { bg: "#1f0f17", accent: "#f472a8" },
  },
  {
    id: "lavanda",
    nombre: "Lavanda Relax",
    claro: { bg: "#f5f3ff", accent: "#7c3aed" },
    oscuro: { bg: "#150f2a", accent: "#a78bfa" },
  },
  {
    id: "menta",
    nombre: "Menta & Bambú",
    claro: { bg: "#f0fdf4", accent: "#16a34a" },
    oscuro: { bg: "#0b1a12", accent: "#4ade80" },
  },
  {
    id: "glow",
    nombre: "Glow Peach",
    claro: { bg: "#fff7ed", accent: "#ea580c" },
    oscuro: { bg: "#1f1209", accent: "#fb923c" },
  },
  {
    id: "zen",
    nombre: "Zen Minimal",
    claro: { bg: "#f3f2ed", accent: "#4b5a47" },
    oscuro: { bg: "#14170f", accent: "#a3b18a" },
  },
  {
    id: "oceano",
    nombre: "Azul Océano",
    claro: { bg: "#eef5ff", accent: "#2563eb" },
    oscuro: { bg: "#08142b", accent: "#60a5fa" },
  },
  {
    id: "sol",
    nombre: "Amarillo Sol",
    claro: { bg: "#fff9db", accent: "#eab308" },
    oscuro: { bg: "#1c1604", accent: "#facc15" },
  },
  {
    id: "turquesa",
    nombre: "Turquesa",
    claro: { bg: "#effdfa", accent: "#0d9488" },
    oscuro: { bg: "#061f1d", accent: "#2dd4bf" },
  },
  {
    id: "candy",
    nombre: "Candy Pop",
    claro: { bg: "#fdf4ff", accent: "#c026d3" },
    oscuro: { bg: "#1d0a24", accent: "#e879f9" },
  },
  {
    id: "editorial",
    nombre: "Editorial",
    claro: { bg: "#ffffff", accent: "#111111" },
    oscuro: { bg: "#0d0d0d", accent: "#f5f5f5" },
  },
  {
    id: "rubi",
    nombre: "Rubí",
    claro: { bg: "#fff1f2", accent: "#e11d48" },
    oscuro: { bg: "#1f0a0f", accent: "#fb7185" },
  },
];

const CARDS = [
  { id: "framed", nombre: "Enmarcada", desc: "Bordes suaves y marco interno" },
  {
    id: "coquette",
    nombre: "Punteada",
    desc: "Línea de puntos y estilo tierno",
  },
  { id: "lavanda", nombre: "Doble Sección", desc: "Divisor punteado inferior" },
  {
    id: "menta",
    nombre: "Orgánica",
    desc: "Estructura limpia con bordes verdes",
  },
  {
    id: "glow",
    nombre: "Floating Badge",
    desc: "Tarjeta flotante con botón inferior",
  },
  {
    id: "zen",
    nombre: "Sin Bordes",
    desc: "Mínimo contraste y texto centrado",
  },
  {
    id: "aurora",
    nombre: "Cristal Glass",
    desc: "Panel de cristal sobre la imagen",
  },
  {
    id: "candy",
    nombre: "Imagen Circular",
    desc: "Forma de burbuja y diseño centrado",
  },
  {
    id: "editorial",
    nombre: "Línea Superior",
    desc: "Línea divisoria estilo prensa",
  },
  {
    id: "dorado",
    nombre: "Marco Doble",
    desc: "Borde interno de acento dorado",
  },
  {
    id: "escarcha",
    nombre: "Cristal Escarcha",
    desc: "Marco translúcido con imagen completa",
  },
  {
    id: "neon",
    nombre: "Cristal Neón",
    desc: "Cristal con borde luminoso",
  },
];

function aplicarTema(id, guardar = true) {
  const tema = TEMAS.find((t) => t.id === id);
  if (!tema) return;

  document.documentElement.dataset.estilo = tema.id;

  if (guardar) {
    try {
      localStorage.setItem(CLAVE_TEMA, tema.id);
    } catch (e) {}
  }

  document.querySelectorAll(".btn-tema-opt").forEach((b) => {
    b.classList.toggle("active", b.dataset.tema === tema.id);
  });
}

function aplicarModo(modo, guardar = true) {
  if (modo !== "claro" && modo !== "oscuro") return;

  modoActual = modo;
  document.documentElement.dataset.modo = modo;

  if (guardar) {
    try {
      localStorage.setItem(CLAVE_MODO, modo);
    } catch (e) {}
  }

  document.querySelectorAll(".btn-modo-opt").forEach((b) => {
    b.classList.toggle("active", b.dataset.modo === modo);
  });

  // Los cuadros de color muestran la versión del modo elegido
  renderizarTemas();
}

function aplicarCard(id, guardar = true) {
  const card = CARDS.find((c) => c.id === id);
  if (!card) return;

  document.documentElement.dataset.card = card.id;

  if (guardar) {
    try {
      localStorage.setItem(CLAVE_CARD, card.id);
    } catch (e) {}
  }

  document.querySelectorAll(".btn-card-opt").forEach((b) => {
    b.classList.toggle("active", b.dataset.card === card.id);
  });
}

function renderizarTemas() {
  const contTemas = document.getElementById("temas-lista");
  if (!contTemas) return;

  const activo = document.documentElement.dataset.estilo;
  contTemas.innerHTML = TEMAS.map((t) => {
    const col = t[modoActual] || t.claro;
    return `
      <button type="button" class="btn-tema-opt${t.id === activo ? " active" : ""}" data-tema="${t.id}" title="${escaparHTML(t.nombre)}" aria-label="${escaparHTML(t.nombre)}" style="--tema-bg:${col.bg};--tema-acento:${col.accent}" onclick="aplicarTema('${t.id}')">
        <span class="swatch-color" style="background:${col.bg}; border-color:${col.accent}"></span>
        <span>${escaparHTML(t.nombre)}</span>
      </button>
    `;
  }).join("");
}

function renderizarOpcionesPersonalizacion() {
  const contCards = document.getElementById("cards-lista");

  renderizarTemas();

  if (contCards) {
    contCards.innerHTML = CARDS.map(
      (c) => `
      <button type="button" class="btn-card-opt" data-card="${c.id}" onclick="aplicarCard('${c.id}')">
        <strong>${escaparHTML(c.nombre)}</strong>
        <small>${escaparHTML(c.desc)}</small>
      </button>
    `,
    ).join("");
  }
}

function initPersonalizador() {
  renderizarOpcionesPersonalizacion();

  const temaGuardado = (() => {
    try {
      return localStorage.getItem(CLAVE_TEMA) || TEMA_INICIAL;
    } catch (e) {
      return TEMA_INICIAL;
    }
  })();

  const cardGuardada = (() => {
    try {
      return localStorage.getItem(CLAVE_CARD) || CARD_INICIAL;
    } catch (e) {
      return CARD_INICIAL;
    }
  })();

  const modoGuardado = (() => {
    try {
      return localStorage.getItem(CLAVE_MODO) || MODO_INICIAL;
    } catch (e) {
      return MODO_INICIAL;
    }
  })();

  aplicarModo(modoGuardado, false);
  aplicarTema(temaGuardado, false);
  aplicarCard(cardGuardada, false);
}

function cerrarSeccionesCustomizer() {
  document.querySelectorAll(".customizer-section").forEach((s) => {
    s.classList.remove("abierta");
    const b = s.querySelector(".acc-header");
    if (b) b.setAttribute("aria-expanded", "false");
  });
}

// Abre una fila del personalizador y cierra las demás
function alternarSeccion(boton) {
  const seccion = boton.closest(".customizer-section");
  if (!seccion) return;
  const abrir = !seccion.classList.contains("abierta");

  cerrarSeccionesCustomizer();

  if (abrir) {
    seccion.classList.add("abierta");
    boton.setAttribute("aria-expanded", "true");
  }
}

function toggleCustomizer() {
  const sidebar = document.getElementById("customizer-sidebar");
  if (!sidebar) return;

  const abierto = sidebar.classList.toggle("open");
  document.body.classList.toggle("customizer-abierto", abierto);

  // En celular, al cerrar la barra también se cierra la bandeja abierta
  if (!abierto && window.matchMedia("(max-width: 767px)").matches) {
    cerrarSeccionesCustomizer();
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const detailsModal = document.getElementById("details-modal");
  const bookingModal = document.getElementById("booking-modal");
  const customizerSidebar = document.getElementById("customizer-sidebar");

  if (detailsModal && detailsModal.style.display === "flex") {
    cerrarDetalles();
  } else if (bookingModal && bookingModal.style.display === "flex") {
    cerrarAgenda();
  } else if (
    customizerSidebar &&
    customizerSidebar.classList.contains("open")
  ) {
    toggleCustomizer();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  cargarCatalogo();
  initPersonalizador();
});

let observadorEfectoFoto = null;

function observarTarjetasEnVista() {
  const tarjetas = document.querySelectorAll("#catalogo .producto-card");

  if (!("IntersectionObserver" in window)) {
    tarjetas.forEach((c) => c.classList.add("en-vista"));
    return;
  }

  if (observadorEfectoFoto) observadorEfectoFoto.disconnect();
  observadorEfectoFoto = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((e) =>
        e.target.classList.toggle("en-vista", e.isIntersecting),
      );
    },
    { rootMargin: "-30% 0px -30% 0px", threshold: 0 },
  );
  tarjetas.forEach((c) => observadorEfectoFoto.observe(c));
}
