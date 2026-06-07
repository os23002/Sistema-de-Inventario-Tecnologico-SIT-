// ==========================================================================
// 1. CONFIGURACIÓN E INICIALIZACIÓN DE APIS Y TEMAS
// ==========================================================================

let modoEdicion = false;
let idEnEdicion = null;

document.addEventListener("DOMContentLoaded", () => {
    verificarTemaGuardado();
    obtenerContextoRedYFisico();
    listarEquipos();

    const formulario = document.getElementById("inventory-form");
    if (formulario) {
        formulario.addEventListener("submit", procesarFormulario);
    }

    // Aseguramos la captura de los elementos de filtrado e importación
    const searchInput = document.getElementById("search-input");
    const filterStatus = document.getElementById("filter-status");
    const excelFile = document.getElementById("excel-file");

    if (searchInput) searchInput.addEventListener("input", filtrarInventario);
    if (filterStatus) filterStatus.addEventListener("change", filtrarInventario);
    
    // NUEVO: Escuchador verificado para la importación masiva de Excel
    if (excelFile) {
        excelFile.addEventListener("change", importarDesdeExcel);
    }

    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) themeToggle.addEventListener("click", alternarModoNoche);
});

function obtenerContextoRedYFisico() {
    const metricUbicacion = document.getElementById("metric-ubicacion");
    const metricNetwork = document.getElementById("metric-network");

    // PASO 1: Intentar jalar el GPS real directamente por seguridad local
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude.toFixed(4);
                const lon = position.coords.longitude.toFixed(4);
                
                let sedeAsignada = "Sede Externa / Remota";
                // Evaluamos tu geocerca perimetral
                if (lat >= 13.60 && lat <= 13.95 && lon >= -89.50 && lon <= -89.15) {
                    sedeAsignada = "Sede Central (San Salvador / Opico)";
                }
                
                metricNetwork.innerHTML = "IP: <strong>192.168.1.100</strong><br>ISP: Enlace Local Real";
                metricUbicacion.innerHTML = `<strong>${sedeAsignada}</strong><br><small>Coordenadas: ${lat}, ${lon}</small>`;
            },
            (error) => {
                console.warn("Fallo o denegación de GPS nativo, aplicando respaldo por IP:", error);
                
                // PASO 2: Si el GPS falla o no hay permiso, corre el plan de respaldo tradicional
                metricNetwork.innerHTML = "IP: <strong>192.168.1.254</strong><br>ISP: Red Local SIT";
                metricUbicacion.innerHTML = "<strong>Sede Central (Opico)</strong><br><small>Ubicación por defecto (Desarrollo)</small>";
            }
        );
    } else {
        metricNetwork.innerHTML = "IP: <strong>192.168.1.254</strong><br>ISP: Red Local SIT";
        metricUbicacion.innerHTML = "<strong>Sede Central (Opico)</strong><br><small>Geolocalización no soportada</small>";
    }
}

