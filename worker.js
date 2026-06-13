console.log("Web Worker inicializado correctamente.");

// Hilo secundario enfocado en liberar el renderizado del DOM al procesar volúmenes masivos de datos
self.onmessage = function(event) {
    try {
        const inventario = event.data;
        const total = inventario.length;
        
        const enMantenimiento = inventario.filter(
            equipo => equipo.estado === "Mantenimiento"
        ).length;

        self.postMessage({
            totalEquipos: total,
            mantenimientoEquipos: enMantenimiento
        });
    } catch (error) {
        console.error("Error interno en Web Worker:", error);
    }
};