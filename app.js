// ==========================================================================
// 1. CONFIGURACIÓN E INICIALIZACIÓN DE APIS (RED Y GEOLOCALIZACIÓN)
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    obtenerContextoRedYFisico();
    listarEquipos();

    const formulario = document.getElementById("inventory-form");
    formulario.addEventListener("submit", guardarNuevoEquipo);
});

function obtenerContextoRedYFisico() {
    const metricUbicacion = document.getElementById("metric-ubicacion");
    const metricNetwork = document.getElementById("metric-network");

    fetch("https://ipapi.co/json/")
        .then(response => {
            if (!response.ok) throw new Error("No se pudo conectar con la API de red");
            return response.json();
        })
        .then(data => {
            metricNetwork.innerHTML = `IP: <strong>${data.ip}</strong><br>Proveedor: ${data.org}`;
            metricUbicacion.innerText = `${data.city}, ${data.country_name}`;
            solicitarGeolocalizacionExacta(data.city);
        })
        .catch(error => {
            console.error("Error en Fetch de red:", error);
            metricNetwork.innerText = "Error al detectar red (Sin internet o Bloqueado)";
            solicitarGeolocalizacionExacta("Desconocida");
        });
}

function solicitarGeolocalizacionExacta(ciudadIP) {
    const metricUbicacion = document.getElementById("metric-ubicacion");

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude.toFixed(4);
                const lon = position.coords.longitude.toFixed(4);
                
                let sedeAsignada = "Sede Externa / Remota";
                // Lógica de proximidad simulada para El Salvador
                if (lat >= 13.60 && lat <= 13.95 && lon >= -89.50 && lon <= -89.15) {
                    sedeAsignada = "Sede Central (San Salvador / Opico)";
                }
                
                metricUbicacion.innerHTML = `<strong>${sedeAsignada}</strong><br><small>Coordenadas: ${lat}, ${lon}</small>`;
            },
            (error) => {
                console.warn("Permiso de ubicación denegado.");
                metricUbicacion.innerHTML = `<strong>Sede: ${ciudadIP}</strong><br><small>(Permiso GPS denegado)</small>`;
            }
        );
    } else {
        metricUbicacion.innerText = "Geolocalización no soportada";
    }
}

// ==========================================================================
// 2. ESTRUCTURA DEL CRUD Y MANEJO DE LOCALSTORAGE
// ==========================================================================

let inventario = [];

try {
    const datosLocales = localStorage.getItem("it_inventario");
    inventario = datosLocales ? JSON.parse(datosLocales) : [];
} catch (error) {
    console.error("Error al cargar datos desde LocalStorage:", error);
    inventario = [];
}

function guardarNuevoEquipo(event) {
    event.preventDefault();

    try {
        const tag = document.getElementById("asset-tag").value.trim();
        const tipo = document.getElementById("asset-type").value;
        const marca = document.getElementById("asset-brand").value.trim();
        const modelo = document.getElementById("asset-model").value.trim();
        const estado = document.getElementById("asset-status").value;

        const existe = inventario.some(equipo => equipo.id === tag);
        if (existe) {
            alert("Error: Ya existe un equipo registrado con ese Tag / Número de Serie.");
            return;
        }

        const nuevoEquipo = {
            id: tag,
            tipo: tipo,
            marca: marca,
            modelo: modelo,
            estado: estado,
            ubicacion: document.getElementById("metric-ubicacion").innerText.split('\n')[0]
        };

        inventario.push(nuevoEquipo);
        localStorage.setItem("it_inventario", JSON.stringify(inventario));
        document.getElementById("inventory-form").reset();
        listarEquipos();
        alert("Equipo registrado con éxito.");

    } catch (error) {
        console.error("Error crítico al guardar el equipo:", error);
    }
}

function listarEquipos() {
    const tbody = document.getElementById("inventory-tbody");
    tbody.innerHTML = "";

    if (inventario.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #7f8c8d;">No hay equipos registrados.</td></tr>`;
        document.getElementById("metric-total").innerText = "0";
        document.getElementById("metric-mantenimiento").innerText = "0";
        return;
    }

    inventario.forEach(equipo => {
        const fila = document.createElement("tr");
        let claseBadge = "activo";
        if (equipo.estado === "Mantenimiento") claseBadge = "mantenimiento";
        if (equipo.estado === "Baja") claseBadge = "baja";

        fila.innerHTML = `
            <td><strong>${equipo.id}</strong></td>
            <td>${equipo.tipo}</td>
            <td>${equipo.marca} ${equipo.modelo}</td>
            <td><span class="badge ${claseBadge}">${equipo.estado}</span></td>
            <td><small>${equipo.ubicacion}</small></td>
            <td>
                <button class="btn-action btn-edit" style="background-color: #2980b9; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Editar</button>
                <button class="btn-action btn-delete" style="background-color: #c0392b; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Eliminar</button>
            </td>
        `;
        tbody.appendChild(fila);
    });

    // ==========================================================================
    // DELEGACIÓN DE TRABAJO AL WEB WORKER
    // ==========================================================================
    if (window.Worker) {
        // Inicializar el worker apuntando a nuestro archivo local
        const miWorker = new Worker("worker.js");

        // Le mandamos el arreglo de inventario actual para que haga las cuentas
        miWorker.postMessage(inventario);

        // Escuchamos cuando el worker termine de calcular y nos devuelva los totales
        miWorker.onmessage = function(event) {
            const metricas = event.data;
            
            // Inyectamos los resultados calculados por el worker en el Dashboard
            document.getElementById("metric-total").innerText = metricas.totalEquipos;
            document.getElementById("metric-mantenimiento").innerText = metricas.mantenimientoEquipos;
            
            // Terminar el worker para liberar memoria en la laptop
            miWorker.terminate();
        };
    } else {
        // Plan de respaldo si el navegador es demasiado antiguo y no soporta Workers
        document.getElementById("metric-total").innerText = inventario.length;
        document.getElementById("metric-mantenimiento").innerText = inventario.filter(e => e.estado === "Mantenimiento").length;
    }
}