let modoEdicion = false;
let idEnEdicion = null;
let inventario = [];

document.addEventListener("DOMContentLoaded", () => {
    verificarTemaGuardado();
    recuperarFiltroSesion(); // Carga filtro si se recarga la pestaña
    obtenerContextoRedYFisico();
    listarEquipos();

    const formulario = document.getElementById("inventory-form");
    if (formulario) {
        formulario.addEventListener("submit", procesarFormulario);
    }

    const searchInput = document.getElementById("search-input");
    const filterStatus = document.getElementById("filter-status");
    const excelFile = document.getElementById("excel-file");

    if (searchInput) searchInput.addEventListener("input", filtrarInventario);
    if (filterStatus) filterStatus.addEventListener("change", filtrarInventario);
    if (excelFile) excelFile.addEventListener("change", importarDesdeExcel);

    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) themeToggle.addEventListener("click", alternarModoNoche);
});

// Geolocalización + Fetch a la API de clima externo
function obtenerContextoRedYFisico() {
    const metricUbicacion = document.getElementById("metric-ubicacion");
    const metricNetwork = document.getElementById("metric-network");

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                let sedeAsignada = "Sede Externa / Remota";
                
                // Rango de coordenadas para validar si está en la planta central
                if (lat >= 13.60 && lat <= 13.95 && lon >= -89.50 && lon <= -89.15) {
                    sedeAsignada = "Sede Central (San Salvador / Opico)";
                }
                
                // Petición fetch a Open-Meteo para sacar clima local en vivo
                fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
                    .then(response => {
                        if (!response.ok) throw new Error("Error en API de clima");
                        return response.json();
                    })
                    .then(data => {
                        const temp = data.current_weather.temperature;
                        const windspeed = data.current_weather.windspeed;
                        
                        metricNetwork.innerHTML = `IP: <strong>192.168.1.100</strong><br>Clima Auditoría: <strong>${temp}°C</strong>, Viento a ${windspeed} km/h`;
                        metricUbicacion.innerHTML = `<strong>${sedeAsignada}</strong><br><small>Coordenadas: ${lat.toFixed(4)}, ${lon.toFixed(4)}</small>`;
                    })
                    .catch(error => {
                        console.error("Fallo en Fetch de clima:", error);
                        metricNetwork.innerHTML = "IP: <strong>192.168.1.100</strong><br>ISP: Enlace Real (API offline)";
                        metricUbicacion.innerHTML = `<strong>${sedeAsignada}</strong><br><small>Coordenadas: ${lat.toFixed(4)}, ${lon.toFixed(4)}</small>`;
                    });
            },
            (error) => {
                console.warn("GPS denegado, usando fallback:", error);
                metricNetwork.innerHTML = "IP: <strong>192.168.1.254</strong><br>ISP: Red Local SIT";
                metricUbicacion.innerHTML = "<strong>Sede Central (Opico)</strong><br><small>Ubicación por defecto (Desarrollo)</small>";
            }
        );
    } else {
        metricNetwork.innerHTML = "IP: <strong>192.168.1.254</strong><br>ISP: Red Local SIT";
        metricUbicacion.innerHTML = "<strong>Sede Central (Opico)</strong><br><small>Geolocalización no soportada</small>";
    }
}

// Carga inicial desde LocalStorage con manejo de excepciones
try {
    const datosLocales = localStorage.getItem("it_inventario");
    inventario = datosLocales ? JSON.parse(datosLocales) : [];
} catch (error) {
    console.error("Error al leer LocalStorage:", error);
    inventario = [];
}

function procesarFormulario(event) {
    event.preventDefault();
    if (modoEdicion) {
        actualizarEquipoRegistrado(idEnEdicion);
    } else {
        guardarNuevoEquipo();
    }
}