function solicitarGeolocalizacionExacta(ciudadIP) {
    const metricUbicacion = document.getElementById("metric-ubicacion");

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude.toFixed(4);
                const lon = position.coords.longitude.toFixed(4);
                
                let sedeAsignada = "Sede Externa / Remota";
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
    if (!tbody) return;
    
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
                <button class="btn-action btn-edit" style="background-color: #2980b9; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" onclick="cargarParaEditar('${equipo.id}')">Editar</button>
                <button class="btn-action btn-delete" style="background-color: #c0392b; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" onclick="eliminarEquipo('${equipo.id}')">Eliminar</button>
            </td>
        `;
        tbody.appendChild(fila);
    });

    if (window.Worker) {
        const miWorker = new Worker("worker.js");
        miWorker.postMessage(inventario);

        miWorker.onmessage = function(event) {
            const metricas = event.data;
            document.getElementById("metric-total").innerText = metricas.totalEquipos;
            document.getElementById("metric-mantenimiento").innerText = metricas.mantenimientoEquipos;
        };

        miWorker.onerror = function(error) {
            console.error("Error en el hilo del Web Worker:", error);
        };
    } else {
        document.getElementById("metric-total").innerText = inventario.length;
        document.getElementById("metric-mantenimiento").innerText = inventario.filter(e => e.estado === "Mantenimiento").length;
    }
}

// ==========================================================================
// 3. FUNCIONES DE ELIMINAR Y EDITAR (COMPLETANDO EL CRUD)
// ==========================================================================

function eliminarEquipo(id) {
    if (modoEdicion && idEnEdicion === id) {
        restaurarFormularioOriginal();
    }

    const confirmar = confirm(`¿Está seguro de que desea eliminar el equipo con Tag: ${id}?`);
    
    if (confirmar) {
        try {
            inventario = inventario.filter(equipo => equipo.id !== id);
            localStorage.setItem("it_inventario", JSON.stringify(inventario));
            listarEquipos();
            alert("Equipo eliminado del inventario correctamente.");
        } catch (error) {
            console.error("Error al eliminar el equipo:", error);
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
        console.error("Error al cargar la edición:", error);
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
        console.error("Error al actualizar el equipo:", error);
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

// ==========================================================================
// 4. MÓDULO DE BÚSQUEDA Y FILTRADO EN TIEMPO REAL
// ==========================================================================

function filtrarInventario() {
    const textoBusqueda = document.getElementById("search-input").value.toLowerCase().trim();
    const estadoSeleccionado = document.getElementById("filter-status").value;

    const tbody = document.getElementById("inventory-tbody");
    if (!tbody) return;
    
    tbody.innerHTML = "";

    const inventarioFiltrado = inventario.filter(equipo => {
        const coincideTexto = equipo.id.toLowerCase().includes(textoBusqueda) ||
                              equipo.marca.toLowerCase().includes(textoBusqueda) ||
                              equipo.modelo.toLowerCase().includes(textoBusqueda);

        const coincideEstado = (estadoSeleccionado === "Todos") || (equipo.estado === estadoSeleccionado);

        return coincideTexto && coincideEstado;
    });

    if (inventarioFiltrado.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #7f8c8d;">No se encontraron activos con los filtros applied.</td></tr>`;
        return;
    }

    inventarioFiltrado.forEach(equipo => {
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
                <button class="btn-action btn-edit" style="background-color: #2980b9; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" onclick="cargarParaEditar('${equipo.id}')">Editar</button>
                <button class="btn-action btn-delete" style="background-color: #c0392b; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;" onclick="eliminarEquipo('${equipo.id}')">Eliminar</button>
            </td>
        `;
        tbody.appendChild(fila);
    });
}

// ==========================================================================
// 5. MÓDULO DE MODO NOCHE (PERSISTENTE)
// ==========================================================================

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

// ==========================================================================
// 6. MÓDULO DE IMPORTACIÓN MASIVA DESDE EXCEL (SHEETJS)
// ==========================================================================

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
                // Forzamos conversión limpia a texto y eliminamos espacios
                const tag = fila.id ? String(fila.id).trim() : '';
                const tipo = fila.tipo ? String(fila.tipo).trim() : 'Laptop';
                const marca = fila.marca ? String(fila.marca).trim() : '';
                const modelo = fila.modelo ? String(fila.modelo).trim() : '';
                const estado = fila.estado ? String(fila.estado).trim() : 'Activo';

                if (!tag) return; // Si la fila no tiene ID, la salta

                const existe = inventario.some(equipo => equipo.id === tag);

                if (!existe) {
                    const nuevoEquipo = {
                        id: tag,
                        tipo: tipo,
                        marca: marca,
                        modelo: modelo,
                        estado: estado,
                        ubicacion: ubicacionActual
                    };
                    inventario.push(nuevoEquipo);
                    registradosNuevos++;
                } else {
                    duplicadosOmitidos++;
                }
            });

            localStorage.setItem("it_inventario", JSON.stringify(inventario));
            listarEquipos();
            
            // Limpiar el selector de archivos
            event.target.value = "";

            alert(`Proceso completado:\n\n✅ Agregados: ${registradosNuevos}\n⚠️ Duplicados omitidos: ${duplicadosOmitidos}`);

        } catch (error) {
            console.error("Error al procesar el archivo Excel:", error);
            alert("Error crítico al procesar el archivo. Revisa la consola (F12).");
        }
    };

    lector.readAsBinaryString(archivo);
}