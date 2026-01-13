// script.js
// ==========================
// 🔹 SCRIPT PRINCIPAL - TIENDA
// ==========================

import { db } from "./firebase.js";
import {
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

import { crearVenta } from "./ventas.js";

/* ======================================================
   🔧 UTILIDADES
====================================================== */

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function cleanString(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function ensureArray(arr) {
  return Array.isArray(arr) ? arr : [];
}

function escapeQuotes(text) {
  return cleanString(text).replace(/'/g, "\\'");
}

/* ======================================================
   🔹 ESTADO GLOBAL
====================================================== */

let tragos = [];
let promos = [];
let comidas = [];

let cart = [];
let currentSection = "tragos";

/* ======================================================
   🔹 INICIALIZACIÓN CARRITO
====================================================== */

function cargarCarritoLocal() {
  try {
    const stored = JSON.parse(localStorage.getItem("carrito"));
    cart = ensureArray(stored);
  } catch {
    cart = [];
  }
  actualizarCartCount();
}

cargarCarritoLocal();

/* ======================================================
   🔹 CARGA FIRESTORE EN TIEMPO REAL
====================================================== */

function cargarDesdeFirestore() {
  onSnapshot(collection(db, "tragos"), (snapshot) => {
    tragos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (currentSection === "tragos") cargarProductos(tragos);
  });

  onSnapshot(collection(db, "promos"), (snapshot) => {
    promos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (currentSection === "promos") cargarProductos(promos);
  });

  onSnapshot(collection(db, "comidas"), (snapshot) => {
    comidas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (currentSection === "comidas") cargarProductos(comidas);
  });
}

cargarDesdeFirestore();

/* ======================================================
   🔹 NAVEGACIÓN
====================================================== */

window.mostrarSeccion = function (tipo) {
  currentSection = tipo;
  if (tipo === "tragos") cargarProductos(tragos);
  if (tipo === "promos") cargarProductos(promos);
  if (tipo === "comidas") cargarProductos(comidas);
};

/* ======================================================
   🔹 RENDER PRODUCTOS
====================================================== */

const drinkList = document.getElementById("drinkList");

function cargarProductos(lista) {
  drinkList.innerHTML = "";

  ensureArray(lista).forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "drink-card";
    card.style.animationDelay = `${index * 0.1}s`;

    const nombre = cleanString(item.nombre) || "Producto";
    const precio = toNumber(item.precio);
    const imagen = cleanString(item.imagen) || "img/default.jpg";

    card.innerHTML = `
      <img src="${imagen}" alt="${nombre}">
      <div class="drink-card-content">
        <h3>${nombre}</h3>
        <p>$${precio}</p>
        <button onclick="agregarCarrito('${escapeQuotes(nombre)}', ${precio}, '${escapeQuotes(imagen)}')">
          Agregar 🛒
        </button>
      </div>
    `;

    drinkList.appendChild(card);
  });
}

/* ======================================================
   🔹 CARRITO
====================================================== */

window.agregarCarrito = function (nombre, precio, imagen) {
  cart.push({
    nombre: cleanString(nombre),
    precio: toNumber(precio),
    imagen: cleanString(imagen)
  });

  persistirCarrito();
  animarCarrito();
  openCart();
};

function persistirCarrito() {
  localStorage.setItem("carrito", JSON.stringify(cart));
  actualizarCartCount();
  mostrarCarrito();
}

function actualizarCartCount() {
  const el = document.getElementById("cartCount");
  if (el) el.textContent = cart.length;
}

function mostrarCarrito() {
  const cartItems = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");

  if (!cartItems || !cartTotal) return;

  cartItems.innerHTML = "";
  let total = 0;

  cart.forEach((item, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <img src="${item.imagen || "img/default.jpg"}" class="cart-img">
      <span>${item.nombre}</span>
      <span>$${item.precio}</span>
      <button class="remove-btn" onclick="eliminarItem(${index})">✕</button>
    `;
    cartItems.appendChild(li);
    total += toNumber(item.precio);
  });

  cartTotal.textContent = total;
}

window.eliminarItem = function (index) {
  cart.splice(index, 1);
  persistirCarrito();
};

/* ======================================================
   🔹 MODAL CARRITO
====================================================== */

window.openCart = function () {
  const modal = document.getElementById("cartModal");
  if (modal) modal.style.display = "block";
  mostrarCarrito();
};

window.closeCart = function () {
  const modal = document.getElementById("cartModal");
  if (modal) modal.style.display = "none";
};

function animarCarrito() {
  const icon = document.querySelector(".cart-icon");
  if (!icon) return;
  icon.classList.add("animate");
  setTimeout(() => icon.classList.remove("animate"), 600);
}

window.toggleDeliveryFields = function () {
  const delivery = document.getElementById("deliveryMethod")?.value;
  const fields = document.getElementById("deliveryFields");
  if (!fields) return;

  fields.style.display =
    delivery === "Envío a domicilio" ? "block" : "none";
};

/* ======================================================
   🔹 FINALIZAR PEDIDO
====================================================== */

window.finalizarPedido = async function () {
  if (cart.length === 0) {
    alert("El carrito está vacío");
    return;
  }

  const metodo = document.getElementById("paymentMethod")?.value || "Efectivo";
  const entrega = document.getElementById("deliveryMethod")?.value || "Retiro";

  const direccion = cleanString(document.getElementById("direccion")?.value);
  const telefono = cleanString(document.getElementById("telefono")?.value);

  if (entrega === "Envío a domicilio" && !direccion) {
    alert("⚠️ Tenés que ingresar una dirección.");
    return;
  }

  const total = cart.reduce((a, b) => a + toNumber(b.precio), 0);

  let pedidoId = null;
  try {
    pedidoId = await crearVenta({
      productos: cart,
      total,
      telefono,
      direccion: entrega === "Envío a domicilio" ? direccion : "Retiro",
      metodo,
      entrega
    });
  } catch (e) {
    console.error("Error guardando venta:", e);
  }

  // WhatsApp
  let mensaje = `📦 *NUEVO PEDIDO*%0A%0A`;
  if (pedidoId) mensaje += `🆔 Pedido: ${pedidoId}%0A%0A`;

  cart.forEach(p => {
    mensaje += `- ${p.nombre}: $${p.precio}%0A`;
  });

  mensaje += `%0A*Total:* $${total}%0A`;
  mensaje += `*Pago:* ${metodo}%0A`;
  mensaje += `*Entrega:* ${entrega}%0A`;

  if (entrega === "Envío a domicilio") {
    mensaje += `*Dirección:* ${direccion}%0A`;
    mensaje += `*Teléfono:* ${telefono}%0A`;
  }

  window.open(
    `https://wa.me/?text=${mensaje}`,
    "_blank"
  );

  // limpiar
  cart = [];
  persistirCarrito();
  closeCart();
};