function guardarNuevoEquipo() {
    try {
        const tag = document.getElementById("asset-tag").value.trim();
        const tipo = document.getElementById("asset-type").value;
        const marca = document.getElementById("asset-brand").value.trim();
        const modelo = document.getElementById("asset-model").value.trim();
        const estado = document.getElementById("asset-status").value;

        if (inventario.some(equipo => equipo.id === tag)) {
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
        console.error("Error al guardar equipo:", error);
    }
}

function listarEquipos() {
    const tbody = document.getElementById("inventory-tbody");
    if (!tbody) return;
    
    tbody.innerHTML = "";

    if (inventario.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #7f8c8d;">No hay equipos registrados.</td></tr>`;
        document.getElementById("metric-total").innerText = "0";
        document.getElementById("metric-mantenimiento").innerText = "0";
        return;
    }

    // Filtros combinados de búsqueda por texto y estado
    const textoBusqueda = document.getElementById("search-input").value.toLowerCase().trim();
    const estadoSeleccionado = document.getElementById("filter-status").value;

    const inventarioMostrar = inventario.filter(equipo => {
        const coincideTexto = equipo.id.toLowerCase().includes(textoBusqueda) ||
                              equipo.marca.toLowerCase().includes(textoBusqueda) ||
                              equipo.modelo.toLowerCase().includes(textoBusqueda);
        const coincideEstado = (estadoSeleccionado === "Todos") || (equipo.estado === estadoSeleccionado);
        return coincideTexto && coincideEstado;
    });

    if (inventarioMostrar.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #7f8c8d;">No se encontraron activos.</td></tr>`;
    }

    inventarioMostrar.forEach(equipo => {
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
                <button class="btn-action btn-edit" style="background-color: #2980b9; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; margin-right: 4px;" onclick="cargarParaEditar('${equipo.id}')">Editar</button>
                <button class="btn-action btn-delete" style="background-color: #c0392b; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" onclick="eliminarEquipo('${equipo.id}')">Eliminar</button>
            </td>
        `;
        tbody.appendChild(fila);
    });

    // Delegación del cálculo de métricas pesadas al Web Worker
    if (window.Worker) {
        const miWorker = new Worker("worker.js");
        miWorker.postMessage(inventario);

        miWorker.onmessage = function(event) {
            const metricas = event.data;
            document.getElementById("metric-total").innerText = metricas.totalEquipos;
            document.getElementById("metric-mantenimiento").innerText = metricas.mantenimientoEquipos;
        };
        miWorker.onerror = function(error) {
            console.error("Error en Web Worker:", error);
        };
    } else {
        document.getElementById("metric-total").innerText = inventario.length;
        document.getElementById("metric-mantenimiento").innerText = inventario.filter(e => e.estado === "Mantenimiento").length;
    }
}

function eliminarEquipo(id) {
    if (modoEdicion && idEnEdicion === id) {
        restaurarFormularioOriginal();
    }

    if (confirm(`¿Está seguro de que desea eliminar el equipo con Tag: ${id}?`)) {
        try {
            inventario = inventario.filter(equipo => equipo.id !== id);
            localStorage.setItem("it_inventario", JSON.stringify(inventario));
            listarEquipos();
            alert("Equipo eliminado del inventario correctamente.");
        } catch (error) {
            console.error("Error al eliminar equipo:", error);
        }
    }
}

function cargarParaEditar(id) {
    try {
        const equipo = inventario.find(e => e.id === id);
        if (!equipo) throw new Error("Equipo no encontrado.");

        modoEdicion = true;
        idEnEdicion = id;

        document.getElementById("asset-tag").value = equipo.id;
        document.getElementById("asset-tag").disabled = true; 
        
        document.getElementById("asset-type").value = equipo.tipo;
        document.getElementById("asset-brand").value = equipo.marca;
        document.getElementById("asset-model").value = equipo.modelo;
        document.getElementById("asset-status").value = equipo.estado;

        document.getElementById("form-title").innerText = "Modificar Activo Tecnológico";
        document.getElementById("btn-submit").innerText = "Actualizar Cambios";
        
        const btnCancel = document.getElementById("btn-cancel");
        if (btnCancel) btnCancel.style.display = "inline-block";
    } catch (error) {
        console.error("Error al cargar datos en formulario:", error);
    }
}

function actualizarEquipoRegistrado(id) {
    try {
        const index = inventario.findIndex(e => e.id === id);
        if (index !== -1) {
            inventario[index].tipo = document.getElementById("asset-type").value;
            inventario[index].marca = document.getElementById("asset-brand").value.trim();
            inventario[index].modelo = document.getElementById("asset-model").value.trim();
            inventario[index].estado = document.getElementById("asset-status").value;

            localStorage.setItem("it_inventario", JSON.stringify(inventario));
            restaurarFormularioOriginal();
            listarEquipos();
            alert("Activo tecnológico actualizado con éxito.");
        }
    } catch (error) {
        console.error("Error al actualizar datos:", error);
    }
}

function restaurarFormularioOriginal() {
    modoEdicion = false;
    idEnEdicion = null;

    const formulario = document.getElementById("inventory-form");
    if (formulario) formulario.reset();
    
    const assetTag = document.getElementById("asset-tag");
    if (assetTag) assetTag.disabled = false;
    
    document.getElementById("form-title").innerText = "Registrar Nuevo Activo";
    document.getElementById("btn-submit").innerText = "Guardar Equipo";
    
    const btnCancel = document.getElementById("btn-cancel");
    if (btnCancel) btnCancel.style.display = "none";
}

// Guarda filtros en SessionStorage para retener estado temporal
function filtrarInventario() {
    const textoBusqueda = document.getElementById("search-input").value;
    const estadoSeleccionado = document.getElementById("filter-status").value;
    
    sessionStorage.setItem("sit_ultimo_filtro_texto", textoBusqueda);
    sessionStorage.setItem("sit_ultimo_filtro_estado", estadoSeleccionado);
    
    listarEquipos();
}

function recuperarFiltroSesion() {
    const filtroTextoGuardado = sessionStorage.getItem("sit_ultimo_filtro_texto");
    const filtroEstadoGuardado = sessionStorage.getItem("sit_ultimo_filtro_estado");
    
    if (filtroTextoGuardado) {
        document.getElementById("search-input").value = filtroTextoGuardado;
    }
    if (filtroEstadoGuardado) {
        document.getElementById("filter-status").value = filtroEstadoGuardado;
    }
}

function alternarModoNoche() {
    const body = document.body;
    const btn = document.getElementById("theme-toggle");
    body.classList.toggle("dark-mode");

    if (body.classList.contains("dark-mode")) {
        localStorage.setItem("tema_sistema", "oscuro");
        if (btn) {
            btn.innerHTML = "☀️ Modo Claro";
            btn.style.backgroundColor = "#f1c40f";
            btn.style.color = "#2c3e50";
        }
    } else {
        localStorage.setItem("tema_sistema", "claro");
        if (btn) {
            btn.innerHTML = "🌙 Modo Noche";
            btn.style.backgroundColor = "#34495e";
            btn.style.color = "white";
        }
    }
}

function verificarTemaGuardado() {
    const temaGuardado = localStorage.getItem("tema_sistema");
    const body = document.body;
    const btn = document.getElementById("theme-toggle");

    if (temaGuardado === "oscuro") {
        body.classList.add("dark-mode");
        if (btn) {
            btn.innerHTML = "☀️ Modo Claro";
            btn.style.backgroundColor = "#f1c40f";
            btn.style.color = "#2c3e50";
        }
    }
}

// Lógica de importación asíncrona de archivos Excel con SheetJS
function importarDesdeExcel(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = function(e) {
        try {
            const datosBinarios = e.target.result;
            const libroTrabajo = XLSX.read(datosBinarios, { type: 'binary' });
            const nombreHoja = libroTrabajo.SheetNames[0];
            const hoja = libroTrabajo.Sheets[nombreHoja];
            const filasExcel = XLSX.utils.sheet_to_json(hoja);

            if (filasExcel.length === 0) {
                alert("El archivo de Excel está vacío.");
                return;
            }

            let registradosNuevos = 0;
            let duplicadosOmitidos = 0;
            const ubicacionActual = document.getElementById("metric-ubicacion").innerText.split('\n')[0];

            filasExcel.forEach(fila => {
                const tag = fila.id ? String(fila.id).trim() : '';
                const tipo = fila.tipo ? String(fila.tipo).trim() : 'Laptop';
                const marca = fila.marca ? String(fila.marca).trim() : '';
                const modelo = fila.modelo ? String(fila.modelo).trim() : '';
                const estado = fila.estado ? String(fila.estado).trim() : 'Activo';

                if (!tag) return;

                if (!inventario.some(equipo => equipo.id === tag)) {
                    inventario.push({
                        id: tag,
                        tipo: tipo,
                        marca: marca,
                        modelo: modelo,
                        estado: estado,
                        ubicacion: ubicacionActual
                    });
                    registradosNuevos++;
                } else {
                    duplicadosOmitidos++;
                }
            });

            localStorage.setItem("it_inventario", JSON.stringify(inventario));
            listarEquipos();
            event.target.value = "";

            alert(`Proceso completado:\n\n✅ Agregados: ${registradosNuevos}\n⚠️ Duplicados omitidos: ${duplicadosOmitidos}`);
        } catch (error) {
            console.error("Error al parsear Excel:", error);
            alert("Error crítico al procesar el archivo. Revisa la consola (F12).");
        }
    };
    lector.readAsBinaryString(archivo);
}